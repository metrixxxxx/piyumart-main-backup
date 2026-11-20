import { withCatalogInvalidation } from "@/lib/catalog-cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { isActiveSellerAccount } from "@/lib/seller-access";

async function ownsProduct(userId, productId) {
  const [rows] = await db.query(
    "SELECT id FROM products WHERE id=$1 AND seller_id=$2",
    [productId, userId]
  );
  return rows.length > 0;
}

async function handleDELETE(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isActiveSellerAccount(session.user.id))) {
    return NextResponse.json({ error: "An active verified seller account is required to manage listings." }, { status: 403 });
  }

  const { id } = await params;
  if (!(await ownsProduct(session.user.id, id)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.query("DELETE FROM products WHERE id=$1 AND seller_id=$2", [id, session.user.id]);
  return NextResponse.json({ success: true });
}

async function handlePATCH(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isActiveSellerAccount(session.user.id))) {
    return NextResponse.json({ error: "An active verified seller account is required to manage listings." }, { status: 403 });
  }

  const { id } = await params;
  if (!(await ownsProduct(session.user.id, id)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payload = await req.json();
  const is_visible =
    payload.is_visible === true ||
    payload.is_visible === 1 ||
    payload.is_visible === "1" ||
    String(payload.is_visible).toLowerCase() === "true";

  const [updated] = await db.query(
    "UPDATE products SET is_visible=$1 WHERE id=$2 AND seller_id=$3 AND status<>'suspended' RETURNING id",
    [is_visible, id, session.user.id]
  );
  if (!updated.length) {
    return NextResponse.json(
      { error: "This listing is suspended by BAO and cannot be changed." },
      { status: 409 }
    );
  }
  return NextResponse.json({ success: true });
}

export const DELETE = withCatalogInvalidation(handleDELETE);
export const PATCH = withCatalogInvalidation(handlePATCH);
