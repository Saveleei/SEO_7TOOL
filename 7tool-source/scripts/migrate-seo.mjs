import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = path.join(root, "scripts", "migrations");
const dbPath = path.resolve(process.env.SQLITE_PATH || path.join(root, "data.db"));
const apply = process.argv.includes("--apply");
const backupArg = process.argv.find((arg) => arg.startsWith("--backup="));
const backupPath = backupArg ? path.resolve(backupArg.slice("--backup=".length)) : null;

function splitMigration(sql, filename) {
  const upMarker = "-- migrate:up";
  const downMarker = "-- migrate:down";
  const upIndex = sql.indexOf(upMarker);
  const downIndex = sql.indexOf(downMarker);
  if (upIndex < 0 || downIndex < 0 || downIndex <= upIndex) {
    throw new Error(`${filename}: required migrate markers are missing or out of order`);
  }
  return {
    up: sql.slice(upIndex + upMarker.length, downIndex).trim(),
    down: sql.slice(downIndex + downMarker.length).trim(),
  };
}

function migrationFiles() {
  return fs.readdirSync(migrationsDir)
    .filter((name) => /^\d{3}_[a-z0-9_]+\.sql$/.test(name))
    .sort()
    .map((name) => {
      const sql = fs.readFileSync(path.join(migrationsDir, name), "utf8");
      const { up, down } = splitMigration(sql, name);
      return {
        id: name.slice(0, -4),
        name,
        checksum: createHash("sha256").update(sql).digest("hex"),
        up,
        down,
      };
    });
}

const files = migrationFiles();
if (!apply) {
  console.log(JSON.stringify({ mode: "dry-run", dbPath, migrations: files.map(({ id, checksum }) => ({ id, checksum })) }, null, 2));
  process.exit(0);
}

if (!backupPath || !fs.existsSync(backupPath) || path.resolve(backupPath) === dbPath) {
  throw new Error("--apply requires --backup=<existing separate sqlite backup>");
}

for (const candidate of [dbPath, backupPath]) {
  const checkDb = new Database(candidate, { readonly: true, fileMustExist: true });
  const integrity = checkDb.pragma("integrity_check", { simple: true });
  checkDb.close();
  if (integrity !== "ok") throw new Error(`SQLite integrity check failed for ${candidate}: ${integrity}`);
}

const db = new Database(dbPath, { fileMustExist: true });
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");
db.exec(`
  CREATE TABLE IF NOT EXISTS seo_schema_migrations (
    id TEXT PRIMARY KEY,
    checksum TEXT NOT NULL,
    applied_at INTEGER NOT NULL
  );
`);

try {
  for (const migration of files) {
    const existing = db.prepare("SELECT checksum FROM seo_schema_migrations WHERE id = ?").get(migration.id);
    if (existing) {
      if (existing.checksum !== migration.checksum) throw new Error(`Applied migration changed: ${migration.id}`);
      continue;
    }
    db.transaction(() => {
      db.exec(migration.up);
      db.prepare("INSERT INTO seo_schema_migrations (id, checksum, applied_at) VALUES (?, ?, ?)")
        .run(migration.id, migration.checksum, Date.now());
    })();
    console.log(`applied ${migration.id}`);
  }
  const foreignKeyErrors = db.pragma("foreign_key_check");
  const integrity = db.pragma("integrity_check", { simple: true });
  if (integrity !== "ok" || foreignKeyErrors.length) {
    throw new Error(`postflight failed: integrity=${integrity}, fk_errors=${foreignKeyErrors.length}`);
  }
} finally {
  db.close();
}
