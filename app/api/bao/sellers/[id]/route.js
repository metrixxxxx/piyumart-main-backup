import { NextResponse } from "next/server";
import { getBaoAccess } from "@/lib/bao-access";
import { db } from "@/lib/db";
import { getUserStatusValues } from "@/lib/user-status-values";

async function getSellerId(params) {
  const { id } = await params;
  const sellerId = Number(id);
  return Number.isInteger(sellerId) && sellerId > 0 ? sellerId : null;
}

export async function GET(_req, { params }) {
  try {
    const access = await getBaoAccess();
    if (!access.session) {
      return NextResponse.json(
        { error: access.status === 401 ? "Unauthorized" : "Forbidden" },
        { status: access.status }
      );
    }

    const sellerId = await getSellerId(params);
    if (!sellerId) {
      return NextResponse.json({ error: "Invalid seller ID." }, { status: 400 });
    }

    const [sellerRows] = await db.query(
      `SELECT u.id, u.name, u.last_name, u.email, u.contact_number,
              u.image, u.role, u.status, u.created_at
       FROM users AS u
       WHERE u.id = $1
         AND (
           u.role = 'seller'
           OR EXISTS (SELECT 1 FROM products p WHERE p.seller_id = u.id)
           OR EXISTS (SELECT 1 FROM orders o WHERE o.seller_id = u.id)
         )`,
      [sellerId]
    );

    if (!sellerRows.length) {
      return NextResponse.json({ error: "Seller not found." }, { status: 404 });
    }

    const [products, orders, stats, history] = await Promise.all([
      db.query(
        `SELECT
           p.id, p.name, p.description, p.price, p.stock, p.status,
           p.is_visible, p.is_featured, p.image_url, p.category_id,
           c.name AS category_name, p.created_at
         FROM products AS p
         LEFT JOIN categories AS c ON c.id = p.category_id
         WHERE p.seller_id = $1
         ORDER BY p.created_at DESC, p.id DESC`,
        [sellerId]
      ),
      db.query(
        `SELECT
           o.id, o.status, o.total, o.created_at, o.completed_at,
           (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
         FROM orders AS o
         WHERE o.seller_id = $1
            OR EXISTS (
              SELECT 1
              FROM order_items oi
              JOIN products p ON p.id = oi.product_id
              WHERE oi.order_id = o.id AND p.seller_id = $1
            )
         ORDER BY o.created_at DESC, o.id DESC
         LIMIT 20`,
        [sellerId]
      ),
      db.query(
        `SELECT
           (SELECT COUNT(*) FROM products p WHERE p.seller_id = $1) AS product_count,
           (SELECT COUNT(*) FROM products p WHERE p.seller_id = $1 AND p.status = 'approved') AS approved_products,
           (SELECT COUNT(*) FROM products p WHERE p.seller_id = $1 AND p.status = 'pending') AS pending_products,
           (
             SELECT COUNT(*)
             FROM orders o
             WHERE o.status = 'completed'
               AND (
                 o.seller_id = $1
                 OR EXISTS (
                   SELECT 1
                   FROM order_items oi
                   JOIN products p ON p.id = oi.product_id
                   WHERE oi.order_id = o.id AND p.seller_id = $1
                 )
               )
           ) AS completed_order_count,
           (
             SELECT COALESCE(SUM(o.total), 0)
             FROM orders o
             WHERE o.status = 'completed'
               AND (
                 o.seller_id = $1
                 OR EXISTS (
                   SELECT 1
                   FROM order_items oi
                   JOIN products p ON p.id = oi.product_id
                   WHERE oi.order_id = o.id AND p.seller_id = $1
                 )
               )
           ) AS completed_sales,
           GREATEST(
             COALESCE((SELECT MAX(p.created_at) FROM products p WHERE p.seller_id = $1), $2),
             COALESCE(
               (
                 SELECT MAX(o.created_at)
                 FROM orders o
                 WHERE o.seller_id = $1
                    OR EXISTS (
                      SELECT 1
                      FROM order_items oi
                      JOIN products p ON p.id = oi.product_id
                      WHERE oi.order_id = o.id AND p.seller_id = $1
                    )
               ),
               $2
             )
           ) AS last_activity_at`,
        [sellerId, sellerRows[0].created_at]
      ),
      db.query(
        `SELECT
           al.id, al.action, al.reason, al.metadata, al.created_at,
           al.actor_id, u.name AS actor_name, u.last_name AS actor_last_name
         FROM bao_audit_logs AS al
         LEFT JOIN users AS u ON u.id = al.actor_id
         WHERE al.entity_type = 'seller' AND al.entity_id = $1
         ORDER BY al.created_at DESC, al.id DESC`,
        [String(sellerId)]
      ),
    ]);

    const statusOptions = await getUserStatusValues();
    return NextResponse.json(
      {
        seller: sellerRows[0],
        products: products[0],
        orders: orders[0],
        stats: stats[0],
        history: history[0],
        statusOptions,
        suspensionSupported: statusOptions.includes("suspended"),
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    console.error("BAO seller detail request failed:", error);
    return NextResponse.json(
      { error: "Unable to load seller profile." },
      { status: 500 }
    );
  }
}

export async function PATCH(req, { params }) {
  try {
    const access = await getBaoAccess();
    if (!access.session) {
      return NextResponse.json(
        { error: access.status === 401 ? "Unauthorized" : "Forbidden" },
        { status: access.status }
      );
    }

    const sellerId = await getSellerId(params);
    if (!sellerId) {
      return NextResponse.json({ error: "Invalid seller ID." }, { status: 400 });
    }

    const body = await req.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid seller action." }, { status: 400 });
    }
    const action = body.action;
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (action !== "suspend" && action !== "reactivate") {
      return NextResponse.json({ error: "Invalid seller action." }, { status: 400 });
    }
    if (action === "suspend" && !reason) {
      return NextResponse.json(
        { error: "A reason is required to suspend a seller." },
        { status: 400 }
      );
    }
    if (reason.length > 1000) {
      return NextResponse.json({ error: "Reason must be 1,000 characters or fewer." }, { status: 400 });
    }

    const statusOptions = await getUserStatusValues();
    if (!statusOptions.includes("suspended")) {
      return NextResponse.json(
        { error: "Seller suspension is not supported by the current user status enum." },
        { status: 409 }
      );
    }

    const targetStatus = action === "suspend" ? "suspended" : "active";
    const expectedStatus = action === "suspend" ? "active" : "suspended";
    const auditAction = action === "suspend" ? "seller_suspended" : "seller_reactivated";

    const [rows] = await db.query(
      `WITH target AS (
         SELECT u.id, u.status
         FROM users AS u
         WHERE u.id = $1
           AND (
             u.role = 'seller'
             OR EXISTS (SELECT 1 FROM products p WHERE p.seller_id = u.id)
             OR EXISTS (SELECT 1 FROM orders o WHERE o.seller_id = u.id)
           )
         FOR UPDATE
       ),
       updated AS (
         UPDATE users AS u
         SET status = $2::user_status
         FROM target
         WHERE u.id = target.id AND target.status = $3::user_status
         RETURNING u.id, target.status AS previous_status, u.status AS new_status
       ),
       audit AS (
         INSERT INTO bao_audit_logs
           (actor_id, action, entity_type, entity_id, reason, metadata)
         SELECT
           $4, $5, 'seller', updated.id::text, NULLIF($6, ''),
           jsonb_build_object(
             'previous_status', updated.previous_status,
             'new_status', updated.new_status
           )
         FROM updated
         RETURNING entity_id
       )
       SELECT updated.*, audit.entity_id
       FROM updated
       INNER JOIN audit ON audit.entity_id = updated.id::text`,
      [
        sellerId,
        targetStatus,
        expectedStatus,
        access.session.user.id,
        auditAction,
        reason,
      ]
    );

    if (!rows.length) {
      const [sellerRows] = await db.query(
        `SELECT u.id
         FROM users AS u
         WHERE u.id = $1
           AND (
             u.role = 'seller'
             OR EXISTS (SELECT 1 FROM products p WHERE p.seller_id = u.id)
             OR EXISTS (SELECT 1 FROM orders o WHERE o.seller_id = u.id)
           )`,
        [sellerId]
      );
      return NextResponse.json(
        { error: sellerRows.length ? "Seller status changed. Refresh and try again." : "Seller not found." },
        { status: sellerRows.length ? 409 : 404 }
      );
    }

    if (global.io) {
      const [products] = await db.query(
        `SELECT
           p.id, p.name, p.description, p.price, p.stock, p.status,
           p.is_visible, p.is_featured, p.image_url, p.category_id,
           p.seller_id, p.seller_name, u.status AS seller_status
         FROM products AS p
         LEFT JOIN users AS u ON u.id = p.seller_id
         WHERE p.seller_id = $1
           AND p.status = 'approved'
           AND p.is_visible = true`,
        [sellerId]
      );
      for (const product of products) {
        global.io.emit(
          action === "suspend" ? "products:updated" : "products:new",
          product
        );
      }
    }

    return NextResponse.json({ success: true, status: rows[0].new_status });
  } catch (error) {
    console.error("BAO seller status update failed:", error);
    return NextResponse.json(
      { error: "Unable to update seller status." },
      { status: 500 }
    );
  }
}
