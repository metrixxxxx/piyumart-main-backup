import { NextResponse } from "next/server";
import { getBaoAccess } from "@/lib/bao-access";
import { db } from "@/lib/db";

const PAGE_SIZE = 50;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value) {
  if (!DATE_PATTERN.test(value || "")) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function getDefaultRange() {
  const to = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(new Date())
    .filter((part) => part.type !== "literal")
    .reduce((parts, part) => ({ ...parts, [part.type]: part.value }), {});
  const toDate = `${to.year}-${to.month}-${to.day}`;
  const fromDate = new Date(`${toDate}T00:00:00.000Z`);
  fromDate.setUTCDate(fromDate.getUTCDate() - 29);
  return { from: fromDate.toISOString().slice(0, 10), to: toDate };
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
    const action = (searchParams.get("action") || "").trim();
    const entityType = (searchParams.get("entity_type") || "").trim();
    const search = (searchParams.get("search") || "").trim();
    const requestedPage = Number(searchParams.get("page") || 1);

    if (!isValidDate(from) || !isValidDate(to) || from > to) {
      return NextResponse.json({ error: "Select a valid date range." }, { status: 400 });
    }
    if (action.length > 100 || entityType.length > 100 || search.length > 200) {
      return NextResponse.json({ error: "Audit filters exceed the allowed length." }, { status: 400 });
    }
    if (!Number.isSafeInteger(requestedPage) || requestedPage < 1 || requestedPage > 10000) {
      return NextResponse.json({ error: "Invalid audit log page." }, { status: 400 });
    }

    const conditions = [
      "al.created_at >= ($1::date::timestamp AT TIME ZONE 'Asia/Manila')",
      "al.created_at < (($2::date + INTERVAL '1 day')::timestamp AT TIME ZONE 'Asia/Manila')",
    ];
    const values = [from, to];
    if (action) {
      values.push(action);
      conditions.push(`al.action = $${values.length}`);
    }
    if (entityType) {
      values.push(entityType);
      conditions.push(`al.entity_type = $${values.length}`);
    }
    if (search) {
      values.push(`%${search}%`);
      const parameter = `$${values.length}`;
      conditions.push(`(
        al.action ILIKE ${parameter}
        OR al.entity_type ILIKE ${parameter}
        OR COALESCE(al.entity_id, '') ILIKE ${parameter}
        OR COALESCE(al.reason, '') ILIKE ${parameter}
        OR al.metadata::text ILIKE ${parameter}
        OR CONCAT_WS(' ', actor.name, actor.last_name) ILIKE ${parameter}
      )`);
    }
    const whereClause = `WHERE ${conditions.join(" AND ")}`;
    const joins = `
      FROM bao_audit_logs AS al
      LEFT JOIN users AS actor ON actor.id = al.actor_id
    `;

    const [countRows] = await db.query(
      `SELECT COUNT(*) AS count ${joins} ${whereClause}`,
      values
    );
    const totalRows = Number(countRows[0]?.count || 0);
    const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
    const page = Math.min(requestedPage, totalPages);
    const offset = (page - 1) * PAGE_SIZE;
    const [logs] = await db.query(
      `SELECT
         al.id, al.actor_id, al.action, al.entity_type, al.entity_id,
         al.reason, al.metadata, al.created_at,
         actor.name AS actor_name, actor.last_name AS actor_last_name,
         actor.role AS actor_role
       ${joins}
       ${whereClause}
       ORDER BY al.created_at DESC, al.id DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, PAGE_SIZE, offset]
    );

    return NextResponse.json(
      {
        logs,
        page: { current: page, pageSize: PAGE_SIZE, totalRows, totalPages },
        range: { from, to },
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    console.error("BAO audit log request failed:", error);
    return NextResponse.json({ error: "Unable to load audit logs." }, { status: 500 });
  }
}
