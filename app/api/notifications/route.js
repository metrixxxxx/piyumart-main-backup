
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
 
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json([], { status: 401 });

  const [rows] = await db.query(
    "SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50",
    [session.user.id]
  );
  return NextResponse.json(rows);
}

export async function PATCH() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await db.query(
    "UPDATE notifications SET is_read = true WHERE user_id = $1",  // ← was is_read = 1
    [session.user.id]
  );
  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await db.query(
    "DELETE FROM notifications WHERE user_id = $1",
    [session.user.id]
  );
  return NextResponse.json({ success: true });
}