import { db } from "@/lib/db";
import { getMarketplaceAccount } from "@/lib/seller-access";
import { pickupProofResponse } from "@/lib/pickup-proof";

export async function GET(_req, { params }) {
  try {
    const user = await getMarketplaceAccount();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.status !== "active" || !["user", "seller"].includes(user.role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) return Response.json({ error: "Invalid order ID." }, { status: 400 });
    const [rows] = await db.query(`SELECT o.id, o.pickup_proof_path FROM orders o WHERE o.id=$1
      AND (o.user_id=$2 OR o.seller_id=$2 OR (o.seller_id IS NULL AND EXISTS (
        SELECT 1 FROM order_items oi JOIN products p ON p.id=oi.product_id
        WHERE oi.order_id=o.id AND p.seller_id=$2)))`, [id, user.id]);
    if (!rows[0]) return Response.json({ error: "Order not found." }, { status: 404 });
    return await pickupProofResponse(rows[0]);
  } catch (error) {
    console.error("Pickup photo access failed:", error);
    return Response.json({ error: "Unable to open the proof photo. Please try again." }, { status: error.status || 500 });
  }
}
