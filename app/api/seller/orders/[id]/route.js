import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isActiveSellerAccount } from "@/lib/seller-access";
import { transitionOrder } from "@/lib/orders/fulfillment";

export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isActiveSellerAccount(session.user.id))) {
      return NextResponse.json({ error: "An active account is required to manage seller orders." }, { status: 403 });
    }

    const { id } = await params;
    const orderId = Number(id);
    if (!Number.isSafeInteger(orderId) || orderId < 1) return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
    const body = await req.json();
    return NextResponse.json(await transitionOrder(session.user.id, orderId, body, null, { sellerOnly: true }));
  } catch (err) {
    if (err instanceof SyntaxError) return NextResponse.json({ error: "Invalid order update." }, { status: 400 });
    console.error("Seller order PATCH error:", err);
    return NextResponse.json({ error: err.status ? err.message : "Unable to update order." }, { status: err.status || 500 });
  }
}
