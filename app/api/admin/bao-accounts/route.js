import { NextResponse } from "next/server";
import { getAdminAccess } from "@/lib/admin-session";
import { db } from "@/lib/db";

const PAGE_SIZE = 30;

export async function GET(req) {
  try {
    const access = await getAdminAccess();
    if (!access.admin) {
      return NextResponse.json(
        { error: access.status === 401 ? "Unauthorized" : "Forbidden" },
        { status: access.status }
      );
    }

    const { searchParams } = new URL(req.url);
    const search = (searchParams.get("search") || "").trim();
    const requestedPage = Number(searchParams.get("page") || 1);
    if (search.length > 200) {
      return NextResponse.json(
        { error: "Search text must be 200 characters or fewer." },
        { status: 400 }
      );
    }
    if (
      !Number.isSafeInteger(requestedPage) ||
      requestedPage < 1 ||
      requestedPage > 10000
    ) {
      return NextResponse.json({ error: "Invalid user page." }, { status: 400 });
    }

    const conditions = [];
    const values = [];
    if (search) {
      values.push(`%${search}%`);
      conditions.push(
        `(CONCAT_WS(' ', name, last_name) ILIKE $1 OR email ILIKE $1)`
      );
    }
    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const [[countRow], [baoAccounts]] = await Promise.all([
      db.query(`SELECT COUNT(*) AS count FROM users ${whereClause}`, values),
      db.query(
        `SELECT id, name, last_name, email, role, status, is_verified
         FROM users
         WHERE role = 'bao'
         ORDER BY name ASC, last_name ASC, id ASC`
      ),
    ]);
    const totalRows = Number(countRow?.count || 0);
    const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
    const page = Math.min(requestedPage, totalPages);
    const offset = (page - 1) * PAGE_SIZE;
    const [users] = await db.query(
      `SELECT
         id, name, last_name, email, role, status, is_verified,
         (
           role = 'user' AND status = 'active' AND is_verified IS TRUE
           AND LOWER(email) LIKE '%@lspu.edu.ph'
         ) AS eligible_for_bao
       FROM users
       ${whereClause}
       ORDER BY
         CASE role WHEN 'bao' THEN 0 WHEN 'user' THEN 1 ELSE 2 END,
         name ASC, last_name ASC, id ASC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, PAGE_SIZE, offset]
    );

    return NextResponse.json(
      {
        baoAccounts,
        users,
        page: { current: page, pageSize: PAGE_SIZE, totalRows, totalPages },
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    console.error("Admin BAO account list failed:", error);
    return NextResponse.json(
      { error: "Unable to load BAO account management." },
      { status: 500 }
    );
  }
}
