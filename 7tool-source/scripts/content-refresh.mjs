import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import {
  assessContentPublicationCollision,
  evaluateContentRefresh,
  getContentRefreshStatus,
  materializeContentRefresh,
  registerExpertProfile,
  reviewContentByExpert,
  reviewContentRefreshAssessment,
} from "../src/lib/content-refresh.mjs";

const command = process.argv[2];
const apply = process.argv.includes("--apply");
const value = (name) => process.argv.find((argument) => argument.startsWith(`--${name}=`))?.slice(name.length + 3);
const dbPath = path.resolve(value("db") || process.env.SQLITE_PATH || "data.db");
const inputPath = value("input");
const input = inputPath ? JSON.parse(fs.readFileSync(path.resolve(inputPath), "utf8")) : {};

function usage() {
  return [
    "Usage: node scripts/content-refresh.mjs <command> [options]",
    "Commands:",
    "  assess --input=<refresh-evidence.json>",
    "  materialize --input=<refresh-evidence.json> --apply",
    "  review --assessment-id=<id> --decision=KEEP|UPDATE|MERGE|REDIRECT|NOINDEX|DELETE --rationale=<text> --reviewed-by=<human> [--target-site-url-id=<id>] --apply",
    "  collision --content-id=<id> [--similarity-threshold=0.82]",
    "  register-expert --input=<verified-expert.json> --apply",
    "  expert-review --input=<expert-review.json> --apply",
    "  status [--run-id=<id>]",
    "Review records never execute DELETE, REDIRECT, NOINDEX, MERGE or publication automatically.",
  ].join("\n");
}

const commands = new Set([
  "assess", "materialize", "review", "collision", "register-expert", "expert-review", "status",
]);
if (!commands.has(command)) throw new Error(usage());
if (new Set(["materialize", "review", "register-expert", "expert-review"]).has(command) && !apply) {
  throw new Error(`Mutating commands require --apply\n${usage()}`);
}
if (new Set(["assess", "materialize", "register-expert", "expert-review"]).has(command) && !inputPath) {
  throw new Error(`${command} requires --input\n${usage()}`);
}

const database = new Database(dbPath, { readonly: !apply, fileMustExist: true });
database.pragma("foreign_keys = ON");
if (apply) database.pragma("busy_timeout = 5000");

try {
  let result;
  if (command === "assess") result = evaluateContentRefresh(database, input);
  if (command === "materialize") result = materializeContentRefresh(database, input);
  if (command === "review") result = reviewContentRefreshAssessment(database, {
    assessmentId: value("assessment-id"), decision: value("decision"),
    rationale: value("rationale"), reviewedBy: value("reviewed-by"),
    targetSiteUrlId: value("target-site-url-id"),
  });
  if (command === "collision") result = assessContentPublicationCollision(database, value("content-id"), {
    semanticSimilarityThreshold: value("similarity-threshold") ?? 0.82,
  });
  if (command === "register-expert") result = registerExpertProfile(database, input);
  if (command === "expert-review") result = reviewContentByExpert(database, input);
  if (command === "status") result = getContentRefreshStatus(database, { runId: value("run-id") });
  console.log(JSON.stringify(result, null, 2));
} finally {
  database.close();
}
