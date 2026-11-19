import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { db } from "@/lib/db";
import { orderPage } from "@/lib/orders/read-model";
import { isActiveSellerAccount } from "@/lib/seller-access";
import { orderCommissionQuoteSql } from "@/lib/bao-commission";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isActiveSellerAccount(session.user.id))) return NextResponse.json({ error: "An active verified seller account is required." }, { status: 403 });

    const page=await orderPage(req,session.user.id,true);
    if(page.paging.offset>=page.total)return NextResponse.json([],{headers:page.headers});
    const [rows] = await db.query(
      `WITH paged_orders AS (
         SELECT o.id FROM orders o WHERE ${page.ownership} AND ($2::text IS NULL OR o.status=$2::text)
         ORDER BY o.created_at DESC,o.id DESC LIMIT $3 OFFSET $4
       ) SELECT
         o.id,
         o.status,
         o.total,
         o.created_at,
         o.seller_note,
         o.payment_method,
         o.payment_status,
         (o.pickup_proof_path IS NOT NULL) AS has_pickup_proof,
         o.pickup_proof_uploaded_at,
         u.name                              AS buyer_name,
         u.email                             AS buyer_email,
         oi.id                               AS order_item_id,
         COALESCE(oi.name, p.name)           AS product_name,
         oi.quantity,
         oi.price,
         oi.variant,
         COALESCE(oi.image_url, p.image_url) AS image_url,
         COALESCE(oc.commission_rate, CASE WHEN a.order_id IS NOT NULL THEN
           ROUND(a.commission_amount * 100 / a.gross_amount, 2) END, quote.commission_rate) AS commission_rate,
         CASE
           WHEN o.status = 'cancelled' THEN 0::numeric
           WHEN a.order_id IS NOT NULL THEN a.commission_amount-a.commission_refunded
           WHEN oc.id IS NOT NULL THEN oc.commission_amount
           WHEN quote.commission_amount IS NOT NULL THEN quote.commission_amount
           ELSE 0::numeric
         END AS commission_amount,
         CASE
           WHEN o.status = 'cancelled' THEN NULL
           WHEN a.order_id IS NOT NULL THEN a.seller_amount-a.seller_refunded
           WHEN oc.id IS NOT NULL THEN oc.seller_earnings
           ELSE o.total - CASE
             WHEN quote.commission_amount IS NOT NULL THEN quote.commission_amount
             ELSE 0::numeric
           END
         END AS seller_earnings,
         (oc.id IS NOT NULL OR a.order_id IS NOT NULL) AS commission_recorded
       FROM orders o
       JOIN paged_orders selected ON selected.id=o.id
       JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN products p ON p.id = oi.product_id
       JOIN users u ON u.id = o.user_id
       LEFT JOIN order_commissions oc ON oc.order_id = o.id
       LEFT JOIN payment_allocations a ON a.order_id = o.id
       ${orderCommissionQuoteSql}
       WHERE (o.seller_id=$1 OR p.seller_id=$1)
       ORDER BY o.created_at DESC,o.id DESC,oi.id ASC`,
      [session.user.id,page.status,page.paging.pageSize,page.paging.offset]
    );

    return NextResponse.json(rows,{headers:page.headers});
  } catch (err) {
    console.error("seller/orders error:", err.message);
    return NextResponse.json({ error: err.status?err.message:"Unable to load seller orders." }, { status: err.status||503 });
  }
}
