import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerOpportunityBusinessInput } from "../src/lib/opportunity-engine.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const value = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const apply = process.argv.includes("--apply");
const categorySlug = value("category");
const clusterId = value("cluster-id");
const businessPriority = Number(value("business-priority"));
const marginBusinessScore = Number(value("margin-business-score"));
const sourceRef = value("source-ref");
const reviewedBy = value("reviewed-by");
const validFrom = value("valid-from") || new Date().toISOString();
const validUntil = value("valid-until") || undefined;
const dbPath = path.resolve(process.env.SQLITE_PATH || path.join(root, "data.db"));

if (!categorySlug || !clusterId || !sourceRef || !reviewedBy
  || !Number.isInteger(businessPriority) || !Number.isInteger(marginBusinessScore)) {
  throw new Error("--category, --cluster-id, --business-priority, --margin-business-score, --source-ref and --reviewed-by are required");
}
if (!apply) {
  console.log(JSON.stringify({
    mode: "dry-run", categorySlug, clusterId, businessPriority, marginBusinessScore,
    hasSourceReference: true, reviewedBy, validFrom, validUntil: validUntil ?? null,
  }, null, 2));
  process.exit(0);
}

const db = new Database(dbPath, { fileMustExist: true });
db.pragma("foreign_keys = ON");
try {
  const ready = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'opportunity_business_inputs'").get();
  if (!ready) throw new Error("Content opportunity schema is not applied");
  const saved = registerOpportunityBusinessInput(db, {
    categorySlug, clusterId, businessPriority, marginBusinessScore,
    sourceRef, reviewedBy, validFrom, validUntil,
  });
  console.log(JSON.stringify({
    id: saved.id, categorySlug: saved.category_slug, clusterId: saved.cluster_id,
    businessPriority: saved.business_priority, marginBusinessScore: saved.margin_business_score,
    status: saved.status, reviewedBy: saved.reviewed_by,
  }, null, 2));
} finally {
  db.close();
}
