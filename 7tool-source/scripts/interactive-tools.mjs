import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import {
  approveInteractiveTool,
  createInteractiveToolDraft,
  listInteractiveToolQueue,
  markStaleInteractiveTools,
  publishInteractiveTool,
  rejectInteractiveTool,
} from "../src/lib/tool-platform.mjs";

const command = process.argv[2];
const inputArg = process.argv.find((arg) => arg.startsWith("--input="));
const dbArg = process.argv.find((arg) => arg.startsWith("--db="));
const apply = process.argv.includes("--apply");
const dbPath = path.resolve(dbArg?.slice("--db=".length) || process.env.SQLITE_PATH || "data.db");

function usage() {
  return [
    "Usage: node scripts/interactive-tools.mjs <command> [--input=<reviewed.json>] [--db=<sqlite>] [--apply]",
    "Commands: draft, approve, publish, reject, stale, list",
    "RPM rules require current VERIFIED TOOL_RULE assertions; selectors read only current VERIFIED product facts.",
    "All mutations require --apply and explicit actorType/actorId; approval/publication require HUMAN.",
  ].join("\n");
}

const commands = new Set(["draft", "approve", "publish", "reject", "stale", "list"]);
if (!command || !commands.has(command)) throw new Error(usage());
if (!fs.existsSync(dbPath)) throw new Error(`SQLite database does not exist: ${dbPath}`);
const input = inputArg ? JSON.parse(fs.readFileSync(path.resolve(inputArg.slice("--input=".length)), "utf8")) : {};
if (command !== "list" && !inputArg) throw new Error(`--input is required\n${usage()}`);
if (command !== "list" && !apply) throw new Error(`Mutating commands require explicit --apply\n${usage()}`);

const database = new Database(dbPath, { fileMustExist: true });
database.pragma("foreign_keys = ON");
database.pragma("busy_timeout = 5000");
try {
  const schema = database.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = 'interactive_tool_sets'").get();
  if (!schema) throw new Error("Interactive Tools schema is missing; apply migration 010 through the guarded migration runner first");
  const handlers = {
    draft: createInteractiveToolDraft,
    approve: approveInteractiveTool,
    publish: publishInteractiveTool,
    reject: rejectInteractiveTool,
    stale: markStaleInteractiveTools,
    list: listInteractiveToolQueue,
  };
  console.log(JSON.stringify(handlers[command](database, input), null, 2));
} finally {
  database.close();
}
