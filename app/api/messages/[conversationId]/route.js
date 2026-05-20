import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { db } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase";

// GET — fetch all messages sa conversation
export async function GET(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { conversationId } = await params;
    const userId = session.user.id;

    // Verify na part ng conversation ang user
    const [convo] = await db.query(
      `SELECT id FROM conversations WHERE id = $1 AND (buyer_id = $2 OR seller_id = $2)`,
      [conversationId, userId]
    );
    if (!convo.length) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Mark messages as read
    await db.query(
      `UPDATE messages SET is_read = true 
       WHERE conversation_id = $1 AND sender_id != $2 AND is_read = false`,
      [conversationId, userId]
    );

    // Fetch messages
    const [messages] = await db.query(
      `SELECT m.*, u.name AS sender_name
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = $1
       ORDER BY m.created_at ASC`,
      [conversationId]
    );

    return NextResponse.json(messages);
  } catch (err) {
    console.error("GET /api/messages error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — send message
// POST — send message
export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { conversationId } = await params;
    const userId = session.user.id;
    const { content } = await req.json();

    if (!content?.trim()) {
      return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 });
    }

    const [convo] = await db.query(
      `SELECT id, buyer_id, seller_id FROM conversations 
       WHERE id = $1 AND (buyer_id = $2 OR seller_id = $2)`,
      [conversationId, userId]
    );
    if (!convo.length) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [newMsg] = await db.query(
      `INSERT INTO messages (conversation_id, sender_id, content) 
       VALUES ($1, $2, $3) RETURNING *`,
      [conversationId, userId, content.trim()]
    );

    await db.query(
      `UPDATE conversations SET updated_at = NOW() WHERE id = $1`,
      [conversationId]
    );

    const message = { ...newMsg[0], sender_name: session.user.name };

    // ✅ Broadcast via Supabase Realtime — replaces Socket.io
    try {
      await supabaseAdmin
        .channel(`conversation:${conversationId}`)
        .send({
          type: "broadcast",
          event: "message:new",
          payload: { message },
        });
    } catch (e) {
      console.error("Broadcast error:", e);
    }

    return NextResponse.json(message);
  } catch (err) {
    console.error("POST /api/messages error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}