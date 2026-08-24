import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import {
  approveSemanticLinkSet,
  createSemanticLinkDraft,
  discoverSemanticLinkItems,
  listSemanticLinkQueue,
  markStaleSemanticLinks,
  publishSemanticLinkSet,
  rejectSemanticLinkSet,
} from "../src/lib/semantic-linking.mjs";

const command = process.argv[2];
const inputArg = process.argv.find((arg) => arg.startsWith("--input="));
const dbArg = process.argv.find((arg) => arg.startsWith("--db="));
const apply = process.argv.includes("--apply");
const dbPath = path.resolve(dbArg?.slice("--db=".length) || process.env.SQLITE_PATH || "data.db");

function usage() {
  return [
    "Usage: node scripts/semantic-linking.mjs <command> [--input=<reviewed.json>] [--db=<sqlite>] [--apply]",
    "Commands: discover, draft, approve, publish, reject, stale, list",
    "discover requires sourceType/sourceId and reads only normalized, public evidence.",
    "All mutations require --apply and explicit actorType/actorId; approval/publication require HUMAN.",
  ].join("\n");
}

const commands = new Set(["discover", "draft", "approve", "publish", "reject", "stale", "list"]);
const mutating = new Set(["draft", "approve", "publish", "reject", "stale"]);
if (!command || !commands.has(command)) throw new Error(usage());
if (!fs.existsSync(dbPath)) throw new Error(`SQLite database does not exist: ${dbPath}`);
const input = inputArg ? JSON.parse(fs.readFileSync(path.resolve(inputArg.slice("--input=".length)), "utf8")) : {};
if (!new Set(["list"]).has(command) && !inputArg) throw new Error(`--input is required\n${usage()}`);
if (mutating.has(command) && !apply) throw new Error(`Mutating commands require explicit --apply\n${usage()}`);

const database = new Database(dbPath, { fileMustExist: true });
database.pragma("foreign_keys = ON");
database.pragma("busy_timeout = 5000");
try {
  const schema = database.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = 'semantic_link_sets'").get();
  if (!schema) throw new Error("Semantic Linking schema is missing; apply migration 011 through the guarded migration runner first");
  const handlers = {
    discover: discoverSemanticLinkItems,
    draft: createSemanticLinkDraft,
    approve: approveSemanticLinkSet,
    publish: publishSemanticLinkSet,
    reject: rejectSemanticLinkSet,
    stale: markStaleSemanticLinks,
    list: listSemanticLinkQueue,
  };
  console.log(JSON.stringify(handlers[command](database, input), null, 2));
} finally {
  database.close();
}
