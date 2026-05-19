import cron from 'node-cron';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Manually read .env.local
const envPath = path.resolve(__dirname, '../.env.local');
const envFile = fs.readFileSync(envPath, 'utf-8');
envFile.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const [key, ...rest] = trimmed.split('=');
  if (key && rest.length) {
    process.env[key.trim()] = rest.join('=').trim();
  }
});

const BACKUP_DIR = './backups';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function getTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// --- Database Backup (auto-detects all tables) ---
async function backupDatabase() {
  const timestamp = getTimestamp();
  const outDir = path.join(BACKUP_DIR, 'db', timestamp);
  ensureDir(outDir);

  console.log('\n📦 Backing up database tables...');

  // Auto-fetch all table names
  const { data: tableList, error: tableError } = await supabase
    .rpc('get_all_tables');

  if (tableError) {
    console.error('❌ Failed to fetch table list:', tableError.message);
    return;
  }

  for (const { table_name } of tableList) {
    const { data, error } = await supabase.from(table_name).select('*');

    if (error) {
      console.error(`❌ Failed to back up table "${table_name}":`, error.message);
      continue;
    }

    const outFile = path.join(outDir, `${table_name}.json`);
    fs.writeFileSync(outFile, JSON.stringify(data, null, 2));
    console.log(`✅ ${table_name} → ${data.length} rows saved`);
  }
}

// --- Storage Backup ---
async function backupStorage() {
  const timestamp = getTimestamp();
  const outDir = path.join(BACKUP_DIR, 'storage', timestamp);
  ensureDir(outDir);

  console.log('\n🖼️  Backing up storage...');

  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) return console.error('❌ Failed to list buckets:', error.message);

  for (const bucket of buckets) {
    const bucketDir = path.join(outDir, bucket.name);
    ensureDir(bucketDir);

    const { data: files } = await supabase.storage.from(bucket.name).list('', { limit: 1000 });
    if (!files || files.length === 0) continue;

    for (const file of files) {
      if (!file.name) continue;

      const { data, error: dlErr } = await supabase.storage
        .from(bucket.name)
        .download(file.name);

      if (dlErr) {
        console.warn(`⚠️  Skipped ${file.name}:`, dlErr.message);
        continue;
      }

      const buffer = Buffer.from(await data.arrayBuffer());
      fs.writeFileSync(path.join(bucketDir, file.name), buffer);
    }

    console.log(`✅ Bucket "${bucket.name}" → ${files.length} files saved`);
  }
}

// --- Delete backups older than 7 days ---
function cleanOldBackups() {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;

  for (const subDir of ['db', 'storage']) {
    const dir = path.join(BACKUP_DIR, subDir);
    if (!fs.existsSync(dir)) continue;

    fs.readdirSync(dir).forEach((folder) => {
      const folderPath = path.join(dir, folder);
      const { mtimeMs } = fs.statSync(folderPath);
      if (mtimeMs < cutoff) {
        fs.rmSync(folderPath, { recursive: true });
        console.log(`🗑️  Deleted old backup: ${folderPath}`);
      }
    });
  }
}

// --- Main ---
async function runBackup() {
  console.log(`\n🔄 Backup started at ${new Date().toLocaleString()}`);
  await backupDatabase();
  await backupStorage();
  cleanOldBackups();
  console.log('\n🎉 Backup complete!');
}

// Run immediately on start
runBackup();

// Schedule daily at 2:00 AM
cron.schedule('0 2 * * *', runBackup);
console.log('🕐 Scheduler active — daily backup at 2:00 AM');