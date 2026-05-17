import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [rows] = await db.query(
      `SELECT o.id, o.status, o.total, o.created_at, o.seller_note,
              u.name as buyer_name, u.email as buyer_email,
              p.name as product_name, oi.quantity, oi.price
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       JOIN products p ON p.id = oi.product_id
       JOIN users u ON u.id = o.user_id
       WHERE p.seller_id = $1
       ORDER BY o.created_at DESC`,
      [session.user.id]
    );

    return NextResponse.json(rows);
  } catch (err) {
    console.error("seller/orders error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}