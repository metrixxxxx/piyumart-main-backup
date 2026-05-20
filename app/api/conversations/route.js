import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { db } from "@/lib/db";

// GET — list all conversations ng current user
export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = session.user.id;

    const [rows] = await db.query(
      `SELECT 
        c.id,
        c.product_id,
        c.buyer_id,
        c.seller_id,
        c.updated_at,
        p.name AS product_name,
        p.image_url AS product_image,
        -- other user's info (kung buyer ka, makikita mo ang seller, vice versa)
        CASE WHEN c.buyer_id = $1 THEN c.seller_id ELSE c.buyer_id END AS other_user_id,
        other_user.name AS other_user_name,
        -- latest message
        latest.content AS last_message,
        latest.created_at AS last_message_at,
        latest.sender_id AS last_sender_id,
        -- unread count
        (SELECT COUNT(*) FROM messages m 
         WHERE m.conversation_id = c.id 
           AND m.sender_id != $1 
           AND m.is_read = false) AS unread_count
       FROM conversations c
       JOIN users other_user ON other_user.id = 
         CASE WHEN c.buyer_id = $1 THEN c.seller_id ELSE c.buyer_id END
       LEFT JOIN products p ON p.id = c.product_id
       LEFT JOIN LATERAL (
         SELECT content, created_at, sender_id 
         FROM messages 
         WHERE conversation_id = c.id 
         ORDER BY created_at DESC 
         LIMIT 1
       ) latest ON true
       WHERE c.buyer_id = $1 OR c.seller_id = $1
       ORDER BY COALESCE(latest.created_at, c.created_at) DESC`,
      [userId]
    );

    return NextResponse.json(rows);
  } catch (err) {
    console.error("GET /api/conversations error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — create or get existing conversation
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const buyerId = session.user.id;
    const { seller_id, product_id } = await req.json();

    if (String(buyerId) === String(seller_id)) {
      return NextResponse.json({ error: "Cannot chat with yourself" }, { status: 400 });
    }

    // Check if existing na
    const [existing] = await db.query(
      `SELECT id FROM conversations 
       WHERE buyer_id = $1 AND seller_id = $2 AND product_id IS NOT DISTINCT FROM $3`,
      [buyerId, seller_id, product_id ?? null]
    );

    if (existing.length > 0) {
      return NextResponse.json({ id: existing[0].id });
    }

    // Create new
    const [newConvo] = await db.query(
      `INSERT INTO conversations (buyer_id, seller_id, product_id) 
       VALUES ($1, $2, $3) RETURNING id`,
      [buyerId, seller_id, product_id ?? null]
    );

    return NextResponse.json({ id: newConvo[0].id });
  } catch (err) {
    console.error("POST /api/conversations error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}