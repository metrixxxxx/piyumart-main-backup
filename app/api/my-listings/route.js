import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // ======================
    // PRODUCTS
    // ======================
    const [products] = await db.query(
      `SELECT *
       FROM products
       WHERE seller_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    // ======================
    // STATS
    // ======================
    const [statsRows] = await db.query(
      `SELECT 
          COUNT(DISTINCT o.id) AS total_orders,
          COALESCE(SUM(oi.quantity * oi.price), 0) AS revenue
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       JOIN products p ON p.id = oi.product_id
       WHERE p.seller_id = $1`,
      [userId]
    );

    const stats = statsRows?.[0] || { total_orders: 0, revenue: 0 };

    // ======================
    // ORDERS — flat rows, one per order_item
    // ======================
    const [rows] = await db.query(
      `SELECT 
          o.id,
          o.status,
          o.created_at,
          o.total,
          o.buyer_name,
          o.buyer_email,
          p.name        AS product_name,
          pv.name       AS variant,
          oi.quantity,
          oi.price
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       JOIN products p     ON p.id = oi.product_id
       LEFT JOIN product_variants pv ON pv.id = oi.variant_id
       WHERE p.seller_id = $1
       ORDER BY o.id DESC`,
      [userId]
    );

    return NextResponse.json({
      products: products || [],
      stats: {
        total:       products?.length || 0,
        active:      (products || []).filter(p => Number(p.is_visible) === 1).length,
        totalOrders: Number(stats.total_orders) || 0,
        revenue:     Number(stats.revenue) || 0,
      },
      orders: rows || [],
    });

  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}