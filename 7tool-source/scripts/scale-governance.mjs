import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import {
  assessContentQuality,
  createScaleProgram,
  enqueueScaleContent,
  getScaleStatus,
  listScaleCandidates,
  requestNextScaleCheckpoint,
  reviewContentScorecard,
  reviewPublishQueueItem,
  reviewScaleCheckpoint,
} from "../src/lib/scale-governance.mjs";

const command = process.argv[2];
const apply = process.argv.includes("--apply");
const value = (name) => process.argv.find((argument) => argument.startsWith(`--${name}=`))?.slice(name.length + 3);
const dbPath = path.resolve(value("db") || process.env.SQLITE_PATH || "data.db");
const inputPath = value("input");
const input = inputPath ? JSON.parse(fs.readFileSync(path.resolve(inputPath), "utf8")) : {};

function usage() {
  return [
    "Usage: node scripts/scale-governance.mjs <command> [options]",
    "Commands:",
    "  assess --input=<quality-scorecard.json> --apply",
    "  review-scorecard --scorecard-id=<id> --decision=APPROVE|REJECT --reviewed-by=<actor> --apply",
    "  create-scale --pilot-id=<id> --kpi-snapshot-id=<id> --rationale=<text> --created-by=<actor> --apply",
    "  review-checkpoint --review-id=<id> --decision=APPROVE|REJECT --reviewed-by=<actor> --apply",
    "  request-checkpoint --scale-program-id=<id> --kpi-snapshot-id=<id> --rationale=<text> --created-by=<actor> --apply",
    "  candidates --scale-program-id=<id> [--limit=100]",
    "  enqueue --scale-program-id=<id> --content-id=<id> --scheduled-at=<epoch-ms> --requested-by=<actor> --apply",
    "  review-queue --queue-id=<id> --decision=APPROVE|REJECT --reviewed-by=<actor> --apply",
    "  status [--scale-program-id=<id>]",
    "No command creates content or fills a publishing quota automatically.",
  ].join("\n");
}

const commands = new Set([
  "assess", "review-scorecard", "create-scale", "review-checkpoint",
  "request-checkpoint", "candidates", "enqueue", "review-queue", "status",
]);
if (!commands.has(command)) throw new Error(usage());
if (!new Set(["candidates", "status"]).has(command) && !apply) {
  throw new Error(`Mutating commands require --apply\n${usage()}`);
}
if (command === "assess" && !inputPath) throw new Error(`assess requires --input\n${usage()}`);

const database = new Database(dbPath, { readonly: !apply, fileMustExist: true });
database.pragma("foreign_keys = ON");
if (apply) database.pragma("busy_timeout = 5000");

try {
  let result;
  if (command === "assess") result = assessContentQuality(database, input);
  if (command === "review-scorecard") result = reviewContentScorecard(database, {
    scorecardId: value("scorecard-id"), decision: value("decision"), reviewedBy: value("reviewed-by"),
  });
  if (command === "create-scale") result = createScaleProgram(database, {
    pilotId: value("pilot-id"), kpiSnapshotId: value("kpi-snapshot-id"),
    successRationale: value("rationale"), createdBy: value("created-by"),
  });
  if (command === "review-checkpoint") result = reviewScaleCheckpoint(database, {
    reviewId: value("review-id"), decision: value("decision"), reviewedBy: value("reviewed-by"),
  });
  if (command === "request-checkpoint") result = requestNextScaleCheckpoint(database, {
    scaleProgramId: value("scale-program-id"), kpiSnapshotId: value("kpi-snapshot-id"),
    successRationale: value("rationale"), createdBy: value("created-by"),
  });
  if (command === "candidates") result = listScaleCandidates(database, {
    scaleProgramId: value("scale-program-id"), limit: value("limit") || 100,
  });
  if (command === "enqueue") result = enqueueScaleContent(database, {
    scaleProgramId: value("scale-program-id"), contentId: value("content-id"),
    scheduledAt: value("scheduled-at"), requestedBy: value("requested-by"),
  });
  if (command === "review-queue") result = reviewPublishQueueItem(database, {
    queueId: value("queue-id"), decision: value("decision"), reviewedBy: value("reviewed-by"),
  });
  if (command === "status") result = getScaleStatus(database, { scaleProgramId: value("scale-program-id") });
  console.log(JSON.stringify(result, null, 2));
} finally {
  database.close();
}
