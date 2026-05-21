import { db } from "@/lib/db";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const adminCookie = cookieStore.get("admin_session");
    if (!adminCookie) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const [rows] = await db.query("SELECT id, name, email, role FROM users");
    return Response.json(rows);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

