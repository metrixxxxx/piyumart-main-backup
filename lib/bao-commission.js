// Serialize rate changes with order completion snapshots.
export async function lockCommissionSchedule(client) {
  await client.query("SELECT pg_advisory_xact_lock($1, $2)", [817206, 3]);
}

export async function recordOrderCommission(client, orderId) {
  await lockCommissionSchedule(client);

  const { rows } = await client.query(
    `INSERT INTO order_commissions
       (order_id, commission_rate_id, commission_rate, order_amount,
        commission_amount, seller_earnings)
     SELECT
       o.id,
       rate.id,
       rate.percentage,
       o.total,
       ROUND(o.total * rate.percentage / 100, 2),
       o.total - ROUND(o.total * rate.percentage / 100, 2)
     FROM orders AS o
     JOIN LATERAL (
       SELECT id, percentage
       FROM bao_commission_rates
       WHERE effective_at <= (o.created_at AT TIME ZONE current_setting('TimeZone'))
       ORDER BY effective_at DESC, created_at DESC, id DESC
       LIMIT 1
     ) AS rate ON true
     WHERE o.id = $1
       AND o.status = 'completed'
       AND o.completed_at IS NOT NULL
       AND o.total IS NOT NULL
       AND o.total >= 0
     ON CONFLICT (order_id) DO NOTHING
     RETURNING id, order_id, commission_rate_id, commission_rate, order_amount,
               commission_amount, seller_earnings, created_at`,
    [orderId]
  );

  return rows[0] || null;
}
