import { db } from "@/lib/db";
import { getMarketplaceAccount } from "@/lib/seller-access";
import { getBaoAccess } from "@/lib/bao-access";

export async function GET(req) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const audience = new URL(req.url).searchParams.get("audience") || "marketplace";
    if (!["marketplace", "staff"].includes(audience)) {
      return Response.json({ error: "Invalid audience." }, { status: 400, headers });
    }
    let user;
    if (audience === "staff") {
      const access = await getBaoAccess();
      if (!access.session) return Response.json({ error: "Staff access is required." }, { status: access.status, headers });
      const [rows] = await db.query("SELECT id,role,status FROM users WHERE id=$1", [access.session.user.id]);
      user = rows[0];
      if (!user || user.status !== "active" || user.role !== "bao") {
        return Response.json({ error: "Forbidden." }, { status: 403, headers });
      }
    } else {
      user = await getMarketplaceAccount();
      if (!user) return Response.json({ error: "Please sign in." }, { status: 401, headers });
      if (user.status !== "active") return Response.json({ error: "Forbidden." }, { status: 403, headers });
    }
    const [rows] = await db.query(
      `INSERT INTO marketplace_realtime_channels(user_id) VALUES($1)
       ON CONFLICT(user_id) DO UPDATE SET user_id=EXCLUDED.user_id RETURNING topic`, [user.id]
    );
    return Response.json({ topic: `marketplace:${rows[0].topic}` }, { headers });
  } catch (error) {
    console.error("Realtime channel access failed:", error);
    return Response.json({ error: "Unable to connect live updates." }, { status: 503, headers });
  }
}
