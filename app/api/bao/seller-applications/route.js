import { getBaoAccess } from "@/lib/bao-access";
import { db } from "@/lib/db";
import { readPagination,pageHeaders } from "@/lib/pagination";

export async function GET(req) {
  try {
    const access = await getBaoAccess();
    if (!access.session) return Response.json({ error: "Forbidden" }, { status: access.status });
    const status = new URL(req.url).searchParams.get("status") || "pending";
    if (!["pending", "approved", "rejected"].includes(status)) return Response.json({ error: "Invalid status." }, { status: 400 });
    const page=readPagination(req);
    const [counts]=await db.query("SELECT COUNT(*)::integer AS total FROM seller_applications WHERE status=$1",[status]);
    const total=Number(counts[0].total);
    if(page.offset>=total)return Response.json({applications:[]},{headers:pageHeaders(page,total)});
    const [applications] = await db.query(
      `SELECT a.id, a.department, a.note, a.status, a.remarks, a.submitted_at, a.reviewed_at,
              u.name, u.last_name, u.email
       FROM seller_applications a JOIN users u ON u.id = a.user_id
       WHERE a.status = $1 ORDER BY a.submitted_at DESC, a.id DESC LIMIT $2 OFFSET $3`, [status,page.pageSize,page.offset]
    );
    return Response.json({ applications }, { headers:pageHeaders(page,total) });
  } catch (error) {
    console.error("Seller application list failed:", error);
    return Response.json({ error: error.status?error.message:"Unable to load applications." }, { status: error.status||503 });
  }
}
