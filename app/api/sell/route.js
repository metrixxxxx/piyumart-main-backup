import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { saveFile } from "@/lib/savefile";
import { isActiveSellerAccount } from "@/lib/seller-access";
import { normalizeMeetupPoint } from "@/lib/campus";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return Response.json({ error: "Not logged in" }, { status: 401 });
    if (!(await isActiveSellerAccount(session.user.id))) {
      return Response.json({ error: "An active verified seller account is required." }, { status: 403 });
    }

    const [rows] = await db.query(
      `SELECT p.*, c.name as category_name 
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.seller_id = $1`,
      [session.user.id]
    );

    const productsWithDetails = await Promise.all(
      rows.map(async (product) => {
        const [attrs] = await db.query(
          `SELECT pa.value, ad.name, ad.label, ad.type
           FROM product_attributes pa
           JOIN attribute_definitions ad ON pa.attribute_definition_id = ad.id
           WHERE pa.product_id = $1`,
          [product.id]
        );
        const [images] = await db.query(
          `SELECT image_url FROM product_images WHERE product_id = $1 ORDER BY sort_order ASC`,
          [product.id]
        );
        const [variants] = await db.query(
          `SELECT id, name, label, image_url, price_override, stock, value FROM product_variants WHERE product_id = $1 ORDER BY id ASC`,
          [product.id]
        );
        return {
          ...product,
          attributes: attrs,
          images: images.map((r) => r.image_url),
          variants,
        };
      })
    );

    return Response.json(productsWithDetails);
  } catch (err) {
    console.error("GET /api/sell error:", err.message, err.stack);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return Response.json({ error: "Not logged in" }, { status: 401 });
    if (!(await isActiveSellerAccount(session.user.id))) {
      return Response.json({ error: "An active account is required to manage listings." }, { status: 403 });
    }

    const formData = await req.formData();
    const meetupPoint = normalizeMeetupPoint(formData.get("meetup_point"));
    if (!meetupPoint) return Response.json({ error: "A meetup point is required (up to 200 characters)." }, { status: 400 });
    const [sellers] = await db.query("SELECT name, department FROM users WHERE id = $1 AND role = 'seller' AND status = 'active'", [session.user.id]);
    if (!sellers[0]) return Response.json({ error: "Forbidden" }, { status: 403 });

    const name         = formData.get("name");
    const description  = formData.get("description");
    const price        = formData.get("price");
    const category_id  = formData.get("category_id") ? parseInt(formData.get("category_id")) : null;
    const stock        = parseInt(formData.get("stock")) || 0;
    const attributes   = JSON.parse(formData.get("attributes") || "[]");
    const variantCount = parseInt(formData.get("variant_count")) || 0;

    const imageFiles = formData.getAll("images");
    const imageUrls = [];
    for (const file of imageFiles) {
      if (file && file.size > 0) {
        const url = await saveFile(file, "products");
        imageUrls.push(url);
      }
    }

    const image_url = imageUrls[0] || null;

    // ✅ THE FIX — [rows] not [result], then rows[0].id
    const [rows] = await db.query(
      `INSERT INTO products 
        (name, description, price, image_url, seller_id, seller_name, category_id, stock, is_visible, is_featured, status, department, meetup_point)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id`,
      [name, description, price, image_url, session.user.id, sellers[0].name, category_id, stock, true, false, "pending", sellers[0].department, meetupPoint]
    );
    const product_id = rows[0].id;

    if (imageUrls.length > 0) {
      await Promise.all(
        imageUrls.map((url, i) =>
          db.query(
            "INSERT INTO product_images (product_id, image_url, sort_order) VALUES ($1, $2, $3)",
            [product_id, url, i]
          )
        )
      );
    }

    for (let i = 0; i < variantCount; i++) {
      const label = formData.get(`variant_label_${i}`);
      const variantFile = formData.get(`variant_image_${i}`);
      let variantImageUrl = null;
      if (variantFile && variantFile.size > 0) {
        variantImageUrl = await saveFile(variantFile, "variants");
      }
      if (label) {
        await db.query(
          "INSERT INTO product_variants (product_id, label, image_url) VALUES ($1, $2, $3)",
          [product_id, label, variantImageUrl]
        );
      }
    }

    if (attributes.length > 0) {
      await Promise.all(
        attributes.map(({ attribute_definition_id, value }) => {
          if (!value) return;
          return db.query(
            "INSERT INTO product_attributes (product_id, attribute_definition_id, value) VALUES ($1, $2, $3)",
            [product_id, attribute_definition_id, value]
          );
        })
      );
    }

    return Response.json({ success: true, id: product_id, status: "pending" });
  } catch (err) {
    console.error("POST /api/sell error:", err.message, err.stack);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return Response.json({ error: "Not logged in" }, { status: 401 });
    if (!(await isActiveSellerAccount(session.user.id))) {
      return Response.json({ error: "An active account is required to manage listings." }, { status: 403 });
    }

    const formData = await req.formData();
    const meetupPoint = normalizeMeetupPoint(formData.get("meetup_point"));
    if (!meetupPoint) return Response.json({ error: "A meetup point is required (up to 200 characters)." }, { status: 400 });

    const id           = formData.get("id");
    const name         = formData.get("name");
    const description  = formData.get("description");
    const price        = formData.get("price");
    const category_id  = formData.get("category_id") ? parseInt(formData.get("category_id")) : null;
    const stock        = parseInt(formData.get("stock")) || 0;
    const is_visible   = formData.get("is_visible") === "1";
    const attributes   = JSON.parse(formData.get("attributes") || "[]");
    const variantCount = parseInt(formData.get("variant_count")) || 0;

    const [ownedProducts] = await db.query(
      "SELECT id FROM products WHERE id = $1 AND seller_id = $2",
      [id, session.user.id]
    );
    if (!ownedProducts.length) {
      return Response.json({ error: "Product not found." }, { status: 404 });
    }

    const imageFiles = formData.getAll("images");
    const newImageUrls = [];
    for (const file of imageFiles) {
      if (file && file.size > 0) {
        const url = await saveFile(file, "products");
        newImageUrls.push(url);
      }
    }

    const existingUrls = JSON.parse(formData.get("existing_image_urls") || "[]");
    const allImageUrls = [...existingUrls, ...newImageUrls];
    const image_url = allImageUrls[0] || null;

    const [updatedProducts] = await db.query(
      `UPDATE products 
       SET name=$1, description=$2, price=$3, image_url=$4, category_id=$5, stock=$6, is_visible=$7,
           status = CASE WHEN status = 'suspended' THEN status ELSE 'pending' END, meetup_point=$10
       WHERE id=$8 AND seller_id=$9
       RETURNING id, name, description, price, image_url, category_id, stock,
                 is_visible, is_featured, status, seller_id, seller_name, department, meetup_point`,
      [name, description, price, image_url, category_id, stock, is_visible, id, session.user.id, meetupPoint]
    );
    if (!updatedProducts.length) {
      return Response.json({ error: "Product not found." }, { status: 404 });
    }

    if (allImageUrls.length > 0) {
      await db.query("DELETE FROM product_images WHERE product_id = $1", [id]);
      await Promise.all(
        allImageUrls.map((url, i) =>
          db.query(
            "INSERT INTO product_images (product_id, image_url, sort_order) VALUES ($1, $2, $3)",
            [id, url, i]
          )
        )
      );
    }

    await db.query("DELETE FROM product_variants WHERE product_id = $1", [id]);
    for (let i = 0; i < variantCount; i++) {
      const label = formData.get(`variant_label_${i}`);
      const variantFile = formData.get(`variant_image_${i}`);
      let variantImageUrl = formData.get(`variant_existing_image_${i}`) || null;
      if (variantFile && variantFile.size > 0) {
        variantImageUrl = await saveFile(variantFile, "variants");
      }
      if (label) {
        await db.query(
          "INSERT INTO product_variants (product_id, label, image_url) VALUES ($1, $2, $3)",
          [id, label, variantImageUrl]
        );
      }
    }

    await db.query("DELETE FROM product_attributes WHERE product_id = $1", [id]);
    if (attributes.length > 0) {
      await Promise.all(
        attributes.map(({ attribute_definition_id, value }) => {
          if (!value) return;
          return db.query(
            "INSERT INTO product_attributes (product_id, attribute_definition_id, value) VALUES ($1, $2, $3)",
            [id, attribute_definition_id, value]
          );
        })
      );
    }

    if (global.io && updatedProducts[0]) {
      global.io.emit("products:updated", updatedProducts[0]);
    }

    return Response.json({ success: true, status: "pending" });
  } catch (err) {
    console.error("PUT /api/sell error:", err.message, err.stack);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return Response.json({ error: "Not logged in" }, { status: 401 });
    if (!(await isActiveSellerAccount(session.user.id))) {
      return Response.json({ error: "An active account is required to manage listings." }, { status: 403 });
    }

    const { id } = await req.json();

    const [ownedProducts] = await db.query(
      "SELECT id FROM products WHERE id = $1 AND seller_id = $2",
      [id, session.user.id]
    );
    if (!ownedProducts.length) {
      return Response.json({ error: "Product not found." }, { status: 404 });
    }

    await db.query("DELETE FROM product_attributes WHERE product_id = $1", [id]);
    await db.query("DELETE FROM product_images WHERE product_id = $1", [id]);
    await db.query("DELETE FROM product_variants WHERE product_id = $1", [id]);
    await db.query("DELETE FROM products WHERE id=$1 AND seller_id=$2", [id, session.user.id]);

    if (global.io) global.io.emit("products:deleted", { id });

    return Response.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/sell error:", err.message, err.stack);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
