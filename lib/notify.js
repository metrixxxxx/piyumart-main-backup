import { db } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase";

export async function createNotificationRecord({ userId, type, message }, client) {
  const query = `INSERT INTO notifications (user_id, type, message)
                 VALUES ($1, $2, $3)
                 RETURNING id, user_id, type, message, is_read, created_at`;
  let notification;

  if (client) {
    const { rows } = await client.query(query, [userId, type, message]);
    notification = rows[0];
  } else {
    const [rows] = await db.query(query, [userId, type, message]);
    notification = rows[0];
  }

  if (!notification) {
    throw new Error("Notification record was not created.");
  }

  return notification;
}

export async function broadcastNotification(notification) {
  const payload = { ...notification, created_at: new Date() };
  try {
    await supabaseAdmin
      .channel(`notifications:${notification.user_id}`)
      .send({
        type: "broadcast",
        event: "notification:new",
        payload,
      });
  } catch (e) {
    console.error("Notify broadcast error:", e);
  }
}

export async function notify({ userId, type, message }) {
  const notification = await createNotificationRecord({ userId, type, message });
  await broadcastNotification(notification);
  return notification;
}