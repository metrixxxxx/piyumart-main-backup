// app/api/cart/route.js
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return Response.json({ error: "Not logged in" }, { status: 401 });
    }

    const userId = session.user.id;

    const [items] = await db.query(
      `SELECT 
        cart_items.id,
        cart_items.product_id,
        cart_items.quantity,
        cart_items.variant,
        products.name,
        products.price,
        COALESCE(pv.image_url, products.image_url) AS image_url
       FROM cart_items
       JOIN carts ON cart_items.cart_id = carts.id
       JOIN products ON cart_items.product_id = products.id
       LEFT JOIN product_variants pv 
         ON pv.product_id = cart_items.product_id 
         AND pv.label = cart_items.variant
       WHERE carts.user_id = $1`,
      [userId]
    );

    return Response.json(items);
  } catch (err) {
    console.error("GET /api/cart error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return Response.json({ error: "Not logged in" }, { status: 401 });
    }

    const userId = session.user.id;
    const { product_id, quantity, variant } = await req.json();

    const [cart] = await db.query(
      "SELECT id FROM carts WHERE user_id = $1",
      [userId]
    );

    let cartId;
    if (cart.length === 0) {
      const [newCart] = await db.query(
        "INSERT INTO carts (user_id) VALUES ($1) RETURNING id",
        [userId]
      );
      cartId = newCart[0].id;
    } else {
      cartId = cart[0].id;
    }

    const [items] = await db.query(
      `SELECT * FROM cart_items 
       WHERE cart_id = $1 AND product_id = $2 AND variant IS NOT DISTINCT FROM $3`,
      [cartId, product_id, variant ?? null]
    );

    if (items.length > 0) {
      await db.query(
        "UPDATE cart_items SET quantity = quantity + $1 WHERE id = $2",
        [quantity, items[0].id]
      );
    } else {
      await db.query(
        "INSERT INTO cart_items (cart_id, product_id, quantity, variant) VALUES ($1, $2, $3, $4)",
        [cartId, product_id, quantity, variant ?? null]
      );
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("POST /api/cart error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return Response.json({ error: "Not logged in" }, { status: 401 });
    }

    const { cart_item_id } = await req.json();

    await db.query(
      "DELETE FROM cart_items WHERE id = $1",
      [cart_item_id]
    );

    return Response.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/cart error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return Response.json({ error: "Not logged in" }, { status: 401 });
    }

    const { cart_item_id, quantity } = await req.json();

    if (!cart_item_id || quantity < 1) {
      return Response.json({ error: "Invalid input" }, { status: 400 });
    }

    await db.query(
      `UPDATE cart_items SET quantity = $1
       WHERE id = $2
         AND cart_id = (SELECT id FROM carts WHERE user_id = $3)`,
      [quantity, cart_item_id, session.user.id]
    );

    return Response.json({ success: true });
  } catch (err) {
    console.error("PATCH /api/cart error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}