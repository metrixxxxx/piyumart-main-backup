import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Now that orders are split per seller, we find orders that contain
    // at least one product belonging to this seller
    const [rows] = await db.query(
  `SELECT
     o.id, o.status, o.total, o.created_at, o.seller_note,
     u.name AS buyer_name, u.email AS buyer_email,
     json_agg(json_build_object(
       'name',      COALESCE(oi.name, p.name),
       'quantity',  oi.quantity,
       'price',     oi.price,
       'variant',   oi.variant,
       'image_url', COALESCE(oi.image_url, p.image_url)
     ) ORDER BY oi.id) AS items
   FROM orders o
   JOIN order_items oi ON oi.order_id = o.id
   LEFT JOIN products p ON p.id = oi.product_id
   JOIN users u ON u.id = o.user_id
   WHERE p.seller_id = $1
   GROUP BY o.id, o.status, o.total, o.created_at, o.seller_note,
            u.name, u.email
   ORDER BY o.created_at DESC`,
  [session.user.id]
);

    return NextResponse.json(rows);
  } catch (err) {
    console.error("seller/orders error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}