import { NextResponse } from "next/server";
import { getBaoAccess } from "@/lib/bao-access";
import { db } from "@/lib/db";
import { lockCommissionSchedule } from "@/lib/bao-commission";

const PAGE_SIZE = 50;
const PROPOSED_INITIAL_RATE = 3;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function formatManilaDate(date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map(({ type, value }) => [type, value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getDefaultRange() {
  const to = formatManilaDate(new Date());
  const from = new Date(`${to}T00:00:00.000Z`);
  from.setUTCDate(from.getUTCDate() - 29);
  return { from: formatDate(from), to };
}

function isValidDate(value) {
  if (!DATE_PATTERN.test(value || "")) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && formatDate(date) === value;
}

export async function GET(req) {
  try {
    const access = await getBaoAccess();
    if (!access.session) {
      return NextResponse.json(
        { error: access.status === 401 ? "Unauthorized" : "Forbidden" },
        { status: access.status }
      );
    }

    const { searchParams } = new URL(req.url);
    const defaultRange = getDefaultRange();
    const from = searchParams.get("from") || defaultRange.from;
    const to = searchParams.get("to") || defaultRange.to;
    const requestedPage = Number(searchParams.get("page") || 1);
    if (!isValidDate(from) || !isValidDate(to) || from > to) {
      return NextResponse.json({ error: "Select a valid date range." }, { status: 400 });
    }
    if (!Number.isSafeInteger(requestedPage) || requestedPage < 1 || requestedPage > 10000) {
      return NextResponse.json({ error: "Invalid commission history page." }, { status: 400 });
    }

    const rangeValues = [from, to];
    const [currentRates, rateHistory, allTimeTotals, rangeTotals, sellerTotals, historyCount] =
      await Promise.all([
        db.query(
          `SELECT id, percentage, effective_at, changed_by, notes, created_at
           FROM bao_commission_rates
           WHERE effective_at <= NOW()
           ORDER BY effective_at DESC, created_at DESC, id DESC
           LIMIT 1`
        ),
        db.query(
          `SELECT
             r.id, r.percentage, r.effective_at, r.changed_by, r.notes, r.created_at,
             u.name AS actor_name, u.last_name AS actor_last_name
           FROM bao_commission_rates AS r
           LEFT JOIN users AS u ON u.id = r.changed_by
           ORDER BY r.effective_at DESC, r.created_at DESC, r.id DESC`
        ),
        db.query(
          `SELECT
             COUNT(*) AS order_count,
             COALESCE(SUM(oc.order_amount), 0) AS order_amount,
             COALESCE(SUM(oc.commission_amount), 0) AS commission_amount,
             COALESCE(SUM(oc.seller_earnings), 0) AS seller_earnings
           FROM order_commissions AS oc
           JOIN orders AS o ON o.id = oc.order_id
           WHERE o.status = 'completed'`
        ),
        db.query(
          `SELECT
             COUNT(*) AS order_count,
             COALESCE(SUM(oc.order_amount), 0) AS order_amount,
             COALESCE(SUM(oc.commission_amount), 0) AS commission_amount,
             COALESCE(SUM(oc.seller_earnings), 0) AS seller_earnings
           FROM order_commissions AS oc
           JOIN orders AS o ON o.id = oc.order_id
           WHERE o.status = 'completed'
             AND oc.created_at >= ($1::date::timestamp AT TIME ZONE 'Asia/Manila')
             AND oc.created_at < (($2::date + INTERVAL '1 day')::timestamp AT TIME ZONE 'Asia/Manila')`,
          rangeValues
        ),
        db.query(
          `WITH attributed_commissions AS (
             SELECT
               oc.commission_amount,
               oc.order_amount,
               oc.seller_earnings,
               COALESCE(o.seller_id, attribution.seller_id) AS seller_id
             FROM order_commissions AS oc
             JOIN orders AS o ON o.id = oc.order_id AND o.status = 'completed'
             LEFT JOIN LATERAL (
               SELECT
                 CASE WHEN COUNT(DISTINCT p.seller_id) = 1 THEN MIN(p.seller_id) END AS seller_id
               FROM order_items AS oi
               JOIN products AS p ON p.id = oi.product_id
               WHERE oi.order_id = o.id
             ) AS attribution ON true
             WHERE oc.created_at >= ($1::date::timestamp AT TIME ZONE 'Asia/Manila')
               AND oc.created_at < (($2::date + INTERVAL '1 day')::timestamp AT TIME ZONE 'Asia/Manila')
           )
           SELECT
             ac.seller_id,
             COALESCE(
               NULLIF(CONCAT_WS(' ', u.name, u.last_name), ''),
               'Unattributed seller'
             ) AS seller_name,
             COUNT(*) AS order_count,
             SUM(ac.order_amount) AS order_amount,
             SUM(ac.commission_amount) AS commission_amount,
             SUM(ac.seller_earnings) AS seller_earnings
           FROM attributed_commissions AS ac
           LEFT JOIN users AS u ON u.id = ac.seller_id
           GROUP BY ac.seller_id, seller_name
           ORDER BY SUM(ac.commission_amount) DESC, seller_name ASC`,
          rangeValues
        ),
        db.query(
          `SELECT COUNT(*) AS count
           FROM order_commissions AS oc
           JOIN orders AS o ON o.id = oc.order_id
           WHERE o.status = 'completed'
             AND oc.created_at >= ($1::date::timestamp AT TIME ZONE 'Asia/Manila')
             AND oc.created_at < (($2::date + INTERVAL '1 day')::timestamp AT TIME ZONE 'Asia/Manila')`,
          rangeValues
        ),
      ]);

    const totalRows = Number(historyCount[0][0]?.count || 0);
    const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
    const page = Math.min(requestedPage, totalPages);
    const offset = (page - 1) * PAGE_SIZE;
    const [history] = await db.query(
      `WITH attributed_commissions AS (
         SELECT
           oc.id, oc.order_id, oc.commission_rate, oc.order_amount,
           oc.commission_amount, oc.seller_earnings, oc.created_at,
           COALESCE(o.seller_id, attribution.seller_id) AS seller_id
         FROM order_commissions AS oc
         JOIN orders AS o ON o.id = oc.order_id AND o.status = 'completed'
         LEFT JOIN LATERAL (
           SELECT
             CASE WHEN COUNT(DISTINCT p.seller_id) = 1 THEN MIN(p.seller_id) END AS seller_id
           FROM order_items AS oi
           JOIN products AS p ON p.id = oi.product_id
           WHERE oi.order_id = o.id
         ) AS attribution ON true
         WHERE oc.created_at >= ($1::date::timestamp AT TIME ZONE 'Asia/Manila')
           AND oc.created_at < (($2::date + INTERVAL '1 day')::timestamp AT TIME ZONE 'Asia/Manila')
       )
       SELECT
         ac.*,
         COALESCE(
           NULLIF(CONCAT_WS(' ', u.name, u.last_name), ''),
           'Unattributed seller'
         ) AS seller_name
       FROM attributed_commissions AS ac
       LEFT JOIN users AS u ON u.id = ac.seller_id
       ORDER BY ac.created_at DESC, ac.order_id DESC
       LIMIT $3 OFFSET $4`,
      [...rangeValues, PAGE_SIZE, offset]
    );

    return NextResponse.json(
      {
        proposedInitialRate: PROPOSED_INITIAL_RATE,
        currentRate: currentRates[0][0] || null,
        rateHistory: rateHistory[0],
        totals: {
          allTime: allTimeTotals[0][0],
          selectedRange: rangeTotals[0][0],
        },
        sellers: sellerTotals[0],
        history: {
          records: history,
          page,
          pageSize: PAGE_SIZE,
          totalRows,
          totalPages,
        },
        range: { from, to },
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    console.error("BAO commission report request failed:", error);
    return NextResponse.json(
      { error: "Unable to load commission records." },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const access = await getBaoAccess();
    if (!access.session) {
      return NextResponse.json(
        { error: access.status === 401 ? "Unauthorized" : "Forbidden" },
        { status: access.status }
      );
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid commission rate request." }, { status: 400 });
    }

    const percentageInput = body?.percentage;
    const percentage =
      typeof percentageInput === "number" ||
      (typeof percentageInput === "string" && percentageInput.trim() !== "")
        ? Number(percentageInput)
        : Number.NaN;
    const reason = typeof body?.reason === "string" ? body.reason.trim() : "";

    if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 100) {
      return NextResponse.json(
        { error: "Commission rate must be greater than 0% and no more than 100%." },
        { status: 400 }
      );
    }
    if (!reason) {
      return NextResponse.json(
        { error: "A reason is required to set or change the commission rate." },
        { status: 400 }
      );
    }
    if (reason.length > 1000) {
      return NextResponse.json(
        { error: "Reason must be 1,000 characters or fewer." },
        { status: 400 }
      );
    }

    const result = await db.transaction(async (client) => {
      await lockCommissionSchedule(client);
      const { rows: currentRows } = await client.query(
        `SELECT id, percentage, effective_at
         FROM bao_commission_rates
         WHERE effective_at <= clock_timestamp()
         ORDER BY effective_at DESC, created_at DESC, id DESC
         LIMIT 1`
      );
      const currentRate = currentRows[0] || null;

      if (currentRate && Number(currentRate.percentage) === percentage) {
        return { error: "The requested rate is already current.", status: 409 };
      }

      const { rows: insertedRows } = await client.query(
        `INSERT INTO bao_commission_rates (percentage, effective_at, changed_by, notes)
         VALUES ($1, clock_timestamp(), $2, $3)
         RETURNING id, percentage, effective_at, changed_by, notes, created_at`,
        [percentage, access.session.user.id, reason]
      );
      const rate = insertedRows[0];

      await client.query(
        `INSERT INTO bao_audit_logs
           (actor_id, action, entity_type, entity_id, reason, metadata)
         VALUES (
           $1, 'commission_rate_updated', 'commission_rate', $2, $3,
           jsonb_build_object(
             'previous_percentage', $4::numeric,
             'new_percentage', $5::numeric,
             'effective_at', $6::timestamptz
           )
         )`,
        [
          access.session.user.id,
          rate.id,
          reason,
          currentRate?.percentage ?? null,
          rate.percentage,
          rate.effective_at,
        ]
      );

      return { rate };
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(
      { success: true, rate: result.rate },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    console.error("BAO commission rate update failed:", error);
    return NextResponse.json(
      { error: "Unable to save the commission rate." },
      { status: 500 }
    );
  }
}
