// app/api/orders/[id]/route.js

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { notify } from "@/lib/notify";

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

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
const orderId = Number(id);
    if (isNaN(orderId)) {
      return NextResponse.json(
        { error: "Invalid order ID" },
        { status: 400 }
      );
    }

    const body = await req.json();

    const status =
      body.status ?? ACTION_TO_STATUS[body.action];

    if (!status) {
      return NextResponse.json(
        { error: "Invalid action or status" },
        { status: 400 }
      );
    }

    // GET ORDER
    const [rows] = await db.query(
      `
      SELECT *
      FROM orders
      WHERE id = $1
      `,
      [orderId]
    );

    const order = rows[0];

    if (!order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    const isAdmin = session.user.role === "admin";
    const isSeller = Number(order.seller_id) === Number(session.user.id);
    const isBuyer = Number(order.user_id) === Number(session.user.id);

    const buyerAllowedActions = {
      cancelled: order.status === "pending",
      completed: order.status === "shipped",
    };

    // PERMISSION CHECK
    if (!isAdmin && !isSeller) {

      if (!isBuyer || !buyerAllowedActions[status]) {
        return NextResponse.json(
          { error: "Forbidden" },
          { status: 403 }
        );
      }
    }

    // PREVENT DOUBLE FINALIZATION
    if (!isAdmin) {

      if (
        order.status === "cancelled" ||
        order.status === "completed"
      ) {
        return NextResponse.json(
          { error: "Order already finalized" },
          { status: 400 }
        );
      }
    }

    await db.query("BEGIN");

    // RESTORE STOCKS WHEN CANCELLED
    if (status === "cancelled") {

      const [items] = await db.query(
        `
        SELECT *
        FROM order_items
        WHERE order_id = $1
        `,
        [orderId]
      );

      console.log("RESTORING STOCK:", items);

      for (const item of items) {

        // PRODUCT VARIANT STOCK
        if (item.variant_id) {

          await db.query(
            `
            UPDATE product_variants
            SET stock = stock + $1
            WHERE id = $2
            `,
            [item.quantity, item.variant_id]
          );

          console.log(
            `Variant ${item.variant_id} restored by ${item.quantity}`
          );

        } else {

          // NORMAL PRODUCT STOCK
          await db.query(
            `
            UPDATE products
            SET stock = stock + $1
            WHERE id = $2
            `,
            [item.quantity, item.product_id]
          );

          console.log(
            `Product ${item.product_id} restored by ${item.quantity}`
          );
        }
      }
    }

    // UPDATE ORDER STATUS
    const [updatedRows] = await db.query(
      `
      UPDATE orders
      SET status = $1
      WHERE id = $2
      RETURNING *
      `,
      [status, orderId]
    );

    const updatedOrder = updatedRows[0];

    await db.query("COMMIT");

    // REALTIME UPDATE
    if (global.io) {

      global.io
        .to(`user_${order.user_id}`)
        .emit("orders:updated", {
          id: orderId,
          status,
          tracking_number:
            updatedOrder.tracking_number ?? null,
          courier:
            updatedOrder.courier ?? null,
        });
    }

    // NOTIFICATIONS
    if (status === "completed") {

      await notify({
        userId: order.user_id,
        type: "order_completed",
        message: `Your order #${orderId} has been marked as received. Thank you!`,
      });
    }

    if (status === "cancelled") {

      await notify({
        userId: order.user_id,
        type: "order_cancelled",
        message: `Your order #${orderId} has been cancelled.`,
      });
    }

    return NextResponse.json({
      success: true,
      status,
      order: updatedOrder,
    });

  } catch (err) {

    await db.query("ROLLBACK");

    console.error("PATCH /orders/[id] error:", err);

    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}