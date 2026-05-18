// app/api/orders/route.js
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { notify } from "@/lib/notify";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [orders] = await db.query(
      `SELECT * FROM orders WHERE user_id = $1 ORDER BY id DESC`,
      [session.user.id]
    );

    const ordersWithItems = await Promise.all(
      orders.map(async (order) => {
       const [items] = await db.query(
  `SELECT oi.product_id, oi.quantity, oi.price, p.name, p.seller_name,
    COALESCE(
      (SELECT pi.image_url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.sort_order ASC LIMIT 1),
      p.image_url
    ) AS image_url
   FROM order_items oi
   LEFT JOIN products p ON p.id = oi.product_id
   WHERE oi.order_id = $1`,
  [order.id]
);
        return { ...order, items };
      })
    );

    return NextResponse.json(ordersWithItems);
  } catch (err) {
    console.error("Orders GET error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const { name, email, address, payment_method, total, items } = await req.json();

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    for (const item of items) {
      const [rows] = await db.query(
        `SELECT name, stock FROM products WHERE id = $1`,
        [item.product_id]
      );
      if (!rows[0]) {
        return NextResponse.json({ error: `Product not found (ID: ${item.product_id})` }, { status: 404 });
      }
      if (rows[0].stock < item.quantity) {
        return NextResponse.json(
          { error: `"${rows[0].name}" only has ${rows[0].stock} left in stock.` },
          { status: 400 }
        );
      }
    }

    const [result] = await db.query(
      `INSERT INTO orders (user_id, name, email, address, payment_method, total, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING id`,
      [session.user.id, name, email, address, payment_method, total]
    );

    const orderId = result[0].id;

    for (const item of items) {
      await db.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price)
         VALUES ($1, $2, $3, $4)`,
        [orderId, item.product_id, item.quantity, item.price]
      );
    }

    for (const item of items) {
      await db.query(
        `UPDATE products SET stock = stock - $1 WHERE id = $2 AND stock >= $3`,
        [item.quantity, item.product_id, item.quantity]
      );

      const [productRows] = await db.query(
        `SELECT seller_id, name, stock FROM products WHERE id = $1`,
        [item.product_id]
      );
      const product = productRows[0];
      if (!product) continue;

      await notify({
        userId: product.seller_id,
        type: "order",
        message: `New order #${orderId} for "${product.name}" x${item.quantity} — please approve it in My Listings.`,
      });

      if (product.stock <= 5) {
        await notify({
          userId: product.seller_id,
          type: "low_stock",
          message: `⚠️ Low stock: "${product.name}" only has ${product.stock} left.`,
        });
      }
    }

    await notify({
      userId: session.user.id,
      type: "order_placed",
      message: `Your order #${orderId} has been placed! Total: ₱${Number(total).toLocaleString()}. Waiting for seller approval.`,
    });

    return NextResponse.json({ success: true, orderId });
  } catch (err) {
    console.error("Order POST error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}