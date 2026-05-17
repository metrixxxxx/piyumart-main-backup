import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  try {
    let query = `SELECT id, name, email, status, created_at FROM users WHERE role='seller'`;
    const params = [];

    if (status) {
      params.push(status);
      query += ` AND status=$${params.length}`;
    }

    query += ` ORDER BY created_at DESC`;

    const [sellers] = await db.query(query, params);
    return NextResponse.json(sellers);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}