import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { approveReviewSourceCandidate, registerReviewSourceCandidate } from "../src/lib/review-intelligence.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const value = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const apply = process.argv.includes("--apply");
const approve = process.argv.includes("--approve");
const platform = value("platform");
const baseUrl = value("base-url");
const discoverySource = value("discovery-source") || "manual-research";
const accessMethod = value("access-method") || "NONE";
const termsStatus = value("terms-status") || "REVIEW_REQUIRED";
const robotsStatus = value("robots-status") || "UNKNOWN";
const notes = value("notes") || undefined;
const reviewedBy = value("reviewed-by");
const dbPath = path.resolve(process.env.SQLITE_PATH || path.join(root, "data.db"));

if (!platform || !baseUrl) throw new Error("--platform and --base-url are required");
if (approve && !reviewedBy) throw new Error("--approve requires --reviewed-by");
const parsed = new URL(baseUrl);
if (!/^https?:$/.test(parsed.protocol)) throw new Error("Review source must use HTTP(S)");
if (parsed.username || parsed.password) throw new Error("Credentials are forbidden in source URLs");
const safeBaseUrl = `${parsed.protocol}//${parsed.host}`;

if (!apply) {
  console.log(JSON.stringify({
    mode: "dry-run", action: approve ? "register-and-approve" : "register", platform, baseUrl: safeBaseUrl, discoverySource,
    accessMethod, termsStatus, robotsStatus, next: "legal/robots review before approval or import",
  }, null, 2));
  process.exit(0);
}

const db = new Database(dbPath, { fileMustExist: true });
db.pragma("foreign_keys = ON");
try {
  const schemaReady = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'review_source_candidates'").get();
  if (!schemaReady) throw new Error("Review intelligence schema is not applied");
  const candidate = registerReviewSourceCandidate(db, {
    platform, baseUrl: safeBaseUrl, discoverySource, accessMethod, termsStatus, robotsStatus, notes,
  });
  if (approve) {
    approveReviewSourceCandidate(db, {
      id: candidate.id, accessMethod, robotsStatus, reviewedBy,
    });
  }
  const saved = db.prepare("SELECT * FROM review_source_candidates WHERE id = ?").get(candidate.id);
  console.log(JSON.stringify({
    id: saved.id, platform: saved.platform, baseUrl: saved.base_url,
    status: saved.status, termsStatus: saved.terms_status, robotsStatus: saved.robots_status,
    reviewedBy: saved.reviewed_by,
  }, null, 2));
} finally {
  db.close();
}
