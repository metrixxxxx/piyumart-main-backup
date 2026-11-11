import { NextResponse } from "next/server";
import { getBaoAccess } from "@/lib/bao-access";
import { db } from "@/lib/db";

const ACTIONS = {
  approve: { status: "approved", auditAction: "product_approved" },
  reject: { status: "rejected", auditAction: "product_rejected" },
  suspend: { status: "suspended", auditAction: "product_suspended" },
};

async function getProductId(params) {
  const { id } = await params;
  const productId = Number(id);
  return Number.isInteger(productId) && productId > 0 ? productId : null;
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

    const productId = await getProductId(params);
    if (!productId) {
      return NextResponse.json({ error: "Invalid product ID." }, { status: 400 });
    }

    const [productRows] = await db.query(
      `SELECT
         p.*,
         c.name AS category_name,
         u.name AS seller_first_name,
         u.last_name AS seller_last_name,
         u.email AS seller_email,
         u.contact_number AS seller_contact_number,
         u.image AS seller_image
       FROM products AS p
       LEFT JOIN categories AS c ON c.id = p.category_id
       LEFT JOIN users AS u ON u.id = p.seller_id
       WHERE p.id = $1`,
      [productId]
    );

    if (!productRows.length) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    const [attributes, imageRows, variants, history] = await Promise.all([
      db.query(
        `SELECT pa.value, ad.name, ad.label, ad.type
         FROM product_attributes AS pa
         JOIN attribute_definitions AS ad ON ad.id = pa.attribute_definition_id
         WHERE pa.product_id = $1`,
        [productId]
      ),
      db.query(
        `SELECT image_url FROM product_images
         WHERE product_id = $1 ORDER BY sort_order ASC`,
        [productId]
      ),
      db.query(
        `SELECT id, name, label, image_url, price_override, stock, value
         FROM product_variants WHERE product_id = $1 ORDER BY id ASC`,
        [productId]
      ),
      db.query(
        `SELECT
           al.id, al.action, al.reason, al.metadata, al.created_at,
           al.actor_id, u.name AS actor_name, u.last_name AS actor_last_name
         FROM bao_audit_logs AS al
         LEFT JOIN users AS u ON u.id = al.actor_id
         WHERE al.entity_type = 'product' AND al.entity_id = $1
         ORDER BY al.created_at DESC, al.id DESC`,
        [String(productId)]
      ),
    ]);

    const product = productRows[0];
    const imageUrls = imageRows[0].map((row) => row.image_url);
    if (!imageUrls.length && product.image_url) imageUrls.push(product.image_url);

    return NextResponse.json(
      {
        ...product,
        images: imageUrls,
        attributes: attributes[0],
        variants: variants[0],
        history: history[0],
        seller: {
          id: product.seller_id,
          name: [product.seller_first_name, product.seller_last_name]
            .filter(Boolean)
            .join(" "),
          email: product.seller_email,
          contact_number: product.seller_contact_number,
          image: product.seller_image,
        },
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    console.error("BAO product detail request failed:", error);
    return NextResponse.json(
      { error: "Unable to load product details." },
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

    const productId = await getProductId(params);
    if (!productId) {
      return NextResponse.json({ error: "Invalid product ID." }, { status: 400 });
    }

    const body = await req.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid moderation request." }, { status: 400 });
    }
    const action = ACTIONS[body.action];
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";

    if (!action) {
      return NextResponse.json({ error: "Invalid moderation action." }, { status: 400 });
    }
    if (body.action === "reject" && !reason) {
      return NextResponse.json(
        { error: "A reason is required to reject a product." },
        { status: 400 }
      );
    }
    if (reason.length > 1000) {
      return NextResponse.json({ error: "Reason must be 1,000 characters or fewer." }, { status: 400 });
    }

    const [rows] = await db.query(
      `WITH current_product AS (
         SELECT p.id, p.status, u.status AS seller_status
         FROM products AS p
         LEFT JOIN users AS u ON u.id = p.seller_id
         WHERE p.id = $1
         FOR UPDATE OF p
       ),
       updated AS (
         UPDATE products AS p
         SET status = $2
         FROM current_product AS old_product
         WHERE p.id = old_product.id
         RETURNING
           p.id, p.name, p.description, p.price, p.stock, p.status, p.is_visible,
           p.image_url, p.category_id, p.seller_id, p.seller_name,
             old_product.status AS previous_status, old_product.seller_status
       ),
       audit AS (
         INSERT INTO bao_audit_logs
           (actor_id, action, entity_type, entity_id, reason, metadata)
         SELECT
           $3, $4, 'product', updated.id::text, NULLIF($5, ''),
           jsonb_build_object(
             'product_name', updated.name,
             'previous_status', updated.previous_status,
             'new_status', updated.status
           )
         FROM updated
         RETURNING entity_id
       )
       SELECT updated.*, audit.entity_id
       FROM updated
       INNER JOIN audit ON audit.entity_id = updated.id::text`,
      [
        productId,
        action.status,
        access.session.user.id,
        action.auditAction,
        reason,
      ]
    );

    if (!rows.length) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    const product = rows[0];
    if (global.io) {
      if (
        product.status === "approved" &&
        product.is_visible &&
        product.seller_status === "active"
      ) {
        const event = product.previous_status === "approved" ? "products:updated" : "products:new";
        global.io.emit(event, product);
      } else {
        global.io.emit("products:updated", product);
      }
    }

    return NextResponse.json({ success: true, product });
  } catch (error) {
    console.error("BAO product moderation failed:", error);
    return NextResponse.json(
      { error: "Unable to update product moderation status." },
      { status: 500 }
    );
  }
}
