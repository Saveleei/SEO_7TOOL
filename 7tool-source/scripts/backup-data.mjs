import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const source = path.resolve(process.env.SQLITE_PATH || path.join(root, "data.db"));
const backupDir = path.resolve(process.env.BACKUP_DIR || path.join(root, "backups"));
const retentionDays = Math.max(1, Number(process.env.BACKUP_RETENTION_DAYS || 14));

if (!fs.existsSync(source)) {
  throw new Error(`SQLite database not found: ${source}`);
}
fs.mkdirSync(backupDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const target = path.join(backupDir, `data-${stamp}.db`);
const database = new Database(source, { readonly: true, fileMustExist: true });
await database.backup(target);
database.close();

const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
for (const entry of fs.readdirSync(backupDir, { withFileTypes: true })) {
  if (!entry.isFile() || !/^data-\d{4}-\d{2}-\d{2}T.*\.db$/.test(entry.name)) continue;
  const candidate = path.resolve(backupDir, entry.name);
  if (path.dirname(candidate) !== backupDir) continue;
  if (fs.statSync(candidate).mtimeMs < cutoff) fs.rmSync(candidate);
}

console.log(`SQLite backup created: ${target}`);
