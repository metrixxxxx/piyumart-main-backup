import { NextResponse } from "next/server";
import { getBaoAccess } from "@/lib/bao-access";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const access = await getBaoAccess();
    if (!access.session) {
      return NextResponse.json(
        { error: access.status === 401 ? "Unauthorized" : "Forbidden" },
        { status: access.status }
      );
    }

    const [[stats]] = await db.query(`
      SELECT
        (
          SELECT COUNT(*)
          FROM users
          WHERE COALESCE(role, 'user') NOT IN ('admin', 'bao')
        ) AS total_registered_users,
        (
          SELECT COUNT(*)
          FROM (
            SELECT id FROM users WHERE role = 'seller'
            UNION
            SELECT seller_id AS id FROM products WHERE seller_id IS NOT NULL
            UNION
            SELECT seller_id AS id FROM orders WHERE seller_id IS NOT NULL
          ) AS seller_accounts
        ) AS total_sellers,
        (
          SELECT COUNT(*) FROM products WHERE status = 'approved'
        ) AS total_approved_products,
        (
          SELECT COUNT(*) FROM products WHERE status = 'pending'
        ) AS pending_product_approvals,
        (
          SELECT COUNT(*) FROM orders WHERE status = 'completed'
        ) AS completed_orders,
        COALESCE(
          (SELECT SUM(total) FROM orders WHERE status = 'completed'),
          0
        ) AS total_marketplace_sales,
        COALESCE(
          (
            SELECT SUM(oc.commission_amount)
            FROM order_commissions AS oc
            INNER JOIN orders AS o ON o.id = oc.order_id
            WHERE o.status = 'completed'
          ),
          0
        ) AS total_bao_commission,
        (
          SELECT COUNT(*) FROM marketplace_reports WHERE status = 'pending'
        ) AS pending_complaints
    `);

    return NextResponse.json(
      {
        totalRegisteredUsers: stats.total_registered_users,
        totalSellers: stats.total_sellers,
        totalApprovedProducts: stats.total_approved_products,
        pendingProductApprovals: stats.pending_product_approvals,
        completedOrders: stats.completed_orders,
        totalMarketplaceSales: stats.total_marketplace_sales,
        totalBaoCommission: stats.total_bao_commission,
        pendingComplaints: stats.pending_complaints,
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    console.error("BAO dashboard metrics request failed:", error);
    return NextResponse.json(
      { error: "Unable to load BAO dashboard metrics." },
      { status: 500 }
    );
  }
}
