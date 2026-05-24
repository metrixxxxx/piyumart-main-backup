import { db } from "@/lib/db";

export async function GET(req, { params }) {
  try {
    const { id } = await params;

    const result = await db.query(
  `SELECT p.*, 
    COALESCE(p.average_rating, 0) as average_rating,
    COALESCE(p.total_ratings, 0) as total_ratings,
    COALESCE(p.sold_count, 0) as sold_count,
    c.name as category_name
   FROM products p
   LEFT JOIN categories c ON c.id = p.category_id
   WHERE p.id = $1`,
  [id]
);
const rows = result[0]; // result[0] is the array of rows

if (rows.length === 0) {
  return Response.json({ error: `Product not found (ID: ${id})` }, { status: 404 });
}

const product = rows[0]; // first row

const attrsResult = await db.query(
  `SELECT pa.value, ad.name, ad.label, ad.type
   FROM product_attributes pa
   JOIN attribute_definitions ad ON pa.attribute_definition_id = ad.id
   WHERE pa.product_id = $1`,
  [id]
);
const attrs = attrsResult[0];

const imagesResult = await db.query(
  `SELECT image_url FROM product_images WHERE product_id = $1 ORDER BY sort_order ASC`,
  [id]
);
const images = imagesResult[0];

const variantsResult = await db.query(
  `SELECT label, image_url FROM product_variants WHERE product_id = $1 ORDER BY id ASC`,
  [id]
);
const variants = variantsResult[0];

const sellerResult = await db.query(
  `SELECT 
    TO_CHAR(u.created_at, 'Mon YYYY') as seller_joined,
    (SELECT COUNT(*) FROM products p2 WHERE p2.seller_id = $1) as seller_product_count
   FROM users u WHERE u.id = $1`,
  [product.seller_id]
);
const sellerRows = sellerResult[0];

product.attributes = attrs;
product.images = images.map((r) => r.image_url);
product.variants = variants;
if (sellerRows.length > 0) {
  product.seller_joined = sellerRows[0].seller_joined;
  product.seller_product_count = sellerRows[0].seller_product_count;
}

    return Response.json(product);
  } catch (err) {
    console.error("GET /api/products/[id] error:", err.message, err.stack);
    return Response.json({ error: err.message }, { status: 500 });
  }
}