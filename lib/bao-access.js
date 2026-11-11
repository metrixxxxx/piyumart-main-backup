import "server-only";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { db } from "@/lib/db";

const ALLOWED_BAO_ROLES = new Set(["admin", "bao"]);

export async function getBaoAccess() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return { session: null, status: 401 };
  }

  const [rows] = await db.query(
    "SELECT role, status FROM users WHERE id = $1",
    [userId]
  );
  const user = rows[0];

  if (
    !user ||
    user.status !== "active" ||
    !ALLOWED_BAO_ROLES.has(user.role)
  ) {
    return { session: null, status: 403 };
  }

  return { session, status: 200 };
}
