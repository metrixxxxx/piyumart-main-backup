import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { notify } from "@/lib/notify";
import { supabaseAdmin } from "@/lib/supabase";

const ACTION_TO_STATUS = {
  confirm_delivery: "completed",
  cancel: "cancelled",
  confirm: "confirmed",
  process: "processing",
  ship: "shipped",
};

export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const orderId = Number(id);
    if (isNaN(orderId)) return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });

    const body = await req.json();
    const status = body.status ?? ACTION_TO_STATUS[body.action];
    if (!status) return NextResponse.json({ error: "Invalid action or status" }, { status: 400 });

    const [rows] = await db.query(`SELECT * FROM orders WHERE id = $1`, [orderId]);
    const order = rows[0];
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const isAdmin = session.user.role === "admin";
    const isSeller = Number(order.seller_id) === Number(session.user.id);
    const isBuyer = Number(order.user_id) === Number(session.user.id);

    const buyerAllowedActions = {
      cancelled: order.status === "pending",
      completed: order.status === "shipped",
    };

    if (!isAdmin && !isSeller) {
      if (!isBuyer || !buyerAllowedActions[status]) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    if (order.status === "cancelled" || order.status === "completed") {
      return NextResponse.json({ error: "Order already finalized" }, { status: 400 });
    }

    await db.query("BEGIN");

    if (status === "completed" && order.status !== "completed") {
      const [items] = await db.query(`SELECT product_id, quantity FROM order_items WHERE order_id = $1`, [orderId]);
      for (const item of items) {
        await db.query(`UPDATE products SET sold_count = sold_count + $1 WHERE id = $2`, [item.quantity, item.product_id]);
        await db.query(`UPDATE products SET stock = stock - $1 WHERE id = $2 AND stock >= $3`, [item.quantity, item.product_id, item.quantity]);
      }
    }

    if (status === "cancelled") {
      const [items] = await db.query(`SELECT * FROM order_items WHERE order_id = $1`, [orderId]);
      for (const item of items) {
        if (item.variant_id) {
          await db.query(`UPDATE product_variants SET stock = stock + $1 WHERE id = $2`, [item.quantity, item.variant_id]);
        } else {
          await db.query(`UPDATE products SET stock = stock + $1 WHERE id = $2`, [item.quantity, item.product_id]);
        }
      }
    }

    const [updatedRows] = await db.query(
      `UPDATE orders SET status = $1 WHERE id = $2 RETURNING *`,
      [status, orderId]
    );
    const updatedOrder = updatedRows[0];

    await db.query("COMMIT");

    // ✅ Broadcast to buyer
    try {
      await supabaseAdmin
        .channel(`buyer:${order.user_id}`)
        .send({
          type: "broadcast",
          event: "orders:updated",
          payload: {
            id: orderId,
            status,
            tracking_number: updatedOrder.tracking_number ?? null,
            courier: updatedOrder.courier ?? null,
          },
        });
    } catch (e) {
      console.error("Broadcast to buyer error:", e);
    }

    // ✅ Broadcast to seller (para ma-update ang MyListings)
    try {
      const [sellerItems] = await db.query(
        `SELECT DISTINCT p.seller_id FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = $1`,
        [orderId]
      );
      for (const { seller_id } of sellerItems) {
        await supabaseAdmin
          .channel(`seller:${seller_id}`)
          .send({
            type: "broadcast",
            event: "orders:updated",
            payload: { id: orderId, status },
          });
      }
    } catch (e) {
      console.error("Broadcast to seller error:", e);
    }

    if (status === "completed") {
      await notify({ userId: order.user_id, type: "order_completed", message: `Your order #${orderId} has been marked as received. Thank you!` });
    }
    if (status === "cancelled") {
      await notify({ userId: order.user_id, type: "order_cancelled", message: `Your order #${orderId} has been cancelled.` });
    }

    return NextResponse.json({ success: true, status, order: updatedOrder });
  } catch (err) {
    await db.query("ROLLBACK");
    console.error("PATCH /orders/[id] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}