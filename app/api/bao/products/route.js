import { NextResponse } from "next/server";
import { getBaoAccess } from "@/lib/bao-access";
import { db } from "@/lib/db";

const PRODUCT_STATUSES = new Set([
  "active",
  "approved",
  "pending",
  "rejected",
  "suspended",
]);

export async function GET(req) {
  try {
    const access = await getBaoAccess();
    if (!access.session) {
      return NextResponse.json(
        { error: access.status === 401 ? "Unauthorized" : "Forbidden" },
        { status: access.status }
      );
    }

    const { searchParams } = new URL(req.url);
    const status = (searchParams.get("status") || "pending").toLowerCase();
    const search = searchParams.get("search")?.trim();

    if (status !== "all" && !PRODUCT_STATUSES.has(status)) {
      return NextResponse.json({ error: "Invalid product status." }, { status: 400 });
    }

    const conditions = [];
    const params = [];

    if (status !== "all") {
      params.push(status);
      conditions.push(`p.status = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      const searchParameter = `$${params.length}`;
      conditions.push(`(
        p.name ILIKE ${searchParameter}
        OR COALESCE(p.description, '') ILIKE ${searchParameter}
        OR COALESCE(p.seller_name, CONCAT_WS(' ', u.name, u.last_name), '') ILIKE ${searchParameter}
        OR COALESCE(u.email, '') ILIKE ${searchParameter}
      )`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const [products] = await db.query(
      `SELECT
         p.id, p.name, p.description, p.price, p.stock, p.status,
         p.is_visible, p.is_featured, p.image_url, p.category_id, p.created_at,
         c.name AS category_name,
         p.seller_id,
         COALESCE(NULLIF(p.seller_name, ''), CONCAT_WS(' ', u.name, u.last_name)) AS seller_name,
         u.email AS seller_email
       FROM products AS p
       LEFT JOIN categories AS c ON c.id = p.category_id
       LEFT JOIN users AS u ON u.id = p.seller_id
       ${whereClause}
       ORDER BY
         CASE p.status WHEN 'pending' THEN 0 ELSE 1 END,
         p.created_at DESC, p.id DESC`,
      params
    );

    return NextResponse.json(products, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("BAO product list request failed:", error);
    return NextResponse.json(
      { error: "Unable to load product listings." },
      { status: 500 }
    );
  }
}
