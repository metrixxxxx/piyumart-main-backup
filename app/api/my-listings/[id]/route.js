import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

async function ownsProduct(userId, productId) {
  const [rows] = await db.query(
    "SELECT id FROM products WHERE id=$1 AND seller_id=$2",
    [productId, userId]
  );
  return rows.length > 0;
}

export async function DELETE(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!(await ownsProduct(session.user.id, id)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.query("DELETE FROM products WHERE id=$1 AND seller_id=$2", [id, session.user.id]);
  return NextResponse.json({ success: true });
}

export async function PATCH(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!(await ownsProduct(session.user.id, id)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payload = await req.json();
  const is_visible =
    payload.is_visible === true ||
    payload.is_visible === 1 ||
    payload.is_visible === "1" ||
    String(payload.is_visible).toLowerCase() === "true";

  await db.query(
    "UPDATE products SET is_visible=$1 WHERE id=$2 AND seller_id=$3",
    [is_visible, id, session.user.id]
  );
  return NextResponse.json({ success: true });
}