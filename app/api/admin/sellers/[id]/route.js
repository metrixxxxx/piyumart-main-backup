import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function PATCH(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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