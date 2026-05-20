import { db } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase";

export async function notify({ userId, type, message }) {
  const [rows] = await db.query(
    "INSERT INTO notifications (user_id, type, message) VALUES ($1, $2, $3) RETURNING id",
    [userId, type, message]
  );

  const notif = {
    id: rows[0]?.id,
    user_id: userId,
    type,
    message,
    is_read: false,
    created_at: new Date(),
  };

  // ✅ Broadcast via Supabase Realtime instead of Socket.io
  try {
    await supabaseAdmin
      .channel(`notifications:${userId}`)
      .send({
        type: "broadcast",
        event: "notification:new",
        payload: notif,
      });
  } catch (e) {
    console.error("Notify broadcast error:", e);
  }
}