import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { transitionOrder } from "@/lib/orders/fulfillment";
import { PICKUP_PROOF_MAX_BYTES } from "@/lib/orders/pickup-proof-policy";

export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const orderId = Number(id);
    if (!Number.isSafeInteger(orderId) || orderId < 1) return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });

    if (Number(req.headers.get("content-length")) > PICKUP_PROOF_MAX_BYTES + 1024 * 1024) {
      return NextResponse.json({ error: "Proof photos must be 5 MB or smaller." }, { status: 413 });
    }
    let body, proofFile;
    try {
      if (req.headers.get("content-type")?.startsWith("multipart/form-data")) {
        const form = await req.formData();
        body = { action: form.get("action"), status: form.get("status") };
        proofFile = form.get("pickup_proof");
      } else body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid order update." }, { status: 400 });
    }
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid order update." }, { status: 400 });
    return NextResponse.json(await transitionOrder(session.user.id, orderId, body, proofFile));
  } catch (err) {
    console.error("PATCH /orders/[id] error:", err);
    return NextResponse.json({ error: err.status ? err.message : "Unable to update order." }, { status: err.status || 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const orderId = Number(id);
    if (isNaN(orderId)) return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });

    const [rows] = await db.query(`SELECT id, status, user_id, payment_method FROM orders WHERE id = $1`, [orderId]);
    const order = rows[0];

    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    if (Number(order.user_id) !== Number(session.user.id))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (order.payment_method === "paymongo") return NextResponse.json({ error: "Online orders are retained for financial history." }, { status: 409 });

    if (!["cancelled", "completed"].includes(order.status))
      return NextResponse.json(
        { error: "Only cancelled or completed orders can be deleted." },
        { status: 400 }
      );

    const [commissionRows] = await db.query(
      `SELECT 1 FROM order_commissions WHERE order_id = $1 LIMIT 1`,
      [orderId]
    );
    if (commissionRows.length) {
      return NextResponse.json(
        { error: "Orders with recorded BAO commissions cannot be deleted." },
        { status: 409 }
      );
    }

    await db.query(`DELETE FROM order_items WHERE order_id = $1`, [orderId]);
    await db.query(`DELETE FROM orders WHERE id = $1`, [orderId]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /orders/[id] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
