import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { db } from "@/lib/db";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("id");
    const categoryId = searchParams.get("category_id");
    const sellerId = searchParams.get("seller_id");
    const price = searchParams.get("price");

    if (!productId) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const params = [
      categoryId ? Number(categoryId) : null,  // $1 category_id
      sellerId ? Number(sellerId) : null,        // $2 seller_id
      price ? Number(price) : 0,                 // $3 price low
      price ? Number(price) : 0,                 // $4 price high
      Number(productId),                         // $5 exclude current
    ];

    let excludeSeller = "";
    if (session?.user?.id) {
      params.push(session.user.id);
      excludeSeller = `AND p.seller_id != $${params.length}`;
    }

    const [rows] = await db.query(
      `SELECT p.*, c.name as category_name,
        COALESCE(p.average_rating, 0) as average_rating,
        COALESCE(p.total_ratings, 0) as total_ratings,
        COALESCE(p.sold_count, 0) as sold_count,
        (
          CASE WHEN p.category_id = $1 THEN 40 ELSE 0 END +
          CASE WHEN p.seller_id = $2 THEN 20 ELSE 0 END +
          CASE WHEN $3 > 0 AND p.price BETWEEN $3 * 0.7 AND $4 * 1.3 THEN 15 ELSE 0 END +
          COALESCE(p.sold_count, 0) * 0.5 +
          COALESCE(p.average_rating, 0) * 2
        ) as relevance_score
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.is_visible = true
         AND p.id != $5
         ${excludeSeller}
       ORDER BY relevance_score DESC, p.id DESC
       LIMIT 6`,
      params
    );

    // Only return products with at least some relevance score
    const relevant = rows.filter((r) => Number(r.relevance_score) > 0);
    return NextResponse.json(relevant.length > 0 ? relevant : rows);
  } catch (err) {
    console.error("Related products error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}