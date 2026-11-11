import { NextResponse } from "next/server";
import { getBaoAccess } from "@/lib/bao-access";
import { db } from "@/lib/db";
import { getUserStatusValues } from "@/lib/user-status-values";

export async function GET(req) {
  try {
    const access = await getBaoAccess();
    if (!access.session) {
      return NextResponse.json(
        { error: access.status === 401 ? "Unauthorized" : "Forbidden" },
        { status: access.status }
      );
    }

    const statuses = await getUserStatusValues();
    const { searchParams } = new URL(req.url);
    const status = (searchParams.get("status") || "all").toLowerCase();
    const search = searchParams.get("search")?.trim();

    if (status !== "all" && !statuses.includes(status)) {
      return NextResponse.json({ error: "Invalid seller status filter." }, { status: 400 });
    }

    const conditions = ["u.id IN (SELECT id FROM seller_accounts)"];
    const params = [];

    if (status !== "all") {
      params.push(status);
      conditions.push(`u.status = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      const searchParameter = `$${params.length}`;
      conditions.push(`(
        CONCAT_WS(' ', u.name, u.last_name) ILIKE ${searchParameter}
        OR COALESCE(u.email, '') ILIKE ${searchParameter}
      )`);
    }

    const [sellers] = await db.query(
      `WITH seller_accounts AS (
         SELECT id FROM users WHERE role = 'seller'
         UNION
         SELECT seller_id AS id FROM products WHERE seller_id IS NOT NULL
         UNION
         SELECT seller_id AS id FROM orders WHERE seller_id IS NOT NULL
       )
       SELECT
         u.id, u.name, u.last_name, u.email, u.contact_number,
         u.image, u.role, u.status, u.created_at,
         (SELECT COUNT(*) FROM products p WHERE p.seller_id = u.id) AS product_count,
         (SELECT COUNT(*) FROM products p WHERE p.seller_id = u.id AND p.status = 'pending') AS pending_products,
         (SELECT COUNT(*) FROM products p WHERE p.seller_id = u.id AND p.status = 'approved') AS approved_products,
         (
           SELECT COUNT(*)
           FROM orders o
           WHERE o.status = 'completed'
             AND (
               o.seller_id = u.id
               OR EXISTS (
                 SELECT 1
                 FROM order_items oi
                 JOIN products p ON p.id = oi.product_id
                 WHERE oi.order_id = o.id AND p.seller_id = u.id
               )
             )
         ) AS completed_order_count,
         (
           SELECT COALESCE(SUM(o.total), 0)
           FROM orders o
           WHERE o.status = 'completed'
             AND (
               o.seller_id = u.id
               OR EXISTS (
                 SELECT 1
                 FROM order_items oi
                 JOIN products p ON p.id = oi.product_id
                 WHERE oi.order_id = o.id AND p.seller_id = u.id
               )
             )
         ) AS completed_sales,
         GREATEST(
           COALESCE((SELECT MAX(p.created_at) FROM products p WHERE p.seller_id = u.id), u.created_at),
           COALESCE(
             (
               SELECT MAX(o.created_at)
               FROM orders o
               WHERE o.seller_id = u.id
                  OR EXISTS (
                    SELECT 1
                    FROM order_items oi
                    JOIN products p ON p.id = oi.product_id
                    WHERE oi.order_id = o.id AND p.seller_id = u.id
                  )
             ),
             u.created_at
           )
         ) AS last_activity_at
       FROM users AS u
       WHERE ${conditions.join(" AND ")}
       ORDER BY u.created_at DESC, u.id DESC`,
      params
    );

    return NextResponse.json(
      {
        sellers,
        statusOptions: statuses,
        suspensionSupported: statuses.includes("suspended"),
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    console.error("BAO seller list request failed:", error);
    return NextResponse.json(
      { error: "Unable to load seller records." },
      { status: 500 }
    );
  }
}
