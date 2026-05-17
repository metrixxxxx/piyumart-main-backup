import { db } from "@/lib/db";

export async function POST(req) {
  try {
    const { id } = await req.json();

    const [rows] = await db.query("SELECT is_featured FROM products WHERE id=$1", [id]);
    const current = rows[0]?.is_featured;

    await db.query("UPDATE products SET is_featured=$1 WHERE id=$2", [!current, id]);

    return Response.json({ success: true });
  } catch (err) {
    console.error(err);
    return Response.json({ success: false }, { status: 500 });
  }
}