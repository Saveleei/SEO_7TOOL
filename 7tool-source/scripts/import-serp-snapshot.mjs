import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseSerpImport } from "./lib/serp-import.mjs";
import { classifySerpResult, importSerpSnapshot } from "../src/lib/serp-intelligence.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const value = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const apply = process.argv.includes("--apply");
const file = value("file");
const sourceCandidateId = value("source-candidate-id");
const clusterId = value("cluster-id");
const intentId = value("intent-id");
const acquisitionMethod = value("acquisition-method");
const dbPath = path.resolve(process.env.SQLITE_PATH || path.join(root, "data.db"));

if (!file || !sourceCandidateId || !clusterId || !intentId || !acquisitionMethod) {
  throw new Error("--file, --source-candidate-id, --cluster-id, --intent-id and --acquisition-method are required");
}
const filePath = path.resolve(file);
const parsed = parseSerpImport(fs.readFileSync(filePath, "utf8"), {
  engine: value("engine"), query: value("query"), region: value("region") || "RU",
  language: value("language") || "ru", device: value("device") || "DESKTOP",
  capturedAt: value("captured-at"), topN: value("top-n") ? Number(value("top-n")) : undefined,
});
if (!parsed.engine || !parsed.query || !parsed.capturedAt) throw new Error("engine, query and capturedAt are required in file or CLI");
const pageTypeCounts = {};
const siteClassCounts = {};
for (const row of parsed.results) {
  const classified = classifySerpResult(row);
  pageTypeCounts[classified.pageType] = (pageTypeCounts[classified.pageType] ?? 0) + 1;
  siteClassCounts[classified.siteClass] = (siteClassCounts[classified.siteClass] ?? 0) + 1;
}

if (!apply) {
  // Titles, target URLs, summaries and evidence are intentionally absent from CLI output.
  console.log(JSON.stringify({
    mode: "dry-run", file: filePath, engine: parsed.engine, query: parsed.query,
    capturedAt: parsed.capturedAt, results: parsed.results.length, insights: parsed.insights.length,
    pageTypeCounts, siteClassCounts,
  }, null, 2));
  process.exit(0);
}

const db = new Database(dbPath, { fileMustExist: true });
db.pragma("foreign_keys = ON");
try {
  const required = ["serp_source_candidates", "serp_snapshots", "serp_results", "serp_competitor_insights"];
  const present = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name));
  const missing = required.filter((name) => !present.has(name));
  if (missing.length) throw new Error(`SERP intelligence schema is not applied: ${missing.join(", ")}`);
  console.log(JSON.stringify(importSerpSnapshot(db, {
    ...parsed, sourceCandidateId, clusterId, intentId, acquisitionMethod,
  }), null, 2));
} finally {
  db.close();
}
