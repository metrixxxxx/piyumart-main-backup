import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    let rows;
    if (session?.user?.id) {
      const [loggedInRows] = await db.query(
        "SELECT * FROM products WHERE seller_id != $1 AND is_visible = true",
        [session.user.id]
      );
      rows = loggedInRows;
    } else {
      const [guestRows] = await db.query(
        "SELECT * FROM products WHERE is_visible = true"
      );
      rows = guestRows;
    }

    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}