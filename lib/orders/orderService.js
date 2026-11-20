import { db } from "@/lib/db";
import { restoreOrderStock } from "@/lib/payments/ledger";

export async function autoExpireOrders() {
  return db.transaction(async client => {
    const { rows } = await client.query(
      `SELECT * FROM orders
       WHERE status='pending' AND COALESCE(payment_method, 'cod') <> 'paymongo'
         AND created_at < NOW() - INTERVAL '1 minute'
       ORDER BY id FOR UPDATE SKIP LOCKED`
    );
    for (const order of rows) {
      await restoreOrderStock(client, order);
      await client.query("UPDATE orders SET status='cancelled', cancelled_at=NOW() WHERE id=$1", [order.id]);
    }
    return { success: true, count: rows.length };
  });
}
