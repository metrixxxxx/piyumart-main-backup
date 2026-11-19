import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { notify, createNotificationRecord, broadcastNotification } from "@/lib/notify";
import { isActiveSellerAccount } from "@/lib/seller-access";
import { recordOrderCommission } from "@/lib/bao-commission";
import { transitionOnlineOrder } from "@/lib/payments/events";
import { uploadPickupProof, removePickupProof } from "@/lib/pickup-proof";
import { PICKUP_PROOF_MAX_BYTES } from "@/lib/orders/pickup-proof-policy";

const ACTION_TO_STATUS = {
  confirm_delivery: "completed",
  cancel: "cancelled",
  confirm: "confirmed",
  process: "processing",
  ship: "shipped",
};

export async function PATCH(req, { params }) {
  let proofUpload;
  let committed = false;
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const orderId = Number(id);
    if (!Number.isSafeInteger(orderId) || orderId < 1) return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });

    if (Number(req.headers.get("content-length")) > PICKUP_PROOF_MAX_BYTES + 1024 * 1024) {
      return NextResponse.json({ error: "Proof photos must be 5 MB or smaller." }, { status: 413 });
    }
    let body, proofFile;
    try {
      if (req.headers.get("content-type")?.startsWith("multipart/form-data")) {
        const form = await req.formData();
        body = { action: form.get("action"), status: form.get("status") };
        proofFile = form.get("pickup_proof");
      } else body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid order update." }, { status: 400 });
    }
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid order update." }, { status: 400 });
    const [paymentOrders] = await db.query("SELECT payment_method FROM orders WHERE id=$1", [orderId]);
    if (paymentOrders[0]?.payment_method === "paymongo") return NextResponse.json(await transitionOnlineOrder(session.user.id, orderId, body, proofFile));
    const status = body.status ?? ACTION_TO_STATUS[body.action];
    if (!status) return NextResponse.json({ error: "Invalid action or status" }, { status: 400 });

    const transition = await db.transaction(async (client) => {
      const { rows } = await client.query(
        `SELECT * FROM orders WHERE id = $1 FOR UPDATE`,
        [orderId]
      );
      const order = rows[0];
      if (!order) return { error: "Order not found", status: 404 };

      const isSeller = Number(order.seller_id) === Number(session.user.id);
      const isBuyer = Number(order.user_id) === Number(session.user.id);

      if (isSeller && !(await isActiveSellerAccount(session.user.id))) {
        return {
          error: "An active account is required to manage seller orders.",
          status: 403,
        };
      }

      const buyerAllowedActions = {
        cancelled: order.status === "pending",
        completed: order.status === "shipped",
      };

      if (isSeller && status === "completed") {
        return { error: "Only the buyer can confirm order completion.", status: 403 };
      }

      if (!isSeller && (!isBuyer || !buyerAllowedActions[status])) {
        return { error: "Forbidden", status: 403 };
      }

      if (order.status === "cancelled" || order.status === "completed") {
        return { error: "Order already finalized", status: 400 };
      }

      if (status === "completed") {
        proofUpload = await uploadPickupProof(orderId, proofFile);
        const { rows: items } = await client.query(
          `SELECT product_id, quantity FROM order_items WHERE order_id = $1`,
          [orderId]
        );
        for (const item of items) {
          await client.query(
            `UPDATE products SET sold_count = sold_count + $1 WHERE id = $2`,
            [item.quantity, item.product_id]
          );
          if (!order.stock_reserved) {
            await client.query(
              `UPDATE products SET stock = stock - $1 WHERE id = $2 AND stock >= $3`,
              [item.quantity, item.product_id, item.quantity]
            );
          }
        }
      }

      if (status === "cancelled") {
        const { rows: items } = await client.query(
          `SELECT * FROM order_items WHERE order_id = $1`,
          [orderId]
        );
        for (const item of items) {
          if (item.variant_id) {
            await client.query(
              `UPDATE product_variants SET stock = stock + $1 WHERE id = $2`,
              [item.quantity, item.variant_id]
            );
          } else {
            await client.query(
              `UPDATE products SET stock = stock + $1 WHERE id = $2`,
              [item.quantity, item.product_id]
            );
          }
        }
      }

      const { rows: updatedRows } = await client.query(
        `UPDATE orders
         SET status = $1,
             completed_at = CASE
               WHEN $3 THEN COALESCE(completed_at, NOW())
               ELSE completed_at
             END,
             pickup_proof_path = CASE WHEN $3 THEN $4 ELSE pickup_proof_path END,
             pickup_proof_uploaded_at = CASE WHEN $3 THEN NOW() ELSE pickup_proof_uploaded_at END
         WHERE id = $2
         RETURNING *`,
        [status, orderId, status === "completed", proofUpload?.path || null]
      );
      const updatedOrder = updatedRows[0];

      let notification;
      if (status === "completed") {
        await recordOrderCommission(client, orderId);
        notification = await createNotificationRecord({ userId: updatedOrder.user_id, type: "order_completed", message: `Your order #${orderId} is complete. Your proof photo has been saved. Thank you!` }, client);
      }

      return { order: updatedOrder, notification };
    });

    if (transition.error) {
      return NextResponse.json({ error: transition.error }, { status: transition.status });
    }
    committed = true;

    const updatedOrder = transition.order;

    // The database broadcasts after commit, including buyer completion and refunds.
    if (transition.notification) await broadcastNotification(transition.notification);
    if (status === "cancelled") {
      await notify({ userId: updatedOrder.user_id, type: "order_cancelled", message: `Your order #${orderId} has been cancelled.` });
    }

    const { pickup_proof_path, ...publicOrder } = updatedOrder;
    return NextResponse.json({ success: true, status, order: { ...publicOrder, has_pickup_proof: Boolean(pickup_proof_path) } });
  } catch (err) {
    if (!committed) await removePickupProof(proofUpload);
    console.error("PATCH /orders/[id] error:", err);
    return NextResponse.json({ error: err.status ? err.message : "Unable to update order." }, { status: err.status || 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const orderId = Number(id);
    if (isNaN(orderId)) return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });

    const [rows] = await db.query(`SELECT id, status, user_id, payment_method FROM orders WHERE id = $1`, [orderId]);
    const order = rows[0];

    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    if (Number(order.user_id) !== Number(session.user.id))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (order.payment_method === "paymongo") return NextResponse.json({ error: "Online orders are retained for financial history." }, { status: 409 });

    if (!["cancelled", "completed"].includes(order.status))
      return NextResponse.json(
        { error: "Only cancelled or completed orders can be deleted." },
        { status: 400 }
      );

    const [commissionRows] = await db.query(
      `SELECT 1 FROM order_commissions WHERE order_id = $1 LIMIT 1`,
      [orderId]
    );
    if (commissionRows.length) {
      return NextResponse.json(
        { error: "Orders with recorded BAO commissions cannot be deleted." },
        { status: 409 }
      );
    }

    await db.query(`DELETE FROM order_items WHERE order_id = $1`, [orderId]);
    await db.query(`DELETE FROM orders WHERE id = $1`, [orderId]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /orders/[id] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
