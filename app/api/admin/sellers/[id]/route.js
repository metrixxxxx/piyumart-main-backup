import { getAdminAccess } from "@/lib/admin-session";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function PATCH(req, { params }) {
  const access = await getAdminAccess();
  if (!access.admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: access.status });
  }

  const { action } = await req.json();
  if (!["accept", "reject"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const newStatus = action === "accept" ? "active" : "rejected";
  const { id } = await params;

  try {
    await db.query(
      `UPDATE users SET status=$1 WHERE id=$2 AND role='seller'`,
      [newStatus, id]
    );
    return NextResponse.json({ message: `Seller ${action}ed successfully` });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}