import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { isActiveSellerAccount } from "@/lib/seller-access";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isActiveSellerAccount(session.user.id))) return NextResponse.json({ error: "An active verified seller account is required." }, { status: 403 });

  const userId = session.user.id;

  const [result] = await db.query(
    `WITH seller_orders AS (
       SELECT
         o.id,
         o.status,
         COALESCE(a.gross_amount-a.refunded_amount,o.total) AS total,
         COALESCE(oc.id::text,a.order_id::text) AS commission_record_id,
         CASE WHEN a.order_id IS NOT NULL THEN 3 ELSE rate.percentage END AS applicable_rate,
         CASE
           WHEN o.status = 'cancelled' THEN 0::numeric
           WHEN a.order_id IS NOT NULL THEN a.commission_amount-a.commission_refunded
           WHEN oc.id IS NOT NULL THEN oc.commission_amount
           WHEN rate.percentage IS NOT NULL THEN ROUND(o.total * rate.percentage / 100, 2)
           ELSE 0::numeric
         END AS commission_amount,
         CASE
           WHEN a.order_id IS NOT NULL THEN a.seller_amount-a.seller_refunded
           WHEN oc.id IS NOT NULL THEN oc.seller_earnings
           ELSE o.total - CASE
             WHEN o.status = 'cancelled' THEN 0::numeric
             WHEN rate.percentage IS NOT NULL THEN ROUND(o.total * rate.percentage / 100, 2)
             ELSE 0::numeric
           END
         END AS seller_earnings
       FROM orders AS o
       LEFT JOIN order_commissions AS oc ON oc.order_id = o.id
       LEFT JOIN payment_allocations AS a ON a.order_id = o.id
       LEFT JOIN LATERAL (
         SELECT percentage
         FROM bao_commission_rates
         WHERE effective_at <= (o.created_at AT TIME ZONE current_setting('TimeZone'))
         ORDER BY effective_at DESC, created_at DESC, id DESC
         LIMIT 1
       ) AS rate ON true
       WHERE o.seller_id = $1
          OR EXISTS (
            SELECT 1
            FROM order_items AS oi
            JOIN products AS p ON p.id = oi.product_id
            WHERE oi.order_id = o.id AND p.seller_id = $1
          )
     )
     SELECT
       COUNT(*) AS \"totalOrders\",
       COUNT(*) FILTER (WHERE status = 'completed') AS \"completedOrders\",
       COALESCE(SUM(total) FILTER (WHERE status = 'completed'), 0) AS \"grossRevenue\",
       COALESCE(SUM(commission_amount) FILTER (WHERE status = 'completed'), 0) AS commission,
       COALESCE(SUM(seller_earnings) FILTER (WHERE status = 'completed'), 0) AS revenue,
       COUNT(*) FILTER (
         WHERE status = 'completed'
           AND commission_record_id IS NULL
           AND applicable_rate IS NOT NULL
       ) AS \"unrecordedCompletedOrders\",
       COALESCE(
         SUM(commission_amount) FILTER (
           WHERE status = 'completed'
             AND commission_record_id IS NULL
             AND applicable_rate IS NOT NULL
         ),
         0
       ) AS \"unrecordedCommission\"
     FROM seller_orders`,
    [userId]
  );

  return NextResponse.json({
    totalOrders: Number(result[0]?.totalOrders) || 0,
    completedOrders: Number(result[0]?.completedOrders) || 0,
    grossRevenue: result[0]?.grossRevenue || 0,
    commission: result[0]?.commission || 0,
    revenue: result[0]?.revenue || 0,
    unrecordedCompletedOrders: Number(result[0]?.unrecordedCompletedOrders) || 0,
    unrecordedCommission: result[0]?.unrecordedCommission || 0,
  });
}
