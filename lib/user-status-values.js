import "server-only";

import { db } from "@/lib/db";

export async function getUserStatusValues() {
  const [rows] = await db.query(`
    SELECT e.enumlabel AS value
    FROM pg_enum AS e
    INNER JOIN pg_type AS t ON t.oid = e.enumtypid
    WHERE t.typname = 'user_status'
    ORDER BY e.enumsortorder
  `);

  return rows.map((row) => row.value);
}
