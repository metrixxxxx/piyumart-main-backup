// app/api/seller/[sellerId]/route.js
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req, { params }) {
  try {
    const { sellerId } = await params;  // ← await na

    const [rows] = await db.query(
      `SELECT
        p.seller_id,
        p.seller_name,
        COUNT(*)                                             AS total_products,
        COALESCE(SUM(p.sold_count), 0)                      AS total_sold,
        ROUND(AVG(NULLIF(p.average_rating, 0))::numeric, 1) AS avg_rating,
        COALESCE(SUM(p.total_ratings), 0)                   AS total_reviews,
        MIN(p.created_at)                                   AS member_since
       FROM products p
       WHERE p.seller_id = $1::integer
         AND p.is_visible = true
       GROUP BY p.seller_id, p.seller_name`,
      [sellerId]
    );

    if (!rows.length) {
      return NextResponse.json({ error: "Seller not found" }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error("GET /api/seller error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}