import { withCatalogInvalidation } from "@/lib/catalog-cache";
import { NextResponse } from "next/server";
import { getBaoAccess } from "@/lib/bao-access";
import { db } from "@/lib/db";

async function handleDELETE(_req, { params }) {
  try {
    const access = await getBaoAccess();
    if (!access.session) {
      return NextResponse.json(
        { error: access.status === 401 ? "Unauthorized" : "Forbidden" },
        { status: access.status }
      );
    }

    const { id } = await params;
    if (!/^[1-9]\d*$/.test(id) || Number(id) > 2147483647) {
      return NextResponse.json({ error: "Invalid user ID." }, { status: 400 });
    }

    const [rows] = await db.query(
      "DELETE FROM users WHERE id = $1 AND role NOT IN ('admin', 'bao') RETURNING id",
      [id]
    );
    if (!rows.length) {
      return NextResponse.json(
        { error: "User not found or protected from deletion." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error.code === "P0001" && error.message?.startsWith("Cannot delete user:")) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error.code === "23503") {
      return NextResponse.json(
        { error: "This user still has related records that could not be removed. No changes were saved." },
        { status: 409 }
      );
    }
    console.error("BAO user deletion failed:", error.code || error.name);
    return NextResponse.json(
      { error: "Unable to delete the user. Please try again." },
      { status: 500 }
    );
  }
}

export const DELETE = withCatalogInvalidation(handleDELETE);
