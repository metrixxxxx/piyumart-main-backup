import { db } from "@/lib/db";

export async function GET() {
  try {
    const [[{ total }]] = await db.query("SELECT COUNT(*) as total FROM users");
    return Response.json({ total });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}