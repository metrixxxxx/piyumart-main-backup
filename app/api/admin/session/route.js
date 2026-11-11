import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/authOptions";
import { db } from "@/lib/db";
import { setAdminSession } from "@/lib/admin-session";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    const userId = Number(session?.user?.id);
    if (!Number.isSafeInteger(userId) || userId < 1) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [rows] = await db.query(
      `SELECT id, name, email, role, status, is_verified
       FROM users
       WHERE id = $1`,
      [userId]
    );
    const admin = rows[0];
    if (
      !admin ||
      admin.role !== "admin" ||
      admin.status !== "active" ||
      admin.is_verified !== true
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await setAdminSession(admin);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin session creation failed:", error);
    return NextResponse.json(
      { error: "Unable to start an admin session." },
      { status: 500 }
    );
  }
}
