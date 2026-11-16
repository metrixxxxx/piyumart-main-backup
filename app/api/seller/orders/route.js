import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { db } from "@/lib/db";
import { isActiveSellerAccount } from "@/lib/seller-access";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isActiveSellerAccount(session.user.id))) return NextResponse.json({ error: "An active verified seller account is required." }, { status: 403 });

    const [rows] = await db.query(
      `SELECT
         o.id,
         o.status,
         o.total,
         o.created_at,
         o.seller_note,
         o.payment_method,
         o.payment_status,
         u.name                              AS buyer_name,
         u.email                             AS buyer_email,
         oi.id                               AS order_item_id,
         COALESCE(oi.name, p.name)           AS product_name,
         oi.quantity,
         oi.price,
         oi.variant,
         COALESCE(oi.image_url, p.image_url) AS image_url,
         COALESCE(oc.commission_rate, CASE WHEN a.order_id IS NOT NULL THEN 3 END, rate.percentage) AS commission_rate,
         CASE
           WHEN o.status = 'cancelled' THEN 0::numeric
           WHEN a.order_id IS NOT NULL THEN a.commission_amount-a.commission_refunded
           WHEN oc.id IS NOT NULL THEN oc.commission_amount
           WHEN rate.percentage IS NOT NULL THEN ROUND(o.total * rate.percentage / 100, 2)
           ELSE 0::numeric
         END AS commission_amount,
         CASE
           WHEN o.status = 'cancelled' THEN NULL
           WHEN a.order_id IS NOT NULL THEN a.seller_amount-a.seller_refunded
           WHEN oc.id IS NOT NULL THEN oc.seller_earnings
           ELSE o.total - CASE
             WHEN rate.percentage IS NOT NULL THEN ROUND(o.total * rate.percentage / 100, 2)
             ELSE 0::numeric
           END
         END AS seller_earnings,
         (oc.id IS NOT NULL OR a.order_id IS NOT NULL) AS commission_recorded
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN products p ON p.id = oi.product_id
       JOIN users u ON u.id = o.user_id
       LEFT JOIN order_commissions oc ON oc.order_id = o.id
       LEFT JOIN payment_allocations a ON a.order_id = o.id
       LEFT JOIN LATERAL (
         SELECT percentage
         FROM bao_commission_rates
         WHERE effective_at <= (o.created_at AT TIME ZONE current_setting('TimeZone'))
         ORDER BY effective_at DESC, created_at DESC, id DESC
         LIMIT 1
       ) AS rate ON true
       WHERE p.seller_id = $1
       ORDER BY o.created_at DESC, oi.id ASC`,
      [session.user.id]
    );

    return NextResponse.json(rows);
  } catch (err) {
    console.error("seller/orders error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
