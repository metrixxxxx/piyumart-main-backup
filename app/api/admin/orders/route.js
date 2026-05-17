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

export async function PUT(req) {
  const { id, status } = await req.json();
  await db.query("UPDATE orders SET status=$1 WHERE id=$2", [status, id]);

  const [orderRows] = await db.query("SELECT user_id FROM orders WHERE id=$1", [id]);

  if (orderRows[0]) {
    const statusLabels = { pending: "Pending", otw: "On the way", delivered: "Delivered" };
    await notify({
      userId: orderRows[0].user_id,
      type: "order_status",
      message: `Your order #${id} is now ${statusLabels[status] || status}.`,
    });
  }

  if (global.io) global.io.emit("orders:updated", { id, status });

  return Response.json({ success: true });
}