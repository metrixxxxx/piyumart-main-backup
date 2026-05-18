import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { notify } from "@/lib/notify";

export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
const orderId = Number(id);
    const sellerId = Number(session.user.id);
    const { status, tracking_number, courier, cancel_reason, cancel_note } = await req.json();

    // fetch order
    const [orderRows] = await db.query(
      `SELECT * FROM orders WHERE id = $1`,
      [orderId]
    );
    const order = orderRows[0];
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    // verify seller owns an item in this order
    const [sellerCheck] = await db.query(
      `SELECT 1 FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = $1 AND p.seller_id = $2
       LIMIT 1`,
      [orderId, sellerId]
    );
    if (!sellerCheck[0])
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // validate transitions
    const SELLER_TRANSITIONS = {
      pending:    ["confirmed", "cancelled"],
      confirmed:  ["processing", "cancelled"],
      processing: ["shipped"],
      shipped:    [],
    };
    const allowed = SELLER_TRANSITIONS[order.status] || [];
    if (!allowed.includes(status))
      return NextResponse.json(
        { error: `Cannot move from "${order.status}" to "${status}"` },
        { status: 400 }
      );

    // build update
    const now = new Date().toISOString();
    const timestampField = {
      confirmed: "confirmed_at",
      shipped:   "shipped_at",
      completed: "completed_at",
      cancelled: "cancelled_at",
    }[status];

    let updateFields = [`status = $1`];
    let updateValues = [status];
    let i = 2;

    if (timestampField) {
      updateFields.push(`${timestampField} = $${i++}`);
      updateValues.push(now);
    }
    if (status === "confirmed") {
      updateFields.push(`seller_confirm_deadline = NULL`);
    }
    if (status === "shipped" && tracking_number) {
      updateFields.push(`tracking_number = $${i++}`);
      updateValues.push(tracking_number);
    }
    if (status === "shipped" && courier) {
      updateFields.push(`courier = $${i++}`);
      updateValues.push(courier);
    }
    if (status === "cancelled") {
      updateFields.push(`cancel_reason = $${i++}`);
      updateValues.push(cancel_reason || "seller_unavailable");
      updateFields.push(`cancel_note = $${i++}`);
      updateValues.push(cancel_note || null);
    }

    updateValues.push(orderId);
    await db.query(
      `UPDATE orders SET ${updateFields.join(", ")} WHERE id = $${i}`,
      updateValues
    );

    // restore stock if cancelled
    if (status === "cancelled") {
      const [items] = await db.query(
        `SELECT product_id, quantity FROM order_items WHERE order_id = $1`,
        [orderId]
      );
      for (const item of items) {
        await db.query(
          `UPDATE products SET stock = stock + $1 WHERE id = $2`,
          [item.quantity, item.product_id]
        );
      }
    }

    // notify buyer
    const BUYER_MESSAGES = {
      confirmed:  `✅ Your order #${orderId} has been confirmed by the seller!`,
      processing: `📦 Order #${orderId} is being prepared by the seller.`,
      shipped:    `🚚 Order #${orderId} has been shipped! ${tracking_number ? `${courier || ""} · ${tracking_number}` : ""}`,
      cancelled:  `❌ Order #${orderId} was cancelled by the seller. ${cancel_note ? `Reason: ${cancel_note}` : ""}`,
    };
    if (BUYER_MESSAGES[status]) {
      await notify({
        userId: order.user_id,
        type: `order_${status}`,
        message: BUYER_MESSAGES[status],
      });
    }

    // emit to buyer — updates my-orders in real-time
    global.io?.to(`user_${order.user_id}`).emit("orders:updated", {
      id: orderId,
      status,
      ...(tracking_number && { tracking_number }),
      ...(courier && { courier }),
    });

    // emit to seller — updates my-listings in real-time
    global.io?.to(`user_${sellerId}`).emit("orders:updated", {
      id: orderId,
      status,
    });

    return NextResponse.json({ success: true, status });
  } catch (err) {
    console.error("Seller order PATCH error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}