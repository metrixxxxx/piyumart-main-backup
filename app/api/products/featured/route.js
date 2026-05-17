import { db } from "@/lib/db";

export async function GET() {
  try {
    const [rows] = await db.query(
      "SELECT * FROM products WHERE is_featured = true LIMIT 5"
    );
    return Response.json(Array.isArray(rows) ? rows : []);
  } catch (err) {
    console.error("Featured API error:", err);
    return Response.json([]);
  }
}