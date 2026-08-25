import { createHash } from "node:crypto";
import { isAssetPublicationRightsEligible } from "./image-intelligence.mjs";

export const SCALE_MODEL_VERSION = "phase20-scale-governance-v1";
export const SCALE_CHECKPOINTS = Object.freeze([25, 50, 100, 250]);
export const QUALITY_SCORE_MINIMUM = 85;
export const EVIDENCE_SCORE_MINIMUM = 80;
export const DIFFERENTIATION_SCORE_MINIMUM = 60;

export const QUALITY_WEIGHTS = Object.freeze({
  intentMatch: 15,
  technicalAccuracy: 20,
  originalValue: 15,
  practicalValue: 15,
  evidence: 10,
  visualValue: 5,
  seo: 5,
  internalLinking: 5,
  conversionValue: 5,
  readability: 5,
});

export const EVIDENCE_POINTS = Object.freeze({
  supplierVerifiedSpecs: 20,
  manufacturerSource: 15,
  technicalManual: 15,
  verifiedCompatibility: 15,
  licensedProductImage: 10,
  realCustomerPainData: 10,
  calculations: 5,
  expertValidation: 10,
});

export const CONTENT_HARD_FAIL_CODES = Object.freeze([
  "INVENTED_TECHNICAL_DATA",
  "DUPLICATE_INTENT",
  "SEVERE_CANNIBALIZATION",
  "COPYRIGHT_PROBLEM",
  "BROKEN_CANONICAL",
  "MISLEADING_CLAIM",
  "DUPLICATED_ARTICLE",
  "NO_UNIQUE_USER_VALUE",
]);

const HARD_FAIL_SET = new Set(CONTENT_HARD_FAIL_CODES);
const COMPONENT_KEYS = Object.freeze(Object.keys(QUALITY_WEIGHTS));

