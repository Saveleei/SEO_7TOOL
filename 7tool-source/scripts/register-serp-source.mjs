import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { approveSerpSourceCandidate, registerSerpSourceCandidate } from "../src/lib/serp-intelligence.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const value = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const apply = process.argv.includes("--apply");
const approve = process.argv.includes("--approve");
const provider = value("provider");
const engine = value("engine");
const baseUrl = value("base-url");
const discoverySource = value("discovery-source") || "manual-research";
const acquisitionMethod = value("acquisition-method") || "NONE";
const termsStatus = value("terms-status") || "REVIEW_REQUIRED";
const robotsStatus = value("robots-status") || "UNKNOWN";
const reviewedBy = value("reviewed-by");
const notes = value("notes") || undefined;
const dbPath = path.resolve(process.env.SQLITE_PATH || path.join(root, "data.db"));

if (!provider || !engine || !baseUrl) throw new Error("--provider, --engine and --base-url are required");
if (approve && !reviewedBy) throw new Error("--approve requires --reviewed-by");
const parsed = new URL(baseUrl);
if (!/^https?:$/.test(parsed.protocol)) throw new Error("SERP source must use HTTP(S)");
if (parsed.username || parsed.password) throw new Error("Credentials are forbidden in SERP source URLs");
const safeBaseUrl = `${parsed.protocol}//${parsed.host}`;

if (!apply) {
  console.log(JSON.stringify({
    mode: "dry-run", action: approve ? "register-and-approve" : "register",
    provider, engine: engine.toLocaleUpperCase("en-US"), baseUrl: safeBaseUrl,
    discoverySource, acquisitionMethod, termsStatus, robotsStatus,
    next: "terms/robots/access review before SERP import",
  }, null, 2));
  process.exit(0);
}

const db = new Database(dbPath, { fileMustExist: true });
db.pragma("foreign_keys = ON");
try {
  const schemaReady = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'serp_source_candidates'").get();
  if (!schemaReady) throw new Error("SERP intelligence schema is not applied");
  const candidate = registerSerpSourceCandidate(db, {
    provider, engine, baseUrl: safeBaseUrl, discoverySource, acquisitionMethod,
    termsStatus, robotsStatus, notes,
  });
  if (approve) {
    approveSerpSourceCandidate(db, {
      id: candidate.id, acquisitionMethod, robotsStatus, reviewedBy,
    });
  }
  const saved = db.prepare("SELECT * FROM serp_source_candidates WHERE id = ?").get(candidate.id);
  console.log(JSON.stringify({
    id: saved.id, provider: saved.provider, engine: saved.engine, baseUrl: saved.base_url,
    acquisitionMethod: saved.acquisition_method, status: saved.status,
    termsStatus: saved.terms_status, robotsStatus: saved.robots_status, reviewedBy: saved.reviewed_by,
  }, null, 2));
} finally {
  db.close();
}
