import { db } from "@/lib/db";

export async function GET(req, { params }) {
  try {
    const { id } = await params;

    const [rows] = await db.query(
      "SELECT * FROM products WHERE id = $1",
      [id]
    );

    if (rows.length === 0) {
      return Response.json({ error: `Product not found (ID: ${id})` }, { status: 404 });
    }

    const product = rows[0];

    const [attrs] = await db.query(
      `SELECT pa.value, ad.name, ad.label, ad.type
       FROM product_attributes pa
       JOIN attribute_definitions ad ON pa.attribute_definition_id = ad.id
       WHERE pa.product_id = $1`,
      [id]
    );

    const [images] = await db.query(
      `SELECT image_url FROM product_images WHERE product_id = $1 ORDER BY sort_order ASC`,
      [id]
    );

    const [variants] = await db.query(
      `SELECT label, image_url FROM product_variants WHERE product_id = $1 ORDER BY id ASC`,
      [id]
    );

    product.attributes = attrs;
    product.images = images.map((r) => r.image_url);
    product.variants = variants;

    return Response.json(product);
  } catch (err) {
    console.error("GET /api/products/[id] error:", err.message, err.stack);
    return Response.json({ error: err.message }, { status: 500 });
  }
}