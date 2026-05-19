import { db } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [rows] = await db.query(
      `SELECT 
        pr.id,
        pr.rating,
        pr.comment,
        pr.created_at,
        p.name AS product_name,
        u.name AS user_name
       FROM product_reviews pr
       JOIN products p ON pr.product_id = p.id
       JOIN users u ON pr.user_id = u.id
       WHERE p.seller_id = $1
       ORDER BY pr.created_at DESC`,
      [session.user.id]
    );

    return NextResponse.json(rows);
  } catch (err) {
    console.error("GET /api/seller/reviews error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}