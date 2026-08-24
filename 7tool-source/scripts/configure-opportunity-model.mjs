import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  approveOpportunityScoreModel,
  createOpportunityScoreModel,
  defaultOpportunityScoreModel,
  validateOpportunityScoreModel,
} from "../src/lib/opportunity-engine.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const value = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const apply = process.argv.includes("--apply");
const approve = process.argv.includes("--approve");
const reviewedBy = value("reviewed-by");
const file = value("file");
const dbPath = path.resolve(process.env.SQLITE_PATH || path.join(root, "data.db"));
const config = file ? JSON.parse(fs.readFileSync(path.resolve(file), "utf8")) : defaultOpportunityScoreModel();
if (value("version")) config.version = value("version");
if (approve && !reviewedBy) throw new Error("--approve requires --reviewed-by");
const validated = validateOpportunityScoreModel(config);

if (!apply) {
  console.log(JSON.stringify({
    mode: "dry-run", action: approve ? "create-and-approve" : "create-draft",
    version: validated.version, checksum: validated.checksum,
    factorWeights: validated.weights.factors, penalties: validated.weights.penalties,
    thresholds: validated.thresholds,
  }, null, 2));
  process.exit(0);
}

const db = new Database(dbPath, { fileMustExist: true });
db.pragma("foreign_keys = ON");
try {
  const ready = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'score_models'").get();
  if (!ready) throw new Error("Content opportunity schema is not applied");
  let model = createOpportunityScoreModel(db, validated);
  if (approve) model = approveOpportunityScoreModel(db, { modelId: model.id, reviewedBy });
  console.log(JSON.stringify({
    id: model.id, version: model.version, checksum: model.model_checksum,
    status: model.status, approvedBy: model.approved_by,
  }, null, 2));
} finally {
  db.close();
}
