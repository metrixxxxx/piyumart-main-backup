import { db } from "@/lib/db";

export async function GET() {
  try {
    const [rows] = await db.query(
      `SELECT p.*
       FROM products AS p
       WHERE p.is_featured = true
         AND p.status = 'approved'
         AND p.is_visible = true
         AND EXISTS (
           SELECT 1 FROM users seller
           WHERE seller.id = p.seller_id AND seller.status = 'active'
         )
       LIMIT 5`
    );
    return Response.json(Array.isArray(rows) ? rows : []);
  } catch (err) {
    console.error("Featured API error:", err);
    return Response.json([]);
  }
}