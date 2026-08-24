import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateContentOpportunity, persistContentOpportunity } from "../src/lib/opportunity-engine.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const value = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const apply = process.argv.includes("--apply");
const intentId = value("intent-id");
const dbPath = path.resolve(process.env.SQLITE_PATH || path.join(root, "data.db"));
const painPoints = (value("pain-points") || "").split(",").map((item) => item.trim()).filter(Boolean).map((item) => {
  const [id, relevance] = item.split(":");
  return { id, relevance: relevance === undefined ? 100 : Number(relevance) };
});
if (!intentId) throw new Error("--intent-id is required");

const db = new Database(dbPath, { fileMustExist: true });
db.pragma("foreign_keys = ON");
try {
  const ready = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'content_opportunities'").get();
  if (!ready) throw new Error("Content opportunity schema is not applied");
  if (!apply) {
    const proposal = evaluateContentOpportunity(db, { intentId, painPoints });
    console.log(JSON.stringify({
      mode: "dry-run", topic: proposal.topic, categorySlug: proposal.categorySlug,
      decision: proposal.decision, recommendedPageType: proposal.recommendedPageType,
      opportunityScore: proposal.opportunityScore, decisionReasonCode: proposal.decisionReasonCode,
      factors: proposal.scoreBreakdown.factors, penalties: proposal.scoreBreakdown.penalties,
      existingUrlCount: proposal.existingUrlCount, hasRecommendedUrl: Boolean(proposal.recommendedUrlId),
      hasMergeTarget: Boolean(proposal.mergeIntoOpportunityId),
    }, null, 2));
  } else {
    const result = persistContentOpportunity(db, { intentId, painPoints });
    console.log(JSON.stringify({
      id: result.opportunity.id, decision: result.opportunity.decision,
      recommendedPageType: result.opportunity.recommended_page_type,
      opportunityScore: result.opportunity.opportunity_score,
      status: result.opportunity.status, duplicate: result.duplicate,
    }, null, 2));
  }
} finally {
  db.close();
}
