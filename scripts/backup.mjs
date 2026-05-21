import cron from "node-cron";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------- ENV ----------------
const envPath = path.resolve(__dirname, "../.env.local");

if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, "utf-8");

  envFile.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    const [key, ...rest] = trimmed.split("=");
    if (key && rest.length) {
      process.env[key.trim()] = rest.join("=").trim();
    }
  });
}

// ---------------- CONFIG ----------------
const BACKUP_DIR = path.join(__dirname, "backups");
const MAX_BACKUPS = 3;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ---------------- HELPERS ----------------
function ts() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ---------------- SQL CONVERTER ----------------
function toSQL(table, row) {
  const cols = Object.keys(row).map((c) => `"${c}"`).join(", ");

  const vals = Object.values(row)
    .map((v) =>
      v === null ? "NULL" : `'${String(v).replace(/'/g, "''")}'`
    )
    .join(", ");

  return `INSERT INTO "${table}" (${cols}) VALUES (${vals});`;
}

// ---------------- DATABASE BACKUP ----------------
async function backupDatabase(outDir) {
  console.log("\n📦 Database backup...");

  const { data: tables } = await supabase.rpc("get_all_tables");

  for (const { table_name } of tables || []) {
    const { data } = await supabase.from(table_name).select("*");

    let sql = `-- TABLE: ${table_name}\n`;

    for (const row of data || []) {
      sql += toSQL(table_name, row) + "\n";
    }

    fs.writeFileSync(
      path.join(outDir, `${table_name}.sql`),
      sql
    );

    console.log(`✅ ${table_name} → SQL`);
  }
}

// ---------------- STORAGE RECURSIVE FIX ----------------
async function downloadFolder(bucket, prefix, outDir) {
  const { data: files, error } = await supabase.storage
    .from(bucket)
    .list(prefix, { limit: 1000 });

  if (error) {
    console.warn(`⚠️ ${bucket}/${prefix}:`, error.message);
    return;
  }

  for (const file of files || []) {
    if (!file.name) continue;

    const fullPath = prefix ? `${prefix}/${file.name}` : file.name;

    // folder (no metadata = treated as folder)
    if (!file.metadata) {
      await downloadFolder(bucket, fullPath, outDir);
      continue;
    }

    const { data } = await supabase.storage
      .from(bucket)
      .download(fullPath);

    if (!data) continue;

    const buffer = Buffer.from(await data.arrayBuffer());

    const savePath = path.join(outDir, fullPath);
    ensureDir(path.dirname(savePath));

    fs.writeFileSync(savePath, buffer);
  }
}

// ---------------- STORAGE BACKUP ----------------
async function backupStorage(outDir) {
  console.log("\n🖼️ Storage backup...");

  const { data: buckets } = await supabase.storage.listBuckets();

  for (const bucket of buckets || []) {
    const bucketDir = path.join(outDir, bucket.name);
    ensureDir(bucketDir);

    await downloadFolder(bucket.name, "", bucketDir);

    console.log(`✅ bucket: ${bucket.name}`);
  }
}

// ---------------- CLEAN OLD BACKUPS ----------------
function cleanupOldBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return;

  const folders = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) =>
      fs.statSync(path.join(BACKUP_DIR, f)).isDirectory()
    )
    .sort((a, b) => b.localeCompare(a));

  const toDelete = folders.slice(MAX_BACKUPS);

  for (const folder of toDelete) {
    fs.rmSync(path.join(BACKUP_DIR, folder), {
      recursive: true,
      force: true,
    });
    console.log("🗑️ deleted:", folder);
  }
}

// ---------------- MAIN ----------------
let running = false;

async function runBackup() {
  if (running) return;
  running = true;

  try {
    console.log("\n🔄 Backup started:", new Date().toLocaleString());

    const id = ts();
    const outDir = path.join(BACKUP_DIR, id);

    ensureDir(outDir);

    await backupDatabase(outDir);
    await backupStorage(outDir);

    cleanupOldBackups();

    console.log("\n🎉 BACKUP DONE:", id);
  } catch (err) {
    console.error("❌ Backup failed:", err);
  } finally {
    running = false;
  }
}

// ---------------- START ----------------
runBackup();

cron.schedule("0 2 * * *", runBackup, {
  timezone: "Asia/Manila",
});

console.log("🕐 Backup running (keeps only 3 latest backups)");