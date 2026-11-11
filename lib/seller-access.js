import "server-only";

import { db } from "@/lib/db";

export async function isActiveSellerAccount(userId) {
  if (!userId) return false;

  const [rows] = await db.query(
    "SELECT status FROM users WHERE id = $1",
    [userId]
  );

  return rows[0]?.status === "active";
}
