import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { createMarketplaceOrders, startCheckout } from "@/lib/payments/checkout";
import { requireBuyer, financeResponse } from "@/lib/payments/security";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [orders] = await db.query(
      `SELECT o.*, a.payment_id FROM orders o LEFT JOIN payment_allocations a ON a.order_id=o.id WHERE o.user_id = $1 ORDER BY o.id DESC`,
      [session.user.id]
    );

    const ordersWithItems = await Promise.all(
      orders.map(async (order) => {
        const [items] = await db.query(
          `SELECT
  oi.product_id,
  oi.quantity,
  oi.price,
  oi.variant,
  p.department,
  p.meetup_point,
  p.seller_id, -- ✅ SAFE HERE
  COALESCE(oi.name, p.name) AS name,
  COALESCE(oi.seller_name, p.seller_name) AS seller_name,
  COALESCE(
    oi.image_url,
    (SELECT pv.image_url FROM product_variants pv
     WHERE pv.product_id = p.id AND pv.label = oi.variant LIMIT 1),
    (SELECT pi.image_url FROM product_images pi
     WHERE pi.product_id = p.id ORDER BY pi.sort_order ASC LIMIT 1),
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
    const user = await requireBuyer();
    const result = await createMarketplaceOrders(user.id, await req.json(), req.headers.get("Idempotency-Key"));
    const payment = result.paymentId ? await startCheckout(result.paymentId, user.id) : null;
    return Response.json({ success: true, ...result, checkoutUrl: payment?.checkout_url || null });
  } catch (error) { return financeResponse(error); }
}

export async function DELETE(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const orderId = Number(params.id);

    // Verify the order exists and belongs to this buyer
    const [rows] = await db.query(
      `SELECT id, status, user_id FROM orders WHERE id = $1`,
      [orderId]
    );

    const order = rows[0];
    if (!order)
      return NextResponse.json({ error: "Order not found" }, { status: 404 });

    if (Number(order.user_id) !== Number(session.user.id))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const deletable = ["cancelled", "completed"];
    if (!deletable.includes(order.status))
      return NextResponse.json(
        { error: "Only cancelled or completed orders can be deleted." },
        { status: 400 }
      );

    // Delete order_items first (foreign key), then the order
    await db.query(`DELETE FROM order_items WHERE order_id = $1`, [orderId]);
    await db.query(`DELETE FROM orders WHERE id = $1`, [orderId]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Order DELETE error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
