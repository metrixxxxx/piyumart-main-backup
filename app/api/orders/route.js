import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { notify } from "@/lib/notify";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [orders] = await db.query(
      `SELECT * FROM orders WHERE user_id = $1 ORDER BY id DESC`,
      [session.user.id]
    );

    const ordersWithItems = await Promise.all(
      orders.map(async (order) => {
        const [items] = await db.query(
          `SELECT
            oi.product_id, oi.quantity, oi.price, oi.variant,
            COALESCE(oi.name, p.name) AS name,
            COALESCE(oi.seller_name, p.seller_name) AS seller_name,
            COALESCE(
              oi.image_url,
              (SELECT pv.image_url FROM product_variants pv
               WHERE pv.product_id = p.id AND pv.label = oi.variant LIMIT 1),
              (SELECT pi.image_url FROM product_images pi
               WHERE pi.product_id = p.id ORDER BY pi.sort_order ASC LIMIT 1),
              p.image_url
            ) AS image_url
          FROM order_items oi
          LEFT JOIN products p ON p.id = oi.product_id
          WHERE oi.order_id = $1`,
          [order.id]
        );
        return { ...order, items };
      })
    );

    return NextResponse.json(ordersWithItems);
  } catch (err) {
    console.error("Orders GET error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

    const { name, email, address, payment_method, total, items } = await req.json();

    if (!items || items.length === 0)
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });

    const validItems = items.filter((item) => item.product_id);
    if (validItems.length === 0)
      return NextResponse.json({ error: "No valid items in cart." }, { status: 400 });

    // Step 1: fetch product info for all items first
    const enrichedItems = [];
    for (const item of validItems) {
      const [productRows] = await db.query(
        `SELECT
          p.seller_id,
          p.name,
          p.image_url,
          CONCAT(u.name, ' ', u.last_name) AS seller_name,
          COALESCE(
            (SELECT pv.image_url FROM product_variants pv
             WHERE pv.product_id = p.id AND pv.label = $2 LIMIT 1),
            (SELECT pi.image_url FROM product_images pi
             WHERE pi.product_id = p.id ORDER BY pi.sort_order ASC LIMIT 1),
            p.image_url
          ) AS resolved_image_url
        FROM products p
        LEFT JOIN users u ON u.id = p.seller_id
        WHERE p.id = $1`,
        [item.product_id, item.variant || null]
      );

      const product = productRows[0];
      if (!product) continue; // skip invalid products

      enrichedItems.push({ ...item, product });
    }

    if (enrichedItems.length === 0)
      return NextResponse.json({ error: "No valid products found." }, { status: 400 });

    // Step 2: group by seller_id
    const sellerGroups = enrichedItems.reduce((groups, item) => {
      const sellerId = item.product.seller_id;
      if (!groups[sellerId]) groups[sellerId] = [];
      groups[sellerId].push(item);
      return groups;
    }, {});

    // Step 3: create one order per seller group
    const createdOrderIds = [];

    for (const [sellerId, sellerItems] of Object.entries(sellerGroups)) {
      const sellerTotal = sellerItems.reduce(
        (sum, i) => sum + parseFloat(i.price) * i.quantity,
        0
      );

      const [result] = await db.query(
        `INSERT INTO orders (user_id, name, email, address, payment_method, total, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending')
         RETURNING id`,
        [session.user.id, name, email, address, payment_method, sellerTotal]
      );

      const orderId = result[0].id;
      createdOrderIds.push(orderId);

      // Insert all items for this seller into this order
      for (const item of sellerItems) {
        const { product } = item;

        await db.query(
          `INSERT INTO order_items
            (order_id, product_id, quantity, price, variant, name, image_url, seller_name)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            orderId,
            item.product_id,
            item.quantity,
            item.price,
            item.variant || null,
            product.name,
            item.image_url || product.resolved_image_url || null,
            product.seller_name || null,
          ]
        );
      }

      // Notify seller once per order with all their items listed
      const itemsSummary = sellerItems
        .map((i) => `"${i.product.name}" x${i.quantity}`)
        .join(", ");

      await notify({
        userId: sellerId,
        type: "order",
        message: `New order #${orderId}: ${itemsSummary} — please approve it in My Listings.`,
      });
    }

    // Notify buyer once summarizing all orders created
    await notify({
      userId: session.user.id,
      type: "order_placed",
      message: `Your order${createdOrderIds.length > 1 ? "s" : ""} (${createdOrderIds.map((id) => `#${id}`).join(", ")}) ${createdOrderIds.length > 1 ? "have" : "has"} been placed! Total: ₱${Number(total).toLocaleString()}. Waiting for seller approval.`,
    });

    return NextResponse.json({ success: true, orderIds: createdOrderIds });
  } catch (err) {
    console.error("Order POST error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}