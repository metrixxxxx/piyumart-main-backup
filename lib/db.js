import pkg from "pg";
const { Pool, types } = pkg;

// Tell pg to return bigints as strings instead of JS numbers
types.setTypeParser(20, (val) => val); // 20 = bigint OID

const bounded = (name, fallback, min, max) => {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
};
const poolKey = Symbol.for("piyumart.postgres.pool");
const statementTimeout=bounded("DB_STATEMENT_TIMEOUT_MS",20000,1000,120000);
const pool = globalThis[poolKey] || new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: bounded("DB_POOL_MAX", 5, 1, 20),
  connectionTimeoutMillis: bounded("DB_CONNECT_TIMEOUT_MS", 10000, 1000, 60000),
  idleTimeoutMillis: 30000,
  statement_timeout: statementTimeout,
  query_timeout: Math.max(statementTimeout+5000,bounded("DB_QUERY_TIMEOUT_MS",25000,1000,125000)),
  keepAlive: true,
  allowExitOnIdle: true,
});
if (!globalThis[poolKey]) {
  globalThis[poolKey] = pool;
  pool.on("error", error => console.error("Idle database connection failed:", error.code || error.message));
}

export const db = {
  query: async (sql, params) => {
    const result = await pool.query(sql, params);
    return [result.rows];
  },
  transaction: async (callback) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await callback(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Database transaction rollback failed:", rollbackError);
      }
      throw error;
    } finally {
      client.release();
    }
  },
};
