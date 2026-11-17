import { withCatalogInvalidation } from "@/lib/catalog-cache";
import { db } from "@/lib/db";
import { getAdminAccess } from "@/lib/admin-session";

async function handleDELETE(req, { params }) {
  try {
    const access = await getAdminAccess();
    if (!access.admin) {
      return Response.json(
        { error: access.status === 401 ? "Unauthorized" : "Forbidden" },
        { status: access.status }
      );
    }

    const { id } = await params;
    const [rows] = await db.query(
      "DELETE FROM users WHERE id = $1 AND role NOT IN ('admin', 'bao') RETURNING id",
      [id]
    );
    if (!rows.length) {
      return Response.json(
        { error: "User not found or protected from deletion." },
        { status: 404 }
      );
    }
    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
export const DELETE = withCatalogInvalidation(handleDELETE);
