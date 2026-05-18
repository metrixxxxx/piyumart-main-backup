import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { notify } from "@/lib/notify";

export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = params;
    const { action } = await req.json();

    const [rows] = await db.query(`SELECT * FROM orders WHERE id = $1`, [id]);
    const order = rows[0];
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (String(order.user_id) !== String(session.user.id))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if (action === "confirm_delivery") {
      if (order.status !== "shipped")
        return NextResponse.json({ error: "Order is not shipped yet" }, { status: 400 });

      await db.query(
        `UPDATE orders SET status = 'completed', completed_at = NOW() WHERE id = $1`,
        [id]
      );

      // notify seller
      const [itemRows] = await db.query(
        `SELECT p.seller_id FROM order_items oi
         JOIN products p ON p.id = oi.product_id
         WHERE oi.order_id = $1 LIMIT 1`,
        [id]
      );
      if (itemRows[0]) {
        await notify({
          userId: itemRows[0].seller_id,
          type: "order_completed",
          message: `✅ Order #${id} has been received by the buyer. Order completed!`,
        });
        // notify seller's room
        global.io?.to(`user_${itemRows[0].seller_id}`).emit("orders:updated", {
          id: Number(id),
          status: "completed",
        });
      }

      // notify buyer's own room
      global.io?.to(`user_${session.user.id}`).emit("orders:updated", {
        id: Number(id),
        status: "completed",
      });

      return NextResponse.json({ success: true, status: "completed" });
    }

    if (action === "cancel") {
      if (order.status !== "pending")
        return NextResponse.json({ error: "Only pending orders can be cancelled" }, { status: 400 });

      await db.query(
        `UPDATE orders SET status = 'cancelled', cancelled_at = NOW(), cancel_reason = 'buyer_cancelled' WHERE id = $1`,
        [id]
      );

      // restore stock
      const [items] = await db.query(
        `SELECT product_id, quantity FROM order_items WHERE order_id = $1`,
        [id]
      );
      for (const item of items) {
        await db.query(
          `UPDATE products SET stock = stock + $1 WHERE id = $2`,
          [item.quantity, item.product_id]
        );
      }

      // notify seller
      const [itemRows] = await db.query(
        `SELECT p.seller_id FROM order_items oi
         JOIN products p ON p.id = oi.product_id
         WHERE oi.order_id = $1 LIMIT 1`,
        [id]
      );
      if (itemRows[0]) {
        await notify({
          userId: itemRows[0].seller_id,
          type: "order_cancelled",
          message: `❌ Order #${id} was cancelled by the buyer.`,
        });
        global.io?.to(`user_${itemRows[0].seller_id}`).emit("orders:updated", {
          id: Number(id),
          status: "cancelled",
        });
      }

      global.io?.to(`user_${session.user.id}`).emit("orders:updated", {
        id: Number(id),
        status: "cancelled",
      });

      return NextResponse.json({ success: true, status: "cancelled" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error("PATCH /api/orders/[id] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}