function hash(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function parseJson(value, fallback) {
  try { return JSON.parse(value); } catch { return fallback; }
}

function cleanText(value, name, maximum = 2000, minimum = 1) {
  const text = String(value ?? "").normalize("NFKC").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (text.length < minimum || text.length > maximum) {
    throw new Error(`${name} must contain ${minimum}-${maximum} characters`);
  }
  return text;
}

function actor(value, name) {
  return cleanText(value, name, 200, 2);
}

function integer(value, name, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < minimum || number > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}`);
  }
  return number;
}

function score(value, name) {
  return integer(value, name, 0, 100);
}

function timestamp(value, name) {
  return integer(value, name, 1, Number.MAX_SAFE_INTEGER);
}

function tableExists(db, name) {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = ?").get(name));
}

function requireTables(db, names) {
  const missing = names.filter((name) => !tableExists(db, name));
  if (missing.length) throw new Error(`Required Phase 20 schema is missing: ${missing.join(", ")}`);
}

function normalizeComponents(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("components object is required");
  const unknown = Object.keys(raw).filter((key) => !COMPONENT_KEYS.includes(key));
  const missing = COMPONENT_KEYS.filter((key) => raw[key] == null);
  if (unknown.length || missing.length) {
    throw new Error(`Quality components must contain exactly: ${COMPONENT_KEYS.join(", ")}`);
  }
  return Object.fromEntries(COMPONENT_KEYS.map((key) => [key, score(raw[key], key)]));
}

export function calculateContentQualityScore(rawComponents) {
  const components = normalizeComponents(rawComponents);
  const weighted = COMPONENT_KEYS.reduce((sum, key) => sum + components[key] * QUALITY_WEIGHTS[key], 0);
  return { components, qualityScore: Math.round(weighted / 100), weights: QUALITY_WEIGHTS };
}

function articleContext(db, contentId) {
  const article = db.prepare(`
    SELECT asset.*, opportunity.status AS opportunity_status,
      opportunity.decision AS opportunity_decision,
      opportunity.opportunity_score,
      opportunity.evaluation_checksum AS current_opportunity_checksum,
      opportunity.cannibalization_risk,
      opportunity.duplicate_risk
    FROM content_assets asset
    LEFT JOIN content_opportunities opportunity ON opportunity.id = asset.opportunity_id
    WHERE asset.id = ?
  `).get(contentId);
  if (!article) throw new Error(`Unknown content asset: ${contentId}`);
  if (!article.current_revision_id) throw new Error("Content asset has no current revision");
  return article;
}

function verifiedSourceTypes(db, article) {
  if (!tableExists(db, "content_sources") || !tableExists(db, "sources")) return new Map();
  const rows = db.prepare(`
    SELECT source.source_type, COUNT(DISTINCT content_source.id) AS count
    FROM content_sources content_source
    JOIN sources source ON source.id = content_source.source_id
    WHERE content_source.content_asset_id = ?
      AND content_source.evidence_status = 'VERIFIED'
      AND source.active = 1 AND source.rights_policy = 'PUBLISHABLE_FACTS'
    GROUP BY source.source_type
  `).all(article.id);
  return new Map(rows.map((row) => [row.source_type, row.count]));
}

function verifiedCompatibilityCount(db, article) {
  let count = 0;
  if (tableExists(db, "content_sources") && tableExists(db, "fact_assertions")) {
    count += db.prepare(`
      SELECT COUNT(DISTINCT source.id) AS count
      FROM content_sources source
      JOIN fact_assertions assertion ON assertion.id = source.assertion_id
      WHERE source.content_asset_id = ? AND source.evidence_status = 'VERIFIED'
        AND assertion.verification_status = 'VERIFIED'
        AND lower(assertion.predicate) LIKE '%compat%'
    `).get(article.id).count;
  }
  if (tableExists(db, "content_products") && tableExists(db, "product_compatibility")) {
    count += db.prepare(`
      SELECT COUNT(DISTINCT compatibility.id) AS count
      FROM content_products product
      JOIN product_compatibility compatibility
        ON compatibility.product_a_id = product.product_id
        OR compatibility.product_b_id = product.product_id
      WHERE product.content_asset_id = ? AND compatibility.verified = 1
    `).get(article.id).count;
  }
  return count;
}

function rightsApprovedImages(db, article, now) {
  if (!["content_media", "media_assets", "media_rights_grants"].every((name) => tableExists(db, name))) return [];
  const rows = db.prepare(`
    SELECT placement.id AS placement_id, placement.status AS placement_status,
      asset.*, grant.id AS grant_id, grant.scope_type, grant.scope_value,
      grant.source_id AS grant_source_id, grant.status AS grant_status,
      grant.permitted_uses_json, grant.valid_from, grant.valid_until
    FROM content_media placement
    JOIN media_assets asset ON asset.id = placement.media_asset_id
    LEFT JOIN media_rights_grants grant ON grant.id = asset.rights_grant_id
    WHERE placement.content_asset_id = ? AND placement.status IN ('APPROVED', 'PUBLISHED')
  `).all(article.id);
  return rows.filter((row) => row.asset_kind === "PRODUCT_PHOTO" || row.asset_kind === "PRODUCT_CLOSEUP" || row.asset_kind === "PRODUCT_COMPONENT")
    .filter((row) => isAssetPublicationRightsEligible({
      id: row.id,
      source_id: row.source_id,
      rights_grant_id: row.rights_grant_id,
    }, {
      id: row.grant_id,
      status: row.grant_status,
      scope_type: row.scope_type,
      scope_value: row.scope_value,
      source_id: row.grant_source_id,
      permitted_uses_json: row.permitted_uses_json,
      valid_from: row.valid_from,
      valid_until: row.valid_until,
    }, now));
}

function customerPainCount(db, article) {
  if (!["opportunity_pain_points", "pain_points"].every((name) => tableExists(db, name))) return 0;
  return db.prepare(`
    SELECT COUNT(DISTINCT pain.id) AS count
    FROM opportunity_pain_points relation
    JOIN pain_points pain ON pain.id = relation.pain_point_id
    WHERE relation.opportunity_id = ?
      AND pain.status IN ('REVIEWED', 'CONTENT_EXISTS')
      AND pain.mentions > 0 AND pain.sources_count > 0
  `).get(article.opportunity_id).count;
}

function calculationEvidence(db, article) {
  const revision = db.prepare("SELECT content_body FROM content_revisions WHERE id = ?").get(article.current_revision_id);
  const content = parseJson(revision?.content_body, {});
  const sourcedTables = (content.sections ?? []).flatMap((section) => section.blocks ?? [])
    .filter((block) => block.type === "table" && Array.isArray(block.sourceRefs) && block.sourceRefs.length > 0).length;
  const factApproval = tableExists(db, "content_approvals") && Boolean(db.prepare(`
    SELECT 1 FROM content_approvals
    WHERE content_asset_id = ? AND revision_id = ? AND approval_type = 'FACT' AND decision = 'APPROVED'
  `).get(article.id, article.current_revision_id));
  return { sourcedTables, factApproval };
}

function expertValidationCount(db, article) {
  if (!tableExists(db, "content_approvals")) return 0;
  return db.prepare(`
    SELECT COUNT(*) AS count FROM content_approvals
    WHERE content_asset_id = ? AND revision_id = ?
      AND approval_type = 'EXPERT' AND decision = 'APPROVED'
  `).get(article.id, article.current_revision_id).count;
}

function evidenceAssessment(db, article, now) {
  const sourceTypes = verifiedSourceTypes(db, article);
  const compatibility = verifiedCompatibilityCount(db, article);
  const images = rightsApprovedImages(db, article, now);
  const pains = customerPainCount(db, article);
  const calculation = calculationEvidence(db, article);
  const expert = expertValidationCount(db, article);
  const states = {
    supplierVerifiedSpecs: { available: (sourceTypes.get("SUPPLIER_FEED") ?? 0) > 0, count: sourceTypes.get("SUPPLIER_FEED") ?? 0 },
    manufacturerSource: { available: (sourceTypes.get("MANUFACTURER") ?? 0) > 0, count: sourceTypes.get("MANUFACTURER") ?? 0 },
    technicalManual: { available: (sourceTypes.get("MANUAL") ?? 0) > 0, count: sourceTypes.get("MANUAL") ?? 0 },
    verifiedCompatibility: { available: compatibility > 0, count: compatibility },
    licensedProductImage: { available: images.length > 0, placementIds: images.map((row) => row.placement_id).sort() },
    realCustomerPainData: { available: pains > 0, count: pains },
    calculations: { available: calculation.sourcedTables > 0 && calculation.factApproval, ...calculation },
    expertValidation: { available: expert > 0, count: expert },
  };
  const breakdown = Object.fromEntries(Object.entries(states).map(([key, state]) => [key, {
    ...state,
    possiblePoints: EVIDENCE_POINTS[key],
    awardedPoints: state.available ? EVIDENCE_POINTS[key] : 0,
  }]));
  const evidenceScore = Object.values(breakdown).reduce((sum, item) => sum + item.awardedPoints, 0);
  return { evidenceScore, breakdown };
}

function manualHardFails(raw) {
  if (raw == null) return [];
  if (!Array.isArray(raw)) throw new Error("manualHardFails must be an array");
  const normalized = raw.map((entry, index) => {
    const item = typeof entry === "string" ? { code: entry, evidence: "Human reviewer reported this hard fail" } : entry;
    const code = String(item?.code ?? "").trim().toLocaleUpperCase("en");
    if (!HARD_FAIL_SET.has(code)) throw new Error(`manualHardFails[${index}] uses an unknown code`);
    return { code, evidence: cleanText(item.evidence, `manualHardFails[${index}].evidence`, 1000, 10) };
  });
  if (new Set(normalized.map((entry) => entry.code)).size !== normalized.length) throw new Error("manualHardFails codes must be unique");
  return normalized.sort((left, right) => left.code.localeCompare(right.code, "en"));
}

function hardFailAssessment(db, article, differentiation, manual, now) {
  const evidence = Object.fromEntries(CONTENT_HARD_FAIL_CODES.map((code) => [code, []]));
  const add = (code, detail) => evidence[code].push(String(detail));
  const quality = db.prepare("SELECT issues_json, hard_fail FROM content_quality_checks WHERE revision_id = ?").get(article.current_revision_id);
  const issues = parseJson(quality?.issues_json, []);
  const issueCodes = new Set(issues.filter((item) => item.severity === "HARD").map((item) => item.code));
  for (const code of ["INVENTED_SPECIFICATION", "INVENTED_TEST_RESULT"]) {
    if (issueCodes.has(code)) add("INVENTED_TECHNICAL_DATA", `content_quality_checks:${code}`);
  }
  for (const code of ["INVENTED_EXPERTISE", "INVENTED_TEST_RESULT"]) {
    if (issueCodes.has(code)) add("MISLEADING_CLAIM", `content_quality_checks:${code}`);
  }
  if (issueCodes.has("DUPLICATE_TEMPLATE")) add("DUPLICATED_ARTICLE", "content_quality_checks:DUPLICATE_TEMPLATE");
  if (article.duplicate_risk === "HIGH") add("DUPLICATE_INTENT", "content_opportunities.duplicate_risk=HIGH");
  if (article.cannibalization_risk === "HIGH") add("SEVERE_CANNIBALIZATION", "content_opportunities.cannibalization_risk=HIGH");

  const canonicalExpected = `/articles/${article.slug}`;
  if (article.canonical !== canonicalExpected) add("BROKEN_CANONICAL", `expected ${canonicalExpected}, found ${article.canonical}`);
  if (tableExists(db, "site_urls")) {
    const route = db.prepare("SELECT entity_type, entity_id FROM site_urls WHERE path = ?").get(article.canonical);
    if (route && (route.entity_type !== "CONTENT_ASSET" || route.entity_id !== article.id)) {
      add("BROKEN_CANONICAL", "canonical route is owned by another entity");
    }
  }

  const currentRevision = db.prepare("SELECT content_hash FROM content_revisions WHERE id = ?").get(article.current_revision_id);
  const duplicate = db.prepare(`
    SELECT asset.id FROM content_revisions revision
    JOIN content_assets asset ON asset.current_revision_id = revision.id
    WHERE revision.content_hash = ? AND asset.id != ? AND asset.status != 'ARCHIVED'
    LIMIT 1
  `).get(currentRevision.content_hash, article.id);
  if (duplicate) add("DUPLICATED_ARTICLE", `same content hash as ${duplicate.id}`);

  if (["content_media", "media_assets", "media_rights_grants"].every((name) => tableExists(db, name))) {
    const placements = db.prepare(`
      SELECT placement.id AS placement_id, asset.*,
        grant.id AS grant_id, grant.scope_type, grant.scope_value,
        grant.source_id AS grant_source_id, grant.status AS grant_status,
        grant.permitted_uses_json, grant.valid_from, grant.valid_until
      FROM content_media placement
      JOIN media_assets asset ON asset.id = placement.media_asset_id
      LEFT JOIN media_rights_grants grant ON grant.id = asset.rights_grant_id
      WHERE placement.content_asset_id = ? AND placement.status IN ('APPROVED', 'PUBLISHED')
    `).all(article.id);
    for (const row of placements) {
      const allowed = isAssetPublicationRightsEligible({ id: row.id, source_id: row.source_id, rights_grant_id: row.rights_grant_id }, {
        id: row.grant_id, status: row.grant_status, scope_type: row.scope_type,
        scope_value: row.scope_value, source_id: row.grant_source_id,
        permitted_uses_json: row.permitted_uses_json, valid_from: row.valid_from, valid_until: row.valid_until,
      }, now);
      if (!allowed) add("COPYRIGHT_PROBLEM", `content_media:${row.placement_id}`);
    }
  }
  if (differentiation.score < DIFFERENTIATION_SCORE_MINIMUM) {
    add("NO_UNIQUE_USER_VALUE", `differentiation score ${differentiation.score} is below ${DIFFERENTIATION_SCORE_MINIMUM}`);
  }
  for (const finding of manual) add(finding.code, `manual:${finding.evidence}`);
  const hardFailCodes = CONTENT_HARD_FAIL_CODES.filter((code) => evidence[code].length > 0);
  return { hardFail: hardFailCodes.length > 0, hardFailCodes, evidence };
}

function differentiationInput(raw) {
  if (!raw || typeof raw !== "object") throw new Error("differentiation object is required");
  const result = {
    score: score(raw.score, "differentiation.score"),
    rationale: cleanText(raw.rationale, "differentiation.rationale", 2000, 40),
    proof: Array.isArray(raw.proof) ? raw.proof.map((item, index) => cleanText(item, `differentiation.proof[${index}]`, 1000, 10)) : [],
  };
  if (!result.proof.length || result.proof.length > 20) throw new Error("differentiation.proof must contain 1-20 concrete proof points");
  return result;
}

function buildAssessment(db, article, input, now) {
  const quality = calculateContentQualityScore(input.components);
  const differentiation = differentiationInput(input.differentiation);
  const manual = manualHardFails(input.manualHardFails);
  const evidence = evidenceAssessment(db, article, now);
  const hardFails = hardFailAssessment(db, article, differentiation, manual, now);
  const snapshot = {
    contentId: article.id,
    revisionId: article.current_revision_id,
    opportunityChecksum: article.current_opportunity_checksum,
    sourceOpportunityChecksum: article.source_opportunity_checksum,
    components: quality.components,
    weights: quality.weights,
    qualityScore: quality.qualityScore,
    evidence,
    differentiation,
    manualHardFails: manual,
    hardFails,
    modelVersion: SCALE_MODEL_VERSION,
  };
  return { ...snapshot, evidenceChecksum: hash(canonical(snapshot)) };
}

export function assessContentQuality(db, rawInput) {
  requireTables(db, ["content_assets", "content_revisions", "content_opportunities", "content_quality_scorecards"]);
  const article = articleContext(db, cleanText(rawInput.contentId, "contentId", 200));
  if (article.status !== "READY") throw new Error("Only READY content can receive a Phase 20 scorecard");
  const assessedBy = actor(rawInput.assessedBy, "assessedBy");
  const assessedAt = rawInput.assessedAt == null ? Date.now() : timestamp(rawInput.assessedAt, "assessedAt");
  const assessment = buildAssessment(db, article, rawInput, assessedAt);
  const existing = db.prepare("SELECT * FROM content_quality_scorecards WHERE evidence_checksum = ?").get(assessment.evidenceChecksum);
  if (existing) return { scorecard: existing, assessment, duplicate: true };
  const id = `scorecard-${assessment.evidenceChecksum.slice(0, 26)}`;
  db.prepare(`
    INSERT INTO content_quality_scorecards (
      id, content_id, revision_id, intent_match, technical_accuracy, original_value,
      practical_value, evidence_component, visual_value, seo, internal_linking,
      conversion_value, readability, quality_score, weights_json, evidence_score,
      evidence_breakdown_json, differentiation_score, differentiation_rationale,
      differentiation_proof_json, manual_hard_fail_json, hard_fail,
      hard_fail_codes_json, hard_fail_evidence_json, model_version,
      evidence_checksum, status, assessed_by, assessed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'REVIEW_REQUIRED', ?, ?)
  `).run(
    id, article.id, article.current_revision_id,
    assessment.components.intentMatch, assessment.components.technicalAccuracy,
    assessment.components.originalValue, assessment.components.practicalValue,
    assessment.components.evidence, assessment.components.visualValue,
    assessment.components.seo, assessment.components.internalLinking,
    assessment.components.conversionValue, assessment.components.readability,
    assessment.qualityScore, canonical(assessment.weights), assessment.evidence.evidenceScore,
    canonical(assessment.evidence.breakdown), assessment.differentiation.score,
    assessment.differentiation.rationale, canonical(assessment.differentiation.proof),
    canonical(assessment.manualHardFails), assessment.hardFails.hardFail ? 1 : 0,
    canonical(assessment.hardFails.hardFailCodes), canonical(assessment.hardFails.evidence),
    SCALE_MODEL_VERSION, assessment.evidenceChecksum, assessedBy, assessedAt,
  );
  return { scorecard: db.prepare("SELECT * FROM content_quality_scorecards WHERE id = ?").get(id), assessment, duplicate: false };
}

function assessmentFromScorecard(db, scorecard, now) {
  const article = articleContext(db, scorecard.content_id);
  if (article.current_revision_id !== scorecard.revision_id) throw new Error("Content scorecard is stale because the current revision changed");
  const components = {
    intentMatch: scorecard.intent_match,
    technicalAccuracy: scorecard.technical_accuracy,
    originalValue: scorecard.original_value,
    practicalValue: scorecard.practical_value,
    evidence: scorecard.evidence_component,
    visualValue: scorecard.visual_value,
    seo: scorecard.seo,
    internalLinking: scorecard.internal_linking,
    conversionValue: scorecard.conversion_value,
    readability: scorecard.readability,
  };
  const assessment = buildAssessment(db, article, {
    components,
    differentiation: {
      score: scorecard.differentiation_score,
      rationale: scorecard.differentiation_rationale,
      proof: parseJson(scorecard.differentiation_proof_json, []),
    },
    manualHardFails: parseJson(scorecard.manual_hard_fail_json, []),
  }, now);
  if (assessment.evidenceChecksum !== scorecard.evidence_checksum) {
    throw new Error("Content scorecard evidence changed; create and review a new scorecard");
  }
  return { article, assessment };
}

export function reviewContentScorecard(db, rawInput) {
  requireTables(db, ["content_quality_scorecards", "content_assets"]);
  const scorecardId = cleanText(rawInput.scorecardId, "scorecardId", 200);
  const decision = cleanText(rawInput.decision, "decision", 20).toLocaleUpperCase("en");
  if (!new Set(["APPROVE", "REJECT"]).has(decision)) throw new Error("decision must be APPROVE or REJECT");
  const reviewedBy = actor(rawInput.reviewedBy, "reviewedBy");
  const reviewedAt = rawInput.reviewedAt == null ? Date.now() : timestamp(rawInput.reviewedAt, "reviewedAt");
  const scorecard = db.prepare("SELECT * FROM content_quality_scorecards WHERE id = ?").get(scorecardId);
  if (!scorecard) throw new Error(`Unknown content scorecard: ${scorecardId}`);
  if (scorecard.status !== "REVIEW_REQUIRED") {
    const expected = decision === "APPROVE" ? "APPROVED" : "REJECTED";
    if (scorecard.status === expected) return { ...scorecard, duplicate: true };
    throw new Error("Content scorecard already has a conflicting review state");
  }
  const { article, assessment } = assessmentFromScorecard(db, scorecard, reviewedAt);
  if (article.status !== "READY") throw new Error("Scorecard review requires current READY content");
  if (decision === "APPROVE") {
    if (assessment.qualityScore < QUALITY_SCORE_MINIMUM) throw new Error(`QualityScore must be at least ${QUALITY_SCORE_MINIMUM}`);
    if (assessment.evidence.evidenceScore < EVIDENCE_SCORE_MINIMUM) throw new Error(`EvidenceScore must be at least ${EVIDENCE_SCORE_MINIMUM}`);
    if (assessment.differentiation.score < DIFFERENTIATION_SCORE_MINIMUM) throw new Error(`DifferentiationScore must be at least ${DIFFERENTIATION_SCORE_MINIMUM}`);
    if (assessment.hardFails.hardFail) throw new Error(`Hard fail blocks approval: ${assessment.hardFails.hardFailCodes.join(", ")}`);
  }
  return db.transaction(() => {
    if (decision === "APPROVE") {
      db.prepare(`
        UPDATE content_quality_scorecards
        SET status = 'SUPERSEDED', reviewed_by = COALESCE(reviewed_by, ?),
          reviewed_at = COALESCE(reviewed_at, ?)
        WHERE content_id = ? AND revision_id = ? AND status = 'APPROVED' AND id != ?
      `).run(reviewedBy, reviewedAt, scorecard.content_id, scorecard.revision_id, scorecard.id);
    }
    const status = decision === "APPROVE" ? "APPROVED" : "REJECTED";
    db.prepare(`UPDATE content_quality_scorecards SET status = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?`)
      .run(status, reviewedBy, reviewedAt, scorecard.id);
    if (status === "APPROVED") {
      db.prepare(`
        UPDATE content_assets SET quality_score = ?, evidence_score = ?, differentiation_score = ?, updated_at = ?
        WHERE id = ? AND current_revision_id = ? AND status = 'READY'
      `).run(assessment.qualityScore, assessment.evidence.evidenceScore, assessment.differentiation.score, reviewedAt, article.id, article.current_revision_id);
    }
    return { ...db.prepare("SELECT * FROM content_quality_scorecards WHERE id = ?").get(scorecard.id), duplicate: false };
  })();
}

export function validateApprovedScorecard(db, contentId, now = Date.now()) {
  requireTables(db, ["content_quality_scorecards"]);
  const article = articleContext(db, contentId);
  const scorecard = db.prepare(`
    SELECT * FROM content_quality_scorecards
    WHERE content_id = ? AND revision_id = ? AND status = 'APPROVED'
    ORDER BY reviewed_at DESC, id DESC LIMIT 1
  `).get(article.id, article.current_revision_id);
  if (!scorecard) throw new Error("Content has no approved Phase 20 scorecard for the current revision");
  const current = assessmentFromScorecard(db, scorecard, now);
  if (scorecard.quality_score < QUALITY_SCORE_MINIMUM || scorecard.evidence_score < EVIDENCE_SCORE_MINIMUM
    || scorecard.differentiation_score < DIFFERENTIATION_SCORE_MINIMUM || scorecard.hard_fail !== 0) {
    throw new Error("Approved scorecard no longer satisfies Phase 20 publication gates");
  }
  return { article, scorecard, assessment: current.assessment };
}

function pilotAndKpi(db, pilotId, kpiSnapshotId) {
  const pilot = db.prepare("SELECT * FROM pilot_programs WHERE id = ?").get(pilotId);
  if (!pilot || pilot.status !== "APPROVED") throw new Error("Scale requires an approved Phase 19 pilot");
  const kpi = db.prepare(`
    SELECT * FROM pilot_kpi_snapshots
    WHERE id = ? AND pilot_id = ? AND scope_type = 'PILOT' AND category_slug IS NULL
  `).get(kpiSnapshotId, pilotId);
  if (!kpi) throw new Error("Scale requires a whole-pilot KPI snapshot from the same pilot");
  return { pilot, kpi };
}

export function createScaleProgram(db, rawInput) {
  requireTables(db, ["content_scale_programs", "content_scale_checkpoint_reviews", "pilot_programs", "pilot_kpi_snapshots"]);
  const pilotId = cleanText(rawInput.pilotId, "pilotId", 100);
  const kpiSnapshotId = cleanText(rawInput.kpiSnapshotId, "kpiSnapshotId", 200);
  pilotAndKpi(db, pilotId, kpiSnapshotId);
  const rationale = cleanText(rawInput.successRationale, "successRationale", 2000, 40);
  const createdBy = actor(rawInput.createdBy, "createdBy");
  const createdAt = rawInput.createdAt == null ? Date.now() : timestamp(rawInput.createdAt, "createdAt");
  const identity = hash(canonical({ pilotId, kpiSnapshotId, rationale, modelVersion: SCALE_MODEL_VERSION }));
  const id = `scale-${identity.slice(0, 28)}`;
  const existing = db.prepare("SELECT * FROM content_scale_programs WHERE pilot_id = ?").get(pilotId);
  if (existing) {
    if (existing.id !== id) throw new Error("Pilot already has a scale program with different immutable evidence");
    return { program: existing, duplicate: true };
  }
  return db.transaction(() => {
    db.prepare(`
      INSERT INTO content_scale_programs (
        id, pilot_id, pilot_kpi_snapshot_id, model_version, current_checkpoint,
        pilot_success_rationale, status, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 25, ?, 'REVIEW_REQUIRED', ?, ?, ?)
    `).run(id, pilotId, kpiSnapshotId, SCALE_MODEL_VERSION, rationale, createdBy, createdAt, createdAt);
    const reviewId = `scale-review-${hash(`${id}:25:${kpiSnapshotId}`).slice(0, 24)}`;
    db.prepare(`
      INSERT INTO content_scale_checkpoint_reviews (
        id, scale_program_id, checkpoint_size, observed_published_count,
        kpi_snapshot_id, success_rationale, status, created_by, created_at, updated_at
      ) VALUES (?, ?, 25, 25, ?, ?, 'REVIEW_REQUIRED', ?, ?, ?)
    `).run(reviewId, id, kpiSnapshotId, rationale, createdBy, createdAt, createdAt);
    return { program: db.prepare("SELECT * FROM content_scale_programs WHERE id = ?").get(id), checkpointReviewId: reviewId, duplicate: false };
  })();
}

function publishedScaleCount(db, scaleProgramId) {
  return 25 + db.prepare(`
    SELECT COUNT(*) AS count FROM content_publish_queue
    WHERE scale_program_id = ? AND status = 'PUBLISHED'
  `).get(scaleProgramId).count;
}

function nextCheckpoint(current) {
  return SCALE_CHECKPOINTS.find((checkpoint) => checkpoint > current) ?? null;
}

export function reviewScaleCheckpoint(db, rawInput) {
  requireTables(db, ["content_scale_programs", "content_scale_checkpoint_reviews", "content_publish_queue"]);
  const reviewId = cleanText(rawInput.reviewId, "reviewId", 200);
  const decision = cleanText(rawInput.decision, "decision", 20).toLocaleUpperCase("en");
  if (!new Set(["APPROVE", "REJECT"]).has(decision)) throw new Error("decision must be APPROVE or REJECT");
  const reviewedBy = actor(rawInput.reviewedBy, "reviewedBy");
  const reviewedAt = rawInput.reviewedAt == null ? Date.now() : timestamp(rawInput.reviewedAt, "reviewedAt");
  const review = db.prepare("SELECT * FROM content_scale_checkpoint_reviews WHERE id = ?").get(reviewId);
  if (!review) throw new Error(`Unknown scale checkpoint review: ${reviewId}`);
  const program = db.prepare("SELECT * FROM content_scale_programs WHERE id = ?").get(review.scale_program_id);
  if (review.status !== "REVIEW_REQUIRED") {
    const expected = decision === "APPROVE" ? "APPROVED" : "REJECTED";
    if (review.status === expected) return { program, review, duplicate: true };
    throw new Error("Scale checkpoint already has a conflicting review state");
  }
  pilotAndKpi(db, program.pilot_id, review.kpi_snapshot_id);
  const observed = publishedScaleCount(db, program.id);
  if (review.checkpoint_size > 25 && observed < review.checkpoint_size) {
    throw new Error(`Checkpoint ${review.checkpoint_size} requires ${review.checkpoint_size} published items; observed ${observed}`);
  }
  return db.transaction(() => {
    const reviewStatus = decision === "APPROVE" ? "APPROVED" : "REJECTED";
    db.prepare(`
      UPDATE content_scale_checkpoint_reviews
      SET status = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?
    `).run(reviewStatus, reviewedBy, reviewedAt, reviewedAt, review.id);
    const programStatus = decision === "REJECT"
      ? "PAUSED"
      : review.checkpoint_size === 250 ? "SCORE_DRIVEN" : "ACTIVE";
    db.prepare(`
      UPDATE content_scale_programs
      SET current_checkpoint = ?, status = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ?
      WHERE id = ?
    `).run(review.checkpoint_size, programStatus, reviewedBy, reviewedAt, reviewedAt, program.id);
    return {
      program: db.prepare("SELECT * FROM content_scale_programs WHERE id = ?").get(program.id),
      review: db.prepare("SELECT * FROM content_scale_checkpoint_reviews WHERE id = ?").get(review.id),
      duplicate: false,
    };
  })();
}

export function requestNextScaleCheckpoint(db, rawInput) {
  requireTables(db, ["content_scale_programs", "content_scale_checkpoint_reviews", "pilot_kpi_snapshots", "content_publish_queue"]);
  const programId = cleanText(rawInput.scaleProgramId, "scaleProgramId", 200);
  const program = db.prepare("SELECT * FROM content_scale_programs WHERE id = ?").get(programId);
  if (!program || program.status !== "ACTIVE") throw new Error("Only an ACTIVE scale program can request the next checkpoint");
  const checkpoint = nextCheckpoint(program.current_checkpoint);
  if (!checkpoint) throw new Error("Checkpoint 250 already transitions to score-driven scaling");
  const observed = publishedScaleCount(db, program.id);
  if (observed < checkpoint) throw new Error(`Next checkpoint ${checkpoint} requires ${checkpoint} published items; observed ${observed}`);
  const kpiSnapshotId = cleanText(rawInput.kpiSnapshotId, "kpiSnapshotId", 200);
  pilotAndKpi(db, program.pilot_id, kpiSnapshotId);
  const rationale = cleanText(rawInput.successRationale, "successRationale", 2000, 40);
  const createdBy = actor(rawInput.createdBy, "createdBy");
  const createdAt = rawInput.createdAt == null ? Date.now() : timestamp(rawInput.createdAt, "createdAt");
  const id = `scale-review-${hash(`${program.id}:${checkpoint}:${kpiSnapshotId}`).slice(0, 24)}`;
  const existing = db.prepare("SELECT * FROM content_scale_checkpoint_reviews WHERE scale_program_id = ? AND checkpoint_size = ?")
    .get(program.id, checkpoint);
  if (existing) return { review: existing, duplicate: true };
  db.prepare(`
    INSERT INTO content_scale_checkpoint_reviews (
      id, scale_program_id, checkpoint_size, observed_published_count,
      kpi_snapshot_id, success_rationale, status, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'REVIEW_REQUIRED', ?, ?, ?)
  `).run(id, program.id, checkpoint, observed, kpiSnapshotId, rationale, createdBy, createdAt, createdAt);
  return { review: db.prepare("SELECT * FROM content_scale_checkpoint_reviews WHERE id = ?").get(id), duplicate: false };
}

function activeScaleProgram(db, explicitId = null) {
  const program = explicitId
    ? db.prepare("SELECT * FROM content_scale_programs WHERE id = ?").get(explicitId)
    : db.prepare("SELECT * FROM content_scale_programs WHERE scope_key = 'GLOBAL' AND status IN ('ACTIVE', 'SCORE_DRIVEN') LIMIT 1").get();
  if (!program || !new Set(["ACTIVE", "SCORE_DRIVEN"]).has(program.status)) throw new Error("No active Phase 20 scale program");
  return program;
}

function scaleCapacity(db, program) {
  const used = 25 + db.prepare(`
    SELECT COUNT(*) AS count FROM content_publish_queue
    WHERE scale_program_id = ? AND status NOT IN ('REJECTED', 'CANCELLED', 'BLOCKED')
  `).get(program.id).count;
  const ceiling = program.status === "SCORE_DRIVEN" ? null : nextCheckpoint(program.current_checkpoint);
  return { used, ceiling, remaining: ceiling == null ? null : Math.max(0, ceiling - used) };
}

export function listScaleCandidates(db, rawInput = {}) {
  requireTables(db, ["content_scale_programs", "content_publish_queue", "content_quality_scorecards", "content_assets", "content_opportunities"]);
  const program = activeScaleProgram(db, rawInput.scaleProgramId);
  const limit = integer(rawInput.limit ?? 100, "limit", 1, 500);
  const rows = db.prepare(`
    SELECT asset.*, opportunity.opportunity_score, opportunity.decision,
      scorecard.id AS scorecard_id, scorecard.quality_score AS phase20_quality_score,
      scorecard.evidence_score AS phase20_evidence_score,
      scorecard.differentiation_score AS phase20_differentiation_score
    FROM content_assets asset
    JOIN content_opportunities opportunity ON opportunity.id = asset.opportunity_id
    JOIN content_quality_scorecards scorecard
      ON scorecard.content_id = asset.id AND scorecard.revision_id = asset.current_revision_id
      AND scorecard.status = 'APPROVED'
    WHERE asset.status = 'READY' AND asset.human_reviewed = 1
      AND opportunity.status = 'REVIEWED' AND opportunity.decision = 'CREATE'
      AND NOT EXISTS (
        SELECT 1 FROM content_publish_queue queue
        WHERE queue.content_id = asset.id AND queue.status IN ('REVIEW_REQUIRED', 'APPROVED', 'PUBLISHED')
      )
    ORDER BY opportunity.opportunity_score DESC,
      scorecard.quality_score DESC, asset.title COLLATE NOCASE, asset.id
    LIMIT ?
  `).all(limit);
  return { program, capacity: scaleCapacity(db, program), candidates: rows };
}

export function enqueueScaleContent(db, rawInput) {
  requireTables(db, ["content_publish_queue", "content_scale_programs"]);
  const program = activeScaleProgram(db, rawInput.scaleProgramId);
  const requestedBy = actor(rawInput.requestedBy, "requestedBy");
  const createdAt = rawInput.createdAt == null ? Date.now() : timestamp(rawInput.createdAt, "createdAt");
  const scheduledAt = rawInput.scheduledAt == null ? createdAt : timestamp(rawInput.scheduledAt, "scheduledAt");
  const validated = validateApprovedScorecard(db, cleanText(rawInput.contentId, "contentId", 200), createdAt);
  const { article, scorecard } = validated;
  if (article.status !== "READY" || article.human_reviewed !== 1) throw new Error("Only human-reviewed READY content can enter the publish queue");
  if (article.opportunity_status !== "REVIEWED" || article.opportunity_decision !== "CREATE"
    || article.current_opportunity_checksum !== article.source_opportunity_checksum) {
    throw new Error("Publish queue requires a current human-reviewed CREATE opportunity");
  }
  const existing = db.prepare(`
    SELECT * FROM content_publish_queue
    WHERE content_id = ? AND status IN ('REVIEW_REQUIRED', 'APPROVED', 'PUBLISHED')
    ORDER BY created_at DESC LIMIT 1
  `).get(article.id);
  if (existing) return { queueItem: existing, duplicate: true, capacity: scaleCapacity(db, program) };
  const capacity = scaleCapacity(db, program);
  if (capacity.ceiling !== null && capacity.remaining <= 0) {
    throw new Error(`Scale checkpoint ${capacity.ceiling} reached; review KPI before expanding`);
  }
  const identity = hash(canonical({
    scaleProgramId: program.id, scorecardId: scorecard.id, contentId: article.id,
    scheduledAt, priority: article.opportunity_score,
  }));
  const id = `publish-${identity.slice(0, 28)}`;
  db.prepare(`
    INSERT INTO content_publish_queue (
      id, scale_program_id, scorecard_id, content_id, type, priority,
      category, scheduled_at, status, requested_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'REVIEW_REQUIRED', ?, ?, ?)
  `).run(
    id, program.id, scorecard.id, article.id, article.content_type,
    article.opportunity_score, article.category_slug, scheduledAt,
    requestedBy, createdAt, createdAt,
  );
  return { queueItem: db.prepare("SELECT * FROM content_publish_queue WHERE id = ?").get(id), duplicate: false, capacity: scaleCapacity(db, program) };
}

export function reviewPublishQueueItem(db, rawInput) {
  requireTables(db, ["content_publish_queue", "content_scale_programs"]);
  const queueId = cleanText(rawInput.queueId, "queueId", 200);
  const decision = cleanText(rawInput.decision, "decision", 20).toLocaleUpperCase("en");
  if (!new Set(["APPROVE", "REJECT"]).has(decision)) throw new Error("decision must be APPROVE or REJECT");
  const reviewedBy = actor(rawInput.reviewedBy, "reviewedBy");
  const reviewedAt = rawInput.reviewedAt == null ? Date.now() : timestamp(rawInput.reviewedAt, "reviewedAt");
  const item = db.prepare("SELECT * FROM content_publish_queue WHERE id = ?").get(queueId);
  if (!item) throw new Error(`Unknown publish queue item: ${queueId}`);
  if (item.status !== "REVIEW_REQUIRED") {
    const expected = decision === "APPROVE" ? "APPROVED" : "REJECTED";
    if (item.status === expected) return { ...item, duplicate: true };
    throw new Error("Publish queue item already has a conflicting review state");
  }
  activeScaleProgram(db, item.scale_program_id);
  if (decision === "APPROVE") {
    const validated = validateApprovedScorecard(db, item.content_id, reviewedAt);
    if (validated.scorecard.id !== item.scorecard_id) throw new Error("Publish queue scorecard is no longer current");
    if (validated.article.status !== "READY") throw new Error("Queued content is no longer READY");
  }
  const status = decision === "APPROVE" ? "APPROVED" : "REJECTED";
  db.prepare(`
    UPDATE content_publish_queue
    SET status = ?, approved_by = ?, approved_at = ?, updated_at = ? WHERE id = ?
  `).run(status, decision === "APPROVE" ? reviewedBy : null, decision === "APPROVE" ? reviewedAt : null, reviewedAt, item.id);
  return { ...db.prepare("SELECT * FROM content_publish_queue WHERE id = ?").get(item.id), duplicate: false };
}

export function requireApprovedPublishQueue(db, article, now = Date.now()) {
  if (!tableExists(db, "content_publish_queue") || !tableExists(db, "content_scale_programs")) return null;
  const program = db.prepare(`
    SELECT * FROM content_scale_programs
    WHERE scope_key = 'GLOBAL' AND status IN ('ACTIVE', 'SCORE_DRIVEN') LIMIT 1
  `).get();
  if (!program) return null;
  const item = db.prepare(`
    SELECT * FROM content_publish_queue
    WHERE scale_program_id = ? AND content_id = ? AND status = 'APPROVED'
    ORDER BY approved_at DESC, id DESC LIMIT 1
  `).get(program.id, article.id);
  if (!item) throw new Error("Active Phase 20 scaling requires an approved publish queue item");
  if (item.scheduled_at > now) throw new Error("Publish queue item is scheduled for a future time");
  const validated = validateApprovedScorecard(db, article.id, now);
  if (validated.scorecard.id !== item.scorecard_id) throw new Error("Publish queue references a stale scorecard");
  return item;
}

export function markPublishQueueComplete(db, queueItem, publishedAt = Date.now()) {
  if (!queueItem) return null;
  const result = db.prepare(`
    UPDATE content_publish_queue
    SET status = 'PUBLISHED', published_at = ?, updated_at = ?
    WHERE id = ? AND status = 'APPROVED'
  `).run(publishedAt, publishedAt, queueItem.id);
  if (result.changes !== 1) throw new Error("Approved publish queue item changed during publication");
  return db.prepare("SELECT * FROM content_publish_queue WHERE id = ?").get(queueItem.id);
}

export function getScaleStatus(db, rawInput = {}) {
  requireTables(db, ["content_scale_programs", "content_scale_checkpoint_reviews", "content_publish_queue"]);
  const program = rawInput.scaleProgramId
    ? db.prepare("SELECT * FROM content_scale_programs WHERE id = ?").get(rawInput.scaleProgramId)
    : db.prepare("SELECT * FROM content_scale_programs ORDER BY created_at DESC, id DESC LIMIT 1").get();
  if (!program) return null;
  const checkpoints = db.prepare(`
    SELECT * FROM content_scale_checkpoint_reviews
    WHERE scale_program_id = ? ORDER BY checkpoint_size
  `).all(program.id);
  const queueCounts = db.prepare(`
    SELECT status, COUNT(*) AS count FROM content_publish_queue
    WHERE scale_program_id = ? GROUP BY status ORDER BY status
  `).all(program.id);
  return { program, capacity: scaleCapacity(db, program), checkpoints, queueCounts };
}
