import { NextResponse } from "next/server";
import { getBaoAccess } from "@/lib/bao-access";
import { db } from "@/lib/db";

const REPORT_STATUSES = [
  "pending",
  "under_investigation",
  "resolved",
  "rejected",
];
const REPORT_TYPES = ["product", "seller", "transaction", "other"];
const PAGE_SIZE = 30;

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
    const status = (searchParams.get("status") || "all").toLowerCase();
    const reportType = (searchParams.get("type") || "all").toLowerCase();
    const search = (searchParams.get("search") || "").trim();
    const requestedPage = Number(searchParams.get("page") || 1);

    if (status !== "all" && !REPORT_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid report status filter." }, { status: 400 });
    }
    if (reportType !== "all" && !REPORT_TYPES.includes(reportType)) {
      return NextResponse.json({ error: "Invalid report type filter." }, { status: 400 });
    }
    if (search.length > 200) {
      return NextResponse.json({ error: "Search text must be 200 characters or fewer." }, { status: 400 });
    }
    if (!Number.isSafeInteger(requestedPage) || requestedPage < 1 || requestedPage > 10000) {
      return NextResponse.json({ error: "Invalid report page." }, { status: 400 });
    }

    const conditions = [];
    const values = [];
    if (status !== "all") {
      values.push(status);
      conditions.push(`r.status = $${values.length}`);
    }
    if (reportType !== "all") {
      values.push(reportType);
      conditions.push(`r.report_type = $${values.length}`);
    }
    if (search) {
      values.push(`%${search}%`);
      const parameter = `$${values.length}`;
      conditions.push(`(
        r.id::text ILIKE ${parameter}
        OR r.description ILIKE ${parameter}
        OR r.related_order_id::text ILIKE ${parameter}
        OR CONCAT_WS(' ', reporter.name, reporter.last_name) ILIKE ${parameter}
        OR COALESCE(reporter.email, '') ILIKE ${parameter}
        OR COALESCE(product.name, '') ILIKE ${parameter}
        OR CONCAT_WS(' ', seller.name, seller.last_name) ILIKE ${parameter}
        OR CONCAT_WS(' ', assignee.name, assignee.last_name) ILIKE ${parameter}
      )`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const joins = `
      FROM marketplace_reports AS r
      JOIN users AS reporter ON reporter.id = r.reporter_id
      LEFT JOIN users AS assignee ON assignee.id = r.assigned_to
      LEFT JOIN products AS product ON product.id = r.related_product_id
      LEFT JOIN users AS seller ON seller.id = r.related_seller_id
    `;
    const [countRows] = await db.query(
      `SELECT COUNT(*) AS count
       ${joins}
       ${whereClause}`,
      values
    );
    const totalRows = Number(countRows[0]?.count || 0);
    const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
    const page = Math.min(requestedPage, totalPages);
    const offset = (page - 1) * PAGE_SIZE;
    const [reports] = await db.query(
      `SELECT
         r.id, r.reporter_id, r.report_type, r.description, r.related_product_id,
         r.related_seller_id, r.related_order_id, r.status, r.assigned_to,
         r.resolution, r.resolved_at, r.created_at, r.updated_at,
         reporter.name AS reporter_name, reporter.last_name AS reporter_last_name,
         reporter.email AS reporter_email,
         assignee.name AS assignee_name, assignee.last_name AS assignee_last_name,
         product.name AS product_name,
         seller.name AS seller_name, seller.last_name AS seller_last_name
       ${joins}
       ${whereClause}
       ORDER BY
         CASE r.status WHEN 'pending' THEN 0 WHEN 'under_investigation' THEN 1 ELSE 2 END,
         r.updated_at DESC, r.created_at DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, PAGE_SIZE, offset]
    );
    const [assignees] = await db.query(
      `SELECT id, name, last_name, role
       FROM users
       WHERE role IN ('admin', 'bao') AND status = 'active'
       ORDER BY role ASC, name ASC, last_name ASC, id ASC`
    );

    return NextResponse.json(
      {
        reports,
        assignees,
        filters: {
          statuses: REPORT_STATUSES,
          types: REPORT_TYPES,
        },
        page: { current: page, pageSize: PAGE_SIZE, totalRows, totalPages },
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    console.error("BAO report list request failed:", error);
    return NextResponse.json({ error: "Unable to load marketplace reports." }, { status: 500 });
  }
}
