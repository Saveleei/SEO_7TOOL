import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import {
  approveArticleBrief,
  createArticleBrief,
  createArticleCandidate,
  listEditorialArticles,
  replaceRelatedArticles,
  reviewContentSource,
  saveArticleRevision,
  transitionArticle,
} from "../src/lib/content-platform.mjs";

const command = process.argv[2];
const inputArg = process.argv.find((arg) => arg.startsWith("--input="));
const dbArg = process.argv.find((arg) => arg.startsWith("--db="));
const apply = process.argv.includes("--apply");
const dbPath = path.resolve(dbArg?.slice("--db=".length) || process.env.SQLITE_PATH || "data.db");

function usage() {
  return [
    "Usage: node scripts/content-platform.mjs <command> --input=<reviewed.json> [--db=<sqlite>] [--apply]",
    "Commands: create-candidate, create-brief, approve-brief, save-revision, review-source, transition, related, list",
    "All mutating commands require explicit actorType and actorId in the input JSON.",
  ].join("\n");
}

if (!command || !new Set([
  "create-candidate", "create-brief", "approve-brief", "save-revision",
  "review-source", "transition", "related", "list",
]).has(command)) {
  throw new Error(usage());
}
if (!fs.existsSync(dbPath)) throw new Error(`SQLite database does not exist: ${dbPath}`);
const input = inputArg
  ? JSON.parse(fs.readFileSync(path.resolve(inputArg.slice("--input=".length)), "utf8"))
  : {};
if (command !== "list" && !inputArg) throw new Error(`--input is required\n${usage()}`);
if (command !== "list" && !apply) throw new Error(`Mutating commands require explicit --apply\n${usage()}`);

const database = new Database(dbPath, { fileMustExist: true });
database.pragma("foreign_keys = ON");
database.pragma("busy_timeout = 5000");
try {
  const schema = database.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = 'content_assets'").get();
  if (!schema) throw new Error("Content Platform schema is missing; apply migration 007 through the guarded migration runner first");
  const handlers = {
    "create-candidate": createArticleCandidate,
    "create-brief": createArticleBrief,
    "approve-brief": approveArticleBrief,
    "save-revision": saveArticleRevision,
    "review-source": reviewContentSource,
    transition: transitionArticle,
    related: replaceRelatedArticles,
    list: (db) => listEditorialArticles(db, input),
  };
  const result = handlers[command](database, input);
  console.log(JSON.stringify(result, null, 2));
} finally {
  database.close();
}
