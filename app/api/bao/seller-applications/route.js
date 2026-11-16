import { getBaoAccess } from "@/lib/bao-access";
import { db } from "@/lib/db";

export async function GET(req) {
  try {
    const access = await getBaoAccess();
    if (!access.session) return Response.json({ error: "Forbidden" }, { status: access.status });
    const status = new URL(req.url).searchParams.get("status") || "pending";
    if (!["pending", "approved", "rejected"].includes(status)) return Response.json({ error: "Invalid status." }, { status: 400 });
    const [applications] = await db.query(
      `SELECT a.id, a.department, a.note, a.status, a.remarks, a.submitted_at, a.reviewed_at,
              u.name, u.last_name, u.email
       FROM seller_applications a JOIN users u ON u.id = a.user_id
       WHERE a.status = $1 ORDER BY a.submitted_at DESC, a.id DESC`, [status]
    );
    return Response.json({ applications }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Seller application list failed:", error);
    return Response.json({ error: "Unable to load applications." }, { status: 500 });
  }
}
