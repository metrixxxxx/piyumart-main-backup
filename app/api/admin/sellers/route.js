import { getAdminAccess } from "@/lib/admin-session";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req) {
  const access = await getAdminAccess();
  if (!access.admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: access.status });
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