import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseKeywordImport } from "./lib/keyword-import.mjs";
import { importKeywordBatch, persistConservativeClusters } from "../src/lib/semantic-intelligence.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const value = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const apply = process.argv.includes("--apply");
const file = value("file");
const sourceType = (value("source") || "MANUAL").toUpperCase();
const sourceId = value("source-id") || sourceType.toLocaleLowerCase("en-US");
const region = value("region") || "RU";
const language = value("language") || "ru";
const categorySlug = value("category") || undefined;
const format = value("format") || "auto";
const dbPath = path.resolve(process.env.SQLITE_PATH || path.join(root, "data.db"));

if (!file) throw new Error("--file=<csv|json> is required");
const filePath = path.resolve(file);
const rows = parseKeywordImport(fs.readFileSync(filePath, "utf8"), format);
if (!rows.length) throw new Error("Keyword import is empty");

if (!apply) {
  console.log(JSON.stringify({ mode: "dry-run", file: filePath, sourceType, sourceId, region, language, categorySlug, rows: rows.length, sample: rows.slice(0, 5) }, null, 2));
  process.exit(0);
}

const db = new Database(dbPath, { fileMustExist: true });
db.pragma("foreign_keys = ON");
try {
  const required = ["sources", "import_runs", "site_urls", "seo_keywords", "keyword_clusters", "search_intents"];
  const present = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name));
  const missing = required.filter((name) => !present.has(name));
  if (missing.length) throw new Error(`Semantic schema is not applied: ${missing.join(", ")}`);
  const result = importKeywordBatch(db, { sourceType, sourceId, region, language, categorySlug, rows });
  const categories = [...new Set(rows.map((row) => row.categorySlug || categorySlug).filter(Boolean))];
  const clusters = categories.map((slug) => ({ categorySlug: slug, count: persistConservativeClusters(db, { categorySlug: slug, sourceId }).length }));
  console.log(JSON.stringify({ ...result, clusters }, null, 2));
} finally {
  db.close();
}
