import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");

    if (!q || !q.trim()) {
      return NextResponse.json([]);
    }

    const search = `%${q}%`;

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
        c.name AS category,
        c.slug AS category_slug
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE
        p.name ILIKE $1
        OR p.description ILIKE $1
        OR c.name ILIKE $1
        OR CAST(p.price AS TEXT) ILIKE $1
      ORDER BY p.created_at DESC
      LIMIT 8
      `,
      [search]
    );

    return NextResponse.json(products);
  } catch (error) {
    console.error("SEARCH API ERROR:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}