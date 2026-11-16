import "server-only";

import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

// The token supplies identity only. Always read current permissions from Postgres.
export async function getMarketplaceAccount() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const [rows] = await db.query(
    "SELECT id, name, email, role, status, department FROM users WHERE id = $1",
    [session.user.id]
  );
  return rows[0] || null;
}

export async function isActiveSellerAccount(userId) {
  if (!userId) return false;

  const [rows] = await db.query(
    "SELECT role, status FROM users WHERE id = $1",
    [userId]
  );

  return rows[0]?.role === "seller" && rows[0]?.status === "active";
}
