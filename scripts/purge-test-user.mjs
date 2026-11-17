// Maintenance only. Default: preview. Never called by the application.
import { createHash } from "node:crypto";
import { mkdir, open, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

const deletionOrder = [
  "wallet_transactions", "payment_refunds", "payment_allocations", "payouts",
  "cashout_requests", "wallet_destinations", "wallets", "order_commissions",
  "marketplace_report_updates", "marketplace_reports", "bao_audit_logs",
  "messages", "conversations", "cart_items", "carts", "wishlist", "ratings",
  "product_reviews", "user_activity", "notifications", "seller_applications",
  "marketplace_realtime_channels", "order_items", "orders", "payments",
  "product_attributes", "product_images", "product_variants", "products", "users",
];
const protectedTriggers = {
  wallet_transactions: "protect_wallet_ledger",
  order_commissions: "trg_commission_immutable",
  marketplace_report_updates: "trg_report_updates_immutable",
  bao_audit_logs: "trg_bao_audit_immutable",
};
const keyColumn = table => table === "payment_allocations" ? "order_id"
  : table === "marketplace_realtime_channels" ? "user_id" : "id";
const quote = value => `"${value.replaceAll('"', '""')}"`;
const digest = value => createHash("sha256").update(value).digest("hex");
const sameId = (a, b) => a != null && b != null && String(a) === String(b);
const money = value => {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(String(value));
  if (!match) throw new Error("Unsupported monetary precision; cleanup stopped.");
  return (match[1] ? -1n : 1n) * (BigInt(match[2]) * 100n + BigInt((match[3] || "").padEnd(2, "0")));
};

export function buildCleanupPlan(tables, userId) {
  const rows = table => tables[table] || [];
  const account = rows("users").find(row => sameId(row.id, userId));
  if (!account) throw new Error("User does not exist; nothing was deleted.");
  if (!["user", "seller"].includes(account.role)) throw new Error("Staff accounts are protected.");

  const selected = new Map();
  const has = (table, value) => value != null && !!selected.get(table)?.has(String(value));
  const select = (table, predicate) => {
    selected.set(table, new Set(rows(table).filter(predicate).map(row => String(row[keyColumn(table)]))));
  };
  select("users", row => sameId(row.id, userId));
  select("products", row => sameId(row.seller_id, userId));
  const productOrderIds = new Set(rows("order_items").filter(row => has("products", row.product_id)).map(row => String(row.order_id)));
  select("orders", row => sameId(row.user_id, userId) || sameId(row.seller_id, userId) || productOrderIds.has(String(row.id)));
  select("order_items", row => has("orders", row.order_id));

  // Old orders do not have seller_id. Refuse to erase another seller's lines
  // just because a legacy checkout also contained this account's product.
  for (const order of rows("orders").filter(row => has("orders", row.id))) {
    const items = rows("order_items").filter(row => sameId(row.order_id, order.id));
    if (!sameId(order.user_id, userId) && !sameId(order.seller_id, userId)
      && items.some(item => !has("products", item.product_id))) {
      throw new Error(`Legacy order ${order.id} contains unrelated products; cleanup stopped.`);
    }
    if (order.stock_reserved && items.some(item => !has("products", item.product_id))) {
      throw new Error(`Order ${order.id} needs another seller's stock reconciled first.`);
    }
  }

  const allocationPayments = new Set(rows("payment_allocations")
    .filter(row => has("orders", row.order_id) || sameId(row.seller_id, userId)).map(row => String(row.payment_id)));
  select("payments", row => sameId(row.user_id, userId) || allocationPayments.has(String(row.id)));
  select("payment_allocations", row => has("payments", row.payment_id) || has("orders", row.order_id));
  for (const payment of rows("payments").filter(row => has("payments", row.id))) {
    if (payment.livemode !== false) throw new Error("Live or unverified payment mode; cleanup stopped.");
    if (["initializing", "pending"].includes(payment.status)) throw new Error("Resolve pending provider checkouts before cleanup.");
  }
  if (rows("payment_allocations").some(row => has("payment_allocations", row.order_id) && !has("orders", row.order_id))) {
    throw new Error("A payment is shared with unrelated orders; cleanup stopped.");
  }
  select("payment_refunds", row => has("payments", row.payment_id));
  select("wallets", row => sameId(row.owner_id, userId) && row.kind === "seller");
  select("wallet_destinations", row => has("wallets", row.wallet_id) || sameId(row.seller_id, userId));
  select("cashout_requests", row => has("wallets", row.wallet_id) || sameId(row.seller_id, userId));
  select("payouts", row => has("cashout_requests", row.cashout_id));
  if (selected.get("payouts").size || rows("cashout_requests").some(row => has("cashout_requests", row.id)
    && ["processing", "completed"].includes(row.status))) {
    throw new Error("External payouts require separate reconciliation; cleanup stopped.");
  }
  select("wallet_transactions", row => has("wallets", row.wallet_id) || has("orders", row.order_id)
    || has("payments", row.payment_id) || has("cashout_requests", row.cashout_id));
  // Removing a test commission must not spend funds from a different sale.
  const balances = new Map();
  for (const row of rows("wallet_transactions")) {
    if (has("wallet_transactions", row.id)) continue;
    const key = `${row.wallet_id}:${row.bucket}`;
    balances.set(key, (balances.get(key) || 0n) + money(row.amount));
  }
  if ([...balances.values()].some(value => value < 0n)) throw new Error("Cleanup would leave a negative wallet balance.");
  select("order_commissions", row => has("orders", row.order_id));
  select("marketplace_reports", row => sameId(row.reporter_id, userId) || sameId(row.related_seller_id, userId)
    || has("orders", row.related_order_id) || has("products", row.related_product_id));
  select("marketplace_report_updates", row => has("marketplace_reports", row.report_id));
  select("conversations", row => sameId(row.buyer_id, userId) || sameId(row.seller_id, userId) || has("products", row.product_id));
  select("messages", row => has("conversations", row.conversation_id) || sameId(row.sender_id, userId));
  select("carts", row => sameId(row.user_id, userId));
  select("cart_items", row => has("carts", row.cart_id) || has("products", row.product_id));
  for (const table of ["wishlist", "ratings", "product_reviews", "user_activity"]) {
    select(table, row => sameId(row.user_id, userId) || has("products", row.product_id));
  }
  if (rows("product_reviews").some(row => has("product_reviews", row.id) && !has("products", row.product_id))) {
    throw new Error("Reviews on another seller's products need rating totals reconciled first.");
  }
  const orderReference = new RegExp(`#(?:${[...selected.get("orders")].join("|") || "(?!)"})(?!\\d)`);
  const paymentReferences = rows("payments").filter(row => has("payments", row.id)).map(row => row.reference).filter(Boolean);
  select("notifications", row => sameId(row.user_id, userId)
    || (["payment", "order"].includes(row.type) && (orderReference.test(row.message || "")
      || paymentReferences.some(reference => (row.message || "").includes(reference)))));
  select("seller_applications", row => sameId(row.user_id, userId));
  select("marketplace_realtime_channels", row => sameId(row.user_id, userId));
  for (const table of ["product_attributes", "product_images", "product_variants"]) select(table, row => has("products", row.product_id));
  const entityTables = {
    user: "users", seller: "users", product: "products", order: "orders", payment: "payments",
    wallet: "wallets", wallet_destination: "wallet_destinations", cashout_request: "cashout_requests",
    marketplace_report: "marketplace_reports", report: "marketplace_reports", seller_application: "seller_applications",
  };
  select("bao_audit_logs", row => sameId(row.actor_id, userId) || has(entityTables[row.entity_type], row.entity_id));

  // Keep settings and staff decisions about unrelated accounts intact.
  const attribution = {
    bao_commission_rates: ["changed_by"], finance_settings: ["updated_by"],
    marketplace_reports: ["assigned_to"], marketplace_report_updates: ["updated_by"],
    seller_applications: ["reviewed_by"], payouts: ["recorded_by"],
    cashout_requests: ["requested_by", "reviewed_by"], wallet_destinations: ["submitted_by", "reviewed_by"],
  };
  for (const [table, columns] of Object.entries(attribution)) {
    if (rows(table).some(row => !has(table, row[keyColumn(table)]) && columns.some(column => sameId(row[column], userId)))) {
      throw new Error(`User is attributed to unrelated ${table} records; cleanup stopped.`);
    }
  }
  return selected;
}

async function snapshot(client, names) {
  const raw = {}, tables = {};
  for (const name of names) {
    const result = await client.query(`SELECT to_jsonb(t)::text AS record FROM public.${quote(name)} t`);
    raw[name] = result.rows.map(row => row.record).sort();
    tables[name] = raw[name].map(row => JSON.parse(row));
  }
  return { raw, tables };
}

async function definitions(client) {
  const { rows } = await client.query(`
    SELECT 'constraint' AS kind, conrelid::regclass::text AS relation, conname AS name,
      pg_get_constraintdef(oid) AS definition, NULL::text AS enabled FROM pg_constraint
      WHERE connamespace='public'::regnamespace
    UNION ALL SELECT 'trigger', tgrelid::regclass::text, tgname, pg_get_triggerdef(oid), tgenabled::text
      FROM pg_trigger WHERE tgrelid IN (SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace) AND NOT tgisinternal
    UNION ALL SELECT 'function', '', oid::regprocedure::text, pg_get_functiondef(oid), NULL::text
      FROM pg_proc WHERE pronamespace='public'::regnamespace AND prokind='f'
    ORDER BY 1,2,3`);
  return JSON.stringify(rows);
}

export function serializeBackup(raw, schema, userId) {
  // Keep raw Postgres JSON so large numeric values are never rounded by JS.
  const entries = Object.entries(raw).map(([name, records]) => `${JSON.stringify(name)}:[${records.join(",")}]`).join(",");
  const payload = `{"format":"piyumart-public-snapshot-v1","userId":${userId},"createdAt":${JSON.stringify(new Date().toISOString())},"definitions":${schema},"tables":{${entries}}}`;
  JSON.parse(payload); // A malformed backup must stop the cleanup before writes.
  return payload;
}

async function saveBackup(before, schema, userId) {
  const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
  const directory = resolve(root, "backups", "test-user-cleanup");
  await mkdir(directory, { recursive: true });
  const filename = resolve(directory, `user-${userId}-${new Date().toISOString().replaceAll(/[:.]/g, "-")}.json`);
  const payload = serializeBackup(before.raw, schema, userId);
  const handle = await open(filename, "wx", 0o600);
  try { await handle.writeFile(payload); await handle.sync(); } finally { await handle.close(); }
  if (digest(await readFile(filename)) !== digest(payload)) throw new Error("Backup verification failed.");
  return { path: filename, sha256: digest(payload) };
}

export async function runCleanup(client, userId, mode = "preview") {
  if (!Number.isSafeInteger(userId) || userId < 1) throw new Error("Provide a positive integer user ID.");
  if (!["preview", "rehearse", "execute"].includes(mode)) throw new Error("Unknown cleanup mode.");
  let committed = false;
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout='5s'");
    await client.query("SET LOCAL statement_timeout='30s'");
    await client.query("SELECT pg_advisory_xact_lock($1,$2)", [817206, 71]);
    const { rows: relations } = await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
    const names = relations.map(row => row.tablename);
    // Prevent concurrent writes while taking the backup and restoring triggers.
    await client.query(`LOCK TABLE ${names.map(name => `public.${quote(name)}`).join(",")} IN SHARE ROW EXCLUSIVE MODE`);
    const before = await snapshot(client, names), schema = await definitions(client);
    const plan = buildCleanupPlan(before.tables, userId);
    const counts = Object.fromEntries([...plan].filter(([, ids]) => ids.size).map(([table, ids]) => [table, ids.size]));
    if (mode === "preview") {
      await client.query("ROLLBACK");
      return { mode, userId, counts, changed: false };
    }
    const backup = mode === "execute" ? await saveBackup(before, schema, userId) : undefined;
    for (const table of deletionOrder) {
      const ids = [...(plan.get(table) || [])];
      if (!ids.length) continue;
      const trigger = protectedTriggers[table];
      if (trigger) {
        const { rows } = await client.query("SELECT tgenabled FROM pg_trigger WHERE tgrelid=$1::regclass AND tgname=$2", [`public.${table}`, trigger]);
        if (rows.length !== 1 || rows[0].tgenabled !== "O") throw new Error(`Unexpected trigger state on ${table}.`);
        // Only the named history guard is paused, inside this locked transaction.
        // Foreign keys and all realtime triggers continue to run.
        await client.query(`ALTER TABLE public.${quote(table)} DISABLE TRIGGER ${quote(trigger)}`);
      }
      const result = await client.query(`DELETE FROM public.${quote(table)} WHERE ${quote(keyColumn(table))}::text=ANY($1::text[])`, [ids]);
      if (result.rowCount !== ids.length) throw new Error(`Unexpected deletion count on ${table}.`);
      if (trigger) await client.query(`ALTER TABLE public.${quote(table)} ENABLE TRIGGER ${quote(trigger)}`);
    }
    const after = await snapshot(client, names);
    // Every row outside the approved selection must be byte-for-byte unchanged.
    for (const table of names) {
      const expected = before.raw[table].filter(raw => !plan.get(table)?.has(String(JSON.parse(raw)[keyColumn(table)])));
      if (JSON.stringify(expected) !== JSON.stringify(after.raw[table])) throw new Error(`Unexpected changes in ${table}; rolling back.`);
    }
    if (await definitions(client) !== schema) throw new Error("Database definitions changed; rolling back.");
    await client.query(mode === "execute" ? "COMMIT" : "ROLLBACK");
    committed = mode === "execute";
    if (!committed) {
      const restored = await snapshot(client, names);
      if (JSON.stringify(restored.raw) !== JSON.stringify(before.raw) || await definitions(client) !== schema) {
        throw new Error("Rehearsal rollback verification failed.");
      }
    }
    return { mode, userId, counts, changed: committed, verified: true, backup };
  } catch (error) {
    if (!committed) await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const idArg = args.find(arg => /^--user-id=\d+$/.test(arg));
  if (!idArg || args.some(arg => arg !== idArg && !["--execute", "--rehearse"].includes(arg))
    || (args.includes("--execute") && args.includes("--rehearse"))) {
    throw new Error("Usage: node scripts/purge-test-user.mjs --user-id=21 [--rehearse | --execute]");
  }
  dotenv.config({ path: fileURLToPath(new URL("../.env.local", import.meta.url)), quiet: true });
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
  try {
    await client.connect();
    const result = await runCleanup(client, Number(idArg.split("=")[1]), args.includes("--execute") ? "execute" : args.includes("--rehearse") ? "rehearse" : "preview");
    console.log(JSON.stringify(result, null, 2));
  } finally { await client.end(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    // Database errors may contain personal details; print only their code.
    console.error(error.code ? `Cleanup failed (${error.code}); transaction rolled back.` : error.message);
    process.exitCode = 1;
  });
}
