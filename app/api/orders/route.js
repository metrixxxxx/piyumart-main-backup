import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buyerOrders } from "@/lib/orders/read-model";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { createMarketplaceOrders, startCheckout } from "@/lib/payments/checkout";
import { requireBuyer, financeResponse } from "@/lib/payments/security";

export async function GET(req) {
  try {
    const session=await getServerSession(authOptions);
    if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
    const result=await buyerOrders(req,session.user.id);return NextResponse.json(result.rows,{headers:result.headers});
  }catch(error){console.error("Orders GET failed:",error);return NextResponse.json({error:error.status?error.message:"Unable to load orders."},{status:error.status||503});}
}

export async function POST(req) {
  try {
    const user = await requireBuyer();
    const result = await createMarketplaceOrders(user.id, await req.json(), req.headers.get("Idempotency-Key"));
    const payment = result.paymentId ? await startCheckout(result.paymentId, user.id) : null;
    return Response.json({ success: true, ...result, checkoutUrl: payment?.checkout_url || null });
  } catch (error) { return financeResponse(error); }
}

export async function DELETE(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const orderId = Number(params.id);

    // Verify the order exists and belongs to this buyer
    const [rows] = await db.query(
      `SELECT id, status, user_id FROM orders WHERE id = $1`,
      [orderId]
    );

    const order = rows[0];
    if (!order)
      return NextResponse.json({ error: "Order not found" }, { status: 404 });

    if (Number(order.user_id) !== Number(session.user.id))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const deletable = ["cancelled", "completed"];
    if (!deletable.includes(order.status))
      return NextResponse.json(
        { error: "Only cancelled or completed orders can be deleted." },
        { status: 400 }
      );

    // Delete order_items first (foreign key), then the order
    await db.query(`DELETE FROM order_items WHERE order_id = $1`, [orderId]);
    await db.query(`DELETE FROM orders WHERE id = $1`, [orderId]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Order DELETE error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
