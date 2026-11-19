import { NextResponse } from "next/server";
import { getBaoAccess } from "@/lib/bao-access";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const access = await getBaoAccess();
    if (!access.session) {
      return NextResponse.json(
        { error: access.status === 401 ? "Unauthorized" : "Forbidden" },
        { status: access.status }
      );
    }

    const [users] = await db.query(
      `SELECT id, name, email, role
       FROM users
       WHERE role NOT IN ('admin', 'bao')
       ORDER BY created_at DESC, id DESC`
    );

    return NextResponse.json(users, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("BAO user list request failed:", error);
    return NextResponse.json(
      { error: "Unable to load users." },
      { status: 500 }
    );
  }
}
