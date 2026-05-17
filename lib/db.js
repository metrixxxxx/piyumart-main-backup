import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export const db = {
  query: async (sql, params) => {
    const result = await pool.query(sql, params);
    return [result.rows];
  },
};