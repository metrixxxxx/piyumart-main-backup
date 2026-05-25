import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();

    if (!q) return NextResponse.json([]);

    const exact   = q;           // for ILIKE exact (case-insensitive natively)
    const partial = `%${q}%`;
    const starts  = `${q}%`;

    const [products] = await db.query(
      `
      SELECT
        p.id,
        p.name,
        p.description,
        p.price,
        p.image_url,
        p.sold_count,
        p.average_rating,
        p.category_id,
        p.seller_id,
        c.name AS category,
        c.slug AS category_slug,

        (
          CASE WHEN p.name        ILIKE $1 THEN 100 ELSE 0 END +
          CASE WHEN p.name        ILIKE $3 THEN  60 ELSE 0 END +
          CASE WHEN p.name        ILIKE $2 THEN  40 ELSE 0 END +
          CASE WHEN c.name        ILIKE $1 THEN  30 ELSE 0 END +
          CASE WHEN c.name        ILIKE $2 THEN  20 ELSE 0 END +
          CASE WHEN p.description ILIKE $2 THEN  10 ELSE 0 END +
          CASE WHEN CAST(p.price AS TEXT) ILIKE $2 THEN 5 ELSE 0 END +
          LEAST(COALESCE(p.sold_count, 0), 20) +
          COALESCE(p.average_rating, 0) * 2
        ) AS relevance_score

      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id

      WHERE
        p.name        ILIKE $2
        OR c.name     ILIKE $2
        OR p.description ILIKE $2
        OR CAST(p.price AS TEXT) ILIKE $2

      ORDER BY relevance_score DESC, p.sold_count DESC, p.created_at DESC
      LIMIT 10
      `,
      [exact, partial, starts]
    );

    return NextResponse.json(products);
  } catch (error) {
    console.error("SEARCH API ERROR:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}