import { db } from "@/lib/db";
import { cookies } from "next/headers";

export async function DELETE(req, { params }) {
  try {
    const cookieStore = await cookies();
    const adminCookie = cookieStore.get("admin_session");
    if (!adminCookie) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    await db.query("DELETE FROM products WHERE id=$1", [id]);
    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}