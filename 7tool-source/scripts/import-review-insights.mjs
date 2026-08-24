import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseReviewImport } from "./lib/review-import.mjs";
import { extractReviewInsights, importReviewResearchBatch } from "../src/lib/review-intelligence.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const value = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const apply = process.argv.includes("--apply");
const file = value("file");
const platform = value("platform");
const baseUrl = value("base-url");
const accessMethod = value("access-method") || "AUTHORIZED_EXPORT";
const termsStatus = value("terms-status") || "REVIEW_REQUIRED";
const categorySlug = value("category");
const sourceUrl = value("source-url");
const format = value("format") || "auto";
const sourceId = value("source-id") || undefined;
const dbPath = path.resolve(process.env.SQLITE_PATH || path.join(root, "data.db"));

if (!file || !platform) throw new Error("--file and --platform are required");
const filePath = path.resolve(file);
const rows = parseReviewImport(fs.readFileSync(filePath, "utf8"), { format, categorySlug, sourceUrl });
if (!rows.length) throw new Error("Review import is empty");
const insightCounts = {};
for (const row of rows) {
  for (const insight of extractReviewInsights(row)) insightCounts[insight.type] = (insightCounts[insight.type] ?? 0) + 1;
}

if (!apply) {
  // Raw review text and snippets are intentionally absent from CLI output.
  console.log(JSON.stringify({ mode: "dry-run", file: filePath, platform, accessMethod, termsStatus, rows: rows.length, insightCounts }, null, 2));
  process.exit(0);
}

const db = new Database(dbPath, { fileMustExist: true });
db.pragma("foreign_keys = ON");
try {
  const required = ["sources", "import_runs", "review_insights", "pain_points", "pain_point_sources"];
  const present = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name));
  const missing = required.filter((name) => !present.has(name));
  if (missing.length) throw new Error(`Review intelligence schema is not applied: ${missing.join(", ")}`);
  console.log(JSON.stringify(importReviewResearchBatch(db, {
    sourceId, platform, baseUrl, accessMethod, termsStatus, rows,
  }), null, 2));
} finally {
  db.close();
}
