import "server-only";
import { db } from "@/lib/db";

// Read the original allocations. Online commissions must never be credited again
// or recalculated using today's item prices or the legacy cash rate schedule.
export const commissionRecordsSql = `WITH commission_records AS (
  SELECT 'cod:' || oc.id::text AS id, oc.order_id, o.seller_id,
    oc.commission_rate, oc.order_amount, oc.order_amount AS gross_amount,
    0::numeric AS refunded_amount, oc.commission_amount, oc.seller_earnings,
    oc.created_at, COALESCE(o.payment_method, 'cod') AS payment_method,
    o.status AS order_status, o.payment_status, NULL::text AS payment_reference,
    true AS is_earned
  FROM order_commissions oc JOIN orders o ON o.id = oc.order_id
  WHERE o.status = 'completed' AND COALESCE(o.payment_method, 'cod') <> 'paymongo'
  UNION ALL
  SELECT 'online:' || a.order_id::text, a.order_id, a.seller_id,
    ROUND(a.commission_amount * 100 / a.gross_amount, 2),
    a.gross_amount - a.refunded_amount, a.gross_amount,
    a.refunded_amount, a.commission_amount - a.commission_refunded,
    a.seller_amount - a.seller_refunded, COALESCE(p.paid_at, p.created_at),
    o.payment_method, o.status, o.payment_status, p.reference,
    o.status = 'completed'
  FROM payment_allocations a
  JOIN payments p ON p.id = a.payment_id
  JOIN orders o ON o.id = a.order_id
  WHERE o.payment_method = 'paymongo' AND p.livemode = false
    AND p.status IN ('paid', 'partially_refunded', 'refunded')
)`;

const totalsSql = `COUNT(*) AS transaction_count,
  COUNT(*) FILTER (WHERE is_earned) AS order_count,
  COALESCE(SUM(order_amount) FILTER (WHERE is_earned), 0) AS order_amount,
  COALESCE(SUM(commission_amount) FILTER (WHERE is_earned), 0) AS commission_amount,
  COALESCE(SUM(seller_earnings) FILTER (WHERE is_earned), 0) AS seller_earnings,
  COALESCE(SUM(commission_amount) FILTER (
    WHERE NOT is_earned AND order_status <> 'cancelled'
  ), 0) AS pending_commission_amount`;

const rangeSql = `created_at >= ($1::date::timestamp AT TIME ZONE 'Asia/Manila')
  AND created_at < (($2::date + INTERVAL '1 day')::timestamp AT TIME ZONE 'Asia/Manila')`;

// Preserve attribution for legacy cash orders without a seller snapshot.
const attributionSql = `LEFT JOIN LATERAL (
  SELECT CASE WHEN COUNT(DISTINCT p.seller_id) = 1 THEN MIN(p.seller_id) END AS seller_id
  FROM order_items oi JOIN products p ON p.id = oi.product_id
  WHERE oi.order_id = r.order_id AND r.seller_id IS NULL
) attribution ON true`;

export async function readCommissionReport({ from, to, requestedPage, pageSize }) {
  const values = [from, to];
  const [currentRates, rateHistory, allTimeTotals, rangeTotals, sellerTotals, historyCount] = await Promise.all([
    db.query(`SELECT id, percentage, effective_at, changed_by, notes, created_at
      FROM bao_commission_rates WHERE effective_at <= NOW()
      ORDER BY effective_at DESC, created_at DESC, id DESC LIMIT 1`),
    db.query(`SELECT r.id, r.percentage, r.effective_at, r.changed_by, r.notes, r.created_at,
      u.name AS actor_name, u.last_name AS actor_last_name
      FROM bao_commission_rates r LEFT JOIN users u ON u.id = r.changed_by
      ORDER BY r.effective_at DESC, r.created_at DESC, r.id DESC`),
    db.query(`${commissionRecordsSql} SELECT ${totalsSql} FROM commission_records`),
    db.query(`${commissionRecordsSql} SELECT ${totalsSql} FROM commission_records WHERE ${rangeSql}`, values),
    db.query(`${commissionRecordsSql}, attributed AS (
      SELECT r.*, COALESCE(r.seller_id, attribution.seller_id) AS resolved_seller_id
      FROM commission_records r ${attributionSql} WHERE ${rangeSql}
    ) SELECT r.resolved_seller_id AS seller_id,
      COALESCE(NULLIF(BTRIM(CONCAT_WS(' ', u.name, u.last_name)), ''), 'Unattributed seller') AS seller_name,
      COUNT(*) AS order_count, SUM(r.order_amount) AS order_amount,
      SUM(r.commission_amount) AS commission_amount, SUM(r.seller_earnings) AS seller_earnings
      FROM attributed r LEFT JOIN users u ON u.id = r.resolved_seller_id
      GROUP BY r.resolved_seller_id, seller_name
      ORDER BY SUM(r.commission_amount) DESC, seller_name ASC, r.resolved_seller_id ASC`, values),
    db.query(`${commissionRecordsSql} SELECT COUNT(*) AS count FROM commission_records WHERE ${rangeSql}`, values),
  ]);

  const totalRows = Number(historyCount[0][0]?.count || 0);
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const [records] = await db.query(`${commissionRecordsSql}, selected AS (
    SELECT * FROM commission_records WHERE ${rangeSql}
    ORDER BY created_at DESC, order_id DESC LIMIT $3 OFFSET $4
  ) SELECT r.*,
    COALESCE(NULLIF(BTRIM(CONCAT_WS(' ', u.name, u.last_name)), ''), 'Unattributed seller') AS seller_name
    FROM selected r ${attributionSql}
    LEFT JOIN users u ON u.id = COALESCE(r.seller_id, attribution.seller_id)
    ORDER BY r.created_at DESC, r.order_id DESC`, [...values, pageSize, (page - 1) * pageSize]);

  return {
    currentRate: currentRates[0][0] || null,
    rateHistory: rateHistory[0],
    totals: { allTime: allTimeTotals[0][0], selectedRange: rangeTotals[0][0] },
    sellers: sellerTotals[0],
    history: { records, page, pageSize, totalRows, totalPages },
    range: { from, to },
  };
}
