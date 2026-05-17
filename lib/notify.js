import { db } from "@/lib/db";

export async function notify({ userId, type, message }) {
  const [rows] = await db.query(
    "INSERT INTO notifications (user_id, type, message) VALUES ($1, $2, $3) RETURNING id",
    [userId, type, message]
  );

  if (global.io) {
    global.io.to(`user_${userId}`).emit("notification:new", {
      id: rows[0]?.id,
      type,
      message,
      is_read: false,
      created_at: new Date(),
    });
  }
}