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

    const [orders] = await db.query(`
      SELECT o.*, u.name AS buyer_name, u.email AS buyer_email
      FROM orders AS o
      LEFT JOIN users AS u ON u.id = o.user_id
      ORDER BY o.id DESC
    `);

    return NextResponse.json(orders.map(({ pickup_proof_path, ...order }) => ({ ...order, has_pickup_proof: Boolean(pickup_proof_path) })), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("BAO order list request failed:", error);
    return NextResponse.json(
      { error: "Unable to load orders." },
      { status: 500 }
    );
  }
}
