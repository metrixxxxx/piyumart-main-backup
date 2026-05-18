import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { notify } from "@/lib/notify";

export async function GET() {
  const session = await requireAdmin();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const [rows] = await db.query(`
    SELECT o.*, u.name as buyer_name, u.email as buyer_email
    FROM orders o
    JOIN users u ON o.user_id = u.id
    ORDER BY o.id DESC
  `);

  return Response.json(rows);
}

