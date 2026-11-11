import { db } from "@/lib/db";
import { getAdminAccess } from "@/lib/admin-session";

export async function GET() {
  try {
    const access = await getAdminAccess();
    if (!access.admin) {
      return Response.json(
        { error: access.status === 401 ? "Unauthorized" : "Forbidden" },
        { status: access.status }
      );
    }

    const [rows] = await db.query("SELECT id, name, email, role FROM users");
    return Response.json(rows);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

