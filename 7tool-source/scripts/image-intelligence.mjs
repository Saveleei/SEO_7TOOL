import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import {
  approveMediaRightsGrant,
  approveMediaSelection,
  createMediaSelectionRequests,
  discoverSupplierMediaLibrary,
  listMediaLibrary,
  processApprovedMedia,
  proposeMediaRightsGrant,
  rankMediaSelection,
  registerAiDiagram,
  reviewMediaNoMatch,
  revokeMediaRightsGrant,
} from "../src/lib/image-intelligence.mjs";

const command = process.argv[2];
const inputArg = process.argv.find((arg) => arg.startsWith("--input="));
const dbArg = process.argv.find((arg) => arg.startsWith("--db="));
const apply = process.argv.includes("--apply");
const dbPath = path.resolve(dbArg?.slice("--db=".length) || process.env.SQLITE_PATH || "data.db");

function usage() {
  return [
    "Usage: node scripts/image-intelligence.mjs <command> [--input=<reviewed.json>] [--db=<sqlite>] [--apply]",
    "Commands: discover, rights-propose, rights-approve, rights-revoke, ai-register, process, requests, rank, no-match, select, list",
    "Discovery never downloads remote media. Processing accepts only a reviewed local file path.",
    "All mutating commands require --apply plus explicit actorType and actorId.",
  ].join("\n");
}

const commands = new Set([
  "discover", "rights-propose", "rights-approve", "rights-revoke", "ai-register",
  "process", "requests", "rank", "no-match", "select", "list",
]);
if (!command || !commands.has(command)) throw new Error(usage());
if (!fs.existsSync(dbPath)) throw new Error(`SQLite database does not exist: ${dbPath}`);
const input = inputArg ? JSON.parse(fs.readFileSync(path.resolve(inputArg.slice("--input=".length)), "utf8")) : {};
if (command !== "list" && !inputArg) throw new Error(`--input is required\n${usage()}`);
if (command !== "list" && !apply) throw new Error(`Mutating commands require explicit --apply\n${usage()}`);

const database = new Database(dbPath, { fileMustExist: true });
database.pragma("foreign_keys = ON");
database.pragma("busy_timeout = 5000");
try {
  const schema = database.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = 'media_assets'").get();
  if (!schema) throw new Error("Image Intelligence schema is missing; apply migration 008 through the guarded migration runner first");
  const handlers = {
    discover: discoverSupplierMediaLibrary,
    "rights-propose": proposeMediaRightsGrant,
    "rights-approve": approveMediaRightsGrant,
    "rights-revoke": revokeMediaRightsGrant,
    "ai-register": registerAiDiagram,
    process: processApprovedMedia,
    requests: createMediaSelectionRequests,
    rank: rankMediaSelection,
    "no-match": reviewMediaNoMatch,
    select: approveMediaSelection,
    list: listMediaLibrary,
  };
  const result = await handlers[command](database, input);
  console.log(JSON.stringify(result, null, 2));
} finally {
  database.close();
}
