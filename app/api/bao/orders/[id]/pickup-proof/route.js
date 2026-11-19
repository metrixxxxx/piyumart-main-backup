import { getBaoAccess } from "@/lib/bao-access";
import { db } from "@/lib/db";
import { pickupProofResponse } from "@/lib/pickup-proof";

export async function GET(_req, { params }) {
  try {
    const access = await getBaoAccess();
    if (!access.session) return Response.json({ error: "Forbidden" }, { status: access.status });
    const { id } = await params;
    if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) return Response.json({ error: "Invalid order ID." }, { status: 400 });
    const [rows] = await db.query("SELECT id, pickup_proof_path FROM orders WHERE id=$1", [id]);
    if (!rows[0]) return Response.json({ error: "Order not found." }, { status: 404 });
    return await pickupProofResponse(rows[0]);
  } catch (error) {
    console.error("BAO pickup photo access failed:", error);
    return Response.json({ error: "Unable to open the proof photo. Please try again." }, { status: error.status || 500 });
  }
}
