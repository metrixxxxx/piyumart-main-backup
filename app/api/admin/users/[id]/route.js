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
    if (!/^[1-9]\d*$/.test(id) || Number(id) > 2147483647) {
      return Response.json({ error: "Invalid user ID." }, { status: 400 });
    }
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
    if (err.code === "P0001" && err.message?.startsWith("Cannot delete user:")) {
      return Response.json({ error: err.message }, { status: 409 });
    }
    if (err.code === "23503") {
      return Response.json({ error: "This user still has related records that could not be removed. No changes were saved." }, { status: 409 });
    }
    console.error("User deletion failed:", err.code || err.name);
    return Response.json({ error: "Unable to delete the user. Please try again." }, { status: 500 });
  }
}
export const DELETE = withCatalogInvalidation(handleDELETE);
