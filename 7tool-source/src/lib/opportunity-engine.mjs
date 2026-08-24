import { createHash, randomUUID } from "node:crypto";
import { keywordSimilarity } from "./semantic-intelligence.mjs";

export const OPPORTUNITY_SCORE_VERSION = "7tool-opportunity-v1";

const INTENT_CLASSES = [
  "PRODUCT", "COMMERCIAL", "SELECTION", "COMPARISON", "SPECIFICATION", "MATERIAL",
  "APPLICATION", "PROBLEM", "COMPATIBILITY", "HOW_TO", "INFORMATIONAL", "UNKNOWN",
];
const FACTOR_KEYS = [
  "searchDemand", "intentValue", "businessPriority", "productRelevance", "contentGap",
  "painPointStrength", "productAvailability", "marginBusiness", "differentiation", "competitionEase",
];
const RISK_LEVELS = ["LOW", "MEDIUM", "HIGH"];

const DEFAULT_WEIGHTS = Object.freeze({
  factors: {
    searchDemand: 1.2,
    intentValue: 1,
    businessPriority: 1.1,
    productRelevance: 1.1,
    contentGap: 1,
    painPointStrength: 0.9,
    productAvailability: 1.1,
    marginBusiness: 1,
    differentiation: 1.3,
    competitionEase: 0.7,
  },
  penalties: {
    cannibalization: { LOW: 0, MEDIUM: 15, HIGH: 45 },
    duplicate: { LOW: 0, MEDIUM: 10, HIGH: 35 },
  },
});

const DEFAULT_THRESHOLDS = Object.freeze({
  createMinScore: 60,
  updateMinScore: 40,
  mergeMinScore: 35,
  minDifferentiation: 10,
  minProductAvailability: 1,
  demandCeiling: 10_000,
  productCountTarget: 10,
  painMentionTarget: 100,
  factorFloor: 5,
  maxSerpAgeDays: 30,
  duplicateHighSimilarity: 0.8,
  duplicateMediumSimilarity: 0.6,
  intentValues: {
    PRODUCT: 85, COMMERCIAL: 100, SELECTION: 90, COMPARISON: 85,
    SPECIFICATION: 70, MATERIAL: 70, APPLICATION: 80, PROBLEM: 85,
    COMPATIBILITY: 95, HOW_TO: 75, INFORMATIONAL: 60, UNKNOWN: 30,
  },
});

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function cleanText(value, limit = 1000) {
  return String(value ?? "").normalize("NFKC").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function integer(value, name, minimum = 0, maximum = 100) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) throw new Error(`${name} must be an integer from ${minimum} to ${maximum}`);
  return number;
}

function timestamp(value, name, fallback = Date.now()) {
  const parsed = value == null ? fallback : (typeof value === "number" ? value : Date.parse(String(value)));
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${name} must be a valid timestamp`);
  return Math.trunc(parsed);
}

export function defaultOpportunityScoreModel() {
  return { version: OPPORTUNITY_SCORE_VERSION, weights: clone(DEFAULT_WEIGHTS), thresholds: clone(DEFAULT_THRESHOLDS) };
}

export function validateOpportunityScoreModel(input) {
  const version = cleanText(input.version, 100);
  if (!version) throw new Error("Score model version is required");
  const weights = clone(input.weights);
  const thresholds = clone(input.thresholds);
  if (!weights?.factors || !weights?.penalties || !thresholds) throw new Error("Score model weights and thresholds are required");
  const factorNames = Object.keys(weights.factors).sort();
  if (canonical(factorNames) !== canonical([...FACTOR_KEYS].sort())) throw new Error("Score model must define the exact supported factor allowlist");
  for (const key of FACTOR_KEYS) {
    const value = Number(weights.factors[key]);
    if (!Number.isFinite(value) || value < 0 || value > 10) throw new Error(`Invalid factor weight: ${key}`);
    weights.factors[key] = value;
  }
  if (!Object.values(weights.factors).some((value) => value > 0)) throw new Error("At least one score factor must have a positive weight");
  for (const riskName of ["cannibalization", "duplicate"]) {
    const riskWeights = weights.penalties[riskName];
    if (!riskWeights || canonical(Object.keys(riskWeights).sort()) !== canonical([...RISK_LEVELS].sort())) {
      throw new Error(`Penalty ${riskName} must define LOW, MEDIUM and HIGH`);
    }
    for (const level of RISK_LEVELS) riskWeights[level] = integer(riskWeights[level], `${riskName}.${level}`);
    if (!(riskWeights.LOW <= riskWeights.MEDIUM && riskWeights.MEDIUM <= riskWeights.HIGH)) {
      throw new Error(`${riskName} penalties must be monotonic`);
    }
  }
  const scoreThresholds = ["createMinScore", "updateMinScore", "mergeMinScore", "minDifferentiation", "minProductAvailability", "factorFloor"];
  for (const key of scoreThresholds) thresholds[key] = integer(thresholds[key], key);
  for (const key of ["demandCeiling", "productCountTarget", "painMentionTarget"]) {
    thresholds[key] = integer(thresholds[key], key, 1, 10_000_000);
  }
  thresholds.maxSerpAgeDays = integer(thresholds.maxSerpAgeDays, "maxSerpAgeDays", 1, 90);
  for (const key of ["duplicateHighSimilarity", "duplicateMediumSimilarity"]) {
    const value = Number(thresholds[key]);
    if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${key} must be between 0 and 1`);
    thresholds[key] = value;
  }
  if (thresholds.duplicateMediumSimilarity >= thresholds.duplicateHighSimilarity) {
    throw new Error("Duplicate similarity thresholds must be ordered");
  }
  if (!thresholds.intentValues || canonical(Object.keys(thresholds.intentValues).sort()) !== canonical([...INTENT_CLASSES].sort())) {
    throw new Error("Score model must define every supported intent value");
  }
  for (const intentClass of INTENT_CLASSES) thresholds.intentValues[intentClass] = integer(thresholds.intentValues[intentClass], `intentValues.${intentClass}`);
  return { version, weights, thresholds, checksum: hash(canonical({ version, weights, thresholds })) };
}

export function createOpportunityScoreModel(db, input = defaultOpportunityScoreModel()) {
  const model = validateOpportunityScoreModel(input);
  const sameVersion = db.prepare("SELECT * FROM score_models WHERE score_type = 'CONTENT_OPPORTUNITY' AND version = ?").get(model.version);
  if (sameVersion) {
    if (sameVersion.model_checksum !== model.checksum) throw new Error("Score model versions are immutable; use a new version");
    return sameVersion;
  }
  const id = `opportunity-model-${hash(model.checksum).slice(0, 20)}`;
  db.prepare(`
    INSERT INTO score_models (
      id, score_type, version, weights_json, thresholds_json, model_checksum, status, created_at
    ) VALUES (?, 'CONTENT_OPPORTUNITY', ?, ?, ?, ?, 'DRAFT', ?)
  `).run(id, model.version, canonical(model.weights), canonical(model.thresholds), model.checksum, Date.now());
  return db.prepare("SELECT * FROM score_models WHERE id = ?").get(id);
}

export function approveOpportunityScoreModel(db, input) {
  if (!input.reviewedBy) throw new Error("Score model approval requires a real reviewer");
  const model = db.prepare("SELECT * FROM score_models WHERE id = ?").get(input.modelId);
  if (!model) throw new Error("Score model not found");
  validateOpportunityScoreModel({ version: model.version, weights: JSON.parse(model.weights_json), thresholds: JSON.parse(model.thresholds_json) });
  if (model.status === "APPROVED") return model;
  if (model.status !== "DRAFT") throw new Error("Only a draft score model can be approved");
  const now = Date.now();
  db.transaction(() => {
    db.prepare("UPDATE score_models SET status = 'RETIRED' WHERE score_type = 'CONTENT_OPPORTUNITY' AND status = 'APPROVED'").run();
    db.prepare("UPDATE score_models SET status = 'APPROVED', approved_by = ?, approved_at = ? WHERE id = ?")
      .run(input.reviewedBy, now, input.modelId);
  })();
  return db.prepare("SELECT * FROM score_models WHERE id = ?").get(input.modelId);
}

export function registerOpportunityBusinessInput(db, input) {
  if (!input.reviewedBy) throw new Error("Business input requires a real reviewer");
  const categorySlug = cleanText(input.categorySlug, 200);
  const cluster = db.prepare("SELECT category_slug FROM keyword_clusters WHERE id = ?").get(input.clusterId);
  if (!cluster || cluster.category_slug !== categorySlug) throw new Error("Business input cluster and category do not match");
  const businessPriority = integer(input.businessPriority, "businessPriority");
  const marginBusinessScore = integer(input.marginBusinessScore, "marginBusinessScore");
  const sourceRef = cleanText(input.sourceRef, 500);
  if (!sourceRef) throw new Error("Business input sourceRef is required");
  const validFrom = timestamp(input.validFrom, "validFrom");
  if (validFrom > Date.now() + 5 * 60_000) throw new Error("Business input validFrom cannot be in the future");
  const validUntil = input.validUntil == null ? null : timestamp(input.validUntil, "validUntil");
  if (validUntil !== null && validUntil <= validFrom) throw new Error("Business input validUntil must be after validFrom");
  if (validUntil !== null && validUntil <= Date.now()) throw new Error("Business input validUntil must be in the future");
  const active = db.prepare("SELECT * FROM opportunity_business_inputs WHERE cluster_id = ? AND status = 'ACTIVE'").get(input.clusterId);
  if (active && active.category_slug === categorySlug && active.business_priority === businessPriority
    && active.margin_business_score === marginBusinessScore && active.source_ref === sourceRef
    && active.valid_until === validUntil) return active;
  const inputChecksum = hash(canonical({ categorySlug, clusterId: input.clusterId, businessPriority, marginBusinessScore, sourceRef, validFrom, validUntil }));
  const duplicate = db.prepare("SELECT * FROM opportunity_business_inputs WHERE input_checksum = ?").get(inputChecksum);
  if (duplicate) return duplicate;
  const now = Date.now();
  const id = randomUUID();
  db.transaction(() => {
    if (active) {
      db.prepare("UPDATE opportunity_business_inputs SET status = 'SUPERSEDED', valid_until = ? WHERE id = ?")
        .run(Math.max(validFrom, active.valid_from + 1), active.id);
    }
    db.prepare(`
      INSERT INTO opportunity_business_inputs (
        id, category_slug, cluster_id, business_priority, margin_business_score,
        source_ref, input_checksum, valid_from, valid_until, supersedes_id, status,
        reviewed_by, reviewed_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?)
    `).run(id, categorySlug, input.clusterId, businessPriority, marginBusinessScore,
      sourceRef, inputChecksum, validFrom, validUntil, active?.id ?? null,
      input.reviewedBy, now, now);
  })();
  return db.prepare("SELECT * FROM opportunity_business_inputs WHERE id = ?").get(id);
}

function searchDemandScore(wordstatDemand, googleDemand, ceiling) {
  const demand = Math.max(wordstatDemand ?? 0, googleDemand ?? 0);
  return Math.round(Math.min(1, Math.log1p(demand) / Math.log1p(ceiling)) * 100);
}

function pageTypeFromAssessment(assessment, intentClass) {
  const direct = {
    PRODUCT_ENRICHMENT: "PRODUCT_ENRICHMENT",
    CATEGORY_ENRICHMENT: "CATEGORY_ENRICHMENT",
    CALCULATOR: "CALCULATOR",
    VIDEO: "VIDEO",
    TABLE_REFERENCE: "TABLE",
  };
  if (direct[assessment.recommended_page_type]) return direct[assessment.recommended_page_type];
  const articles = {
    SELECTION: "PILLAR_GUIDE", HOW_TO: "HOW_TO", PROBLEM: "TROUBLESHOOTING",
    COMPARISON: "COMPARISON", COMPATIBILITY: "COMPATIBILITY", SPECIFICATION: "REFERENCE",
    MATERIAL: "REFERENCE", APPLICATION: "CASE_STUDY", INFORMATIONAL: "PILLAR_GUIDE",
    COMMERCIAL: "SEO_LANDING", PRODUCT: "PRODUCT_ENRICHMENT", UNKNOWN: "PILLAR_GUIDE",
  };
  return articles[intentClass] ?? "PILLAR_GUIDE";
}

function geometricScore(factors, weights, floor) {
  let weightedLog = 0;
  let totalWeight = 0;
  for (const key of FACTOR_KEYS) {
    const weight = weights[key];
    if (!weight) continue;
    const normalized = Math.max(floor, Math.min(100, factors[key])) / 100;
    weightedLog += weight * Math.log(normalized);
    totalWeight += weight;
  }
  return totalWeight ? Math.exp(weightedLog / totalWeight) * 100 : 0;
}

function normalizePainSelections(input) {
  const rows = (input ?? []).map((item) => typeof item === "string" ? { id: item, relevance: 100 } : item);
  const seen = new Set();
  return rows.map((row) => {
    if (!row.id || seen.has(row.id)) throw new Error("Pain point selections must have unique ids");
    seen.add(row.id);
    return { id: row.id, relevance: integer(row.relevance ?? 100, "pain point relevance") };
  });
}

export function evaluateContentOpportunity(db, input) {
  const intent = db.prepare("SELECT * FROM search_intents WHERE id = ?").get(input.intentId);
  if (!intent || ["MERGED", "REJECTED"].includes(intent.status)) throw new Error("Active search intent not found");
  const clusterRows = db.prepare(`
    SELECT DISTINCT cluster_id FROM seo_keywords
    WHERE intent_id = ? AND cluster_id IS NOT NULL AND status != 'REJECTED'
  `).all(intent.id);
  if (clusterRows.length !== 1) throw new Error("Opportunity requires exactly one reviewed semantic cluster");
  const clusterId = clusterRows[0].cluster_id;
  const cluster = db.prepare("SELECT * FROM keyword_clusters WHERE id = ?").get(clusterId);
  if (!cluster || ["MERGED", "REJECTED"].includes(cluster.status)) throw new Error("Active keyword cluster not found");
  const categorySlug = intent.category_slug ?? cluster.category_slug;
  if (!categorySlug || (cluster.category_slug && cluster.category_slug !== categorySlug)) throw new Error("Intent and cluster category do not match");

  const model = db.prepare("SELECT * FROM score_models WHERE score_type = 'CONTENT_OPPORTUNITY' AND status = 'APPROVED'").get();
  if (!model) throw new Error("An approved content opportunity score model is required");
  const config = validateOpportunityScoreModel({
    version: model.version, weights: JSON.parse(model.weights_json), thresholds: JSON.parse(model.thresholds_json),
  });
  const now = Date.now();
  const businessInput = db.prepare(`
    SELECT * FROM opportunity_business_inputs WHERE cluster_id = ? AND category_slug = ?
      AND status = 'ACTIVE' AND valid_from <= ? AND (valid_until IS NULL OR valid_until > ?)
  `).get(clusterId, categorySlug, now, now);
  if (!businessInput) throw new Error("A current reviewed business input is required");
  const assessment = db.prepare(`
    SELECT * FROM serp_assessments WHERE cluster_id = ? AND intent_id = ? AND status = 'REVIEWED'
    ORDER BY reviewed_at DESC, created_at DESC LIMIT 1
  `).get(clusterId, intent.id);
  if (!assessment) throw new Error("A human-reviewed SERP assessment is required");
  const oldestSnapshot = db.prepare(`
    SELECT MIN(s.captured_at) AS captured_at FROM serp_assessment_snapshots x
    JOIN serp_snapshots s ON s.id = x.snapshot_id WHERE x.assessment_id = ?
  `).get(assessment.id).captured_at;
  if (!oldestSnapshot || oldestSnapshot < now - config.thresholds.maxSerpAgeDays * 86_400_000) {
    throw new Error("SERP assessment evidence is stale");
  }

  const keywords = db.prepare(`
    SELECT k.*, s.source_type FROM seo_keywords k JOIN sources s ON s.id = k.source_id
    WHERE k.cluster_id = ? AND k.intent_id = ? AND k.status != 'REJECTED'
    ORDER BY CASE s.source_type WHEN 'WORDSTAT' THEN 0 WHEN 'GSC' THEN 1 ELSE 2 END,
      COALESCE(k.exact_frequency, k.frequency, 0) DESC, k.normalized_query
  `).all(clusterId, intent.id);
  if (!keywords.length) throw new Error("Opportunity has no source keywords");
  const primaryKeyword = keywords[0];
  const demandFor = (sourceType) => {
    const values = keywords.filter((row) => row.source_type === sourceType)
      .map((row) => row.exact_frequency ?? row.frequency).filter((value) => value !== null && value !== undefined);
    return values.length ? Math.max(...values) : null;
  };
  const wordstatDemand = demandFor("WORDSTAT");
  const googleDemand = demandFor("GSC");

  const productStats = db.prepare(`
    SELECT COUNT(*) AS product_count,
      SUM(CASE WHEN draft = 0 THEN 1 ELSE 0 END) AS live_count,
      SUM(CASE WHEN draft = 0 AND (stock > 0 OR EXISTS (
        SELECT 1 FROM variants v WHERE v.product_id = products.id AND v.available = 1
          AND COALESCE(v.quantity, 1) > 0
      )) THEN 1 ELSE 0 END) AS available_count
    FROM products WHERE category = ?
  `).get(categorySlug);
  const liveCount = Number(productStats.live_count ?? 0);
  const availableCount = Number(productStats.available_count ?? 0);
  const productRelevance = Math.round(Math.min(1, liveCount / config.thresholds.productCountTarget) * 100);
  const productAvailability = Math.round(Math.min(1, availableCount / config.thresholds.productCountTarget) * 100);

  const painSelections = normalizePainSelections(input.painPoints);
  const painRows = [];
  for (const selection of painSelections) {
    const row = db.prepare(`
      SELECT * FROM pain_points WHERE id = ? AND category_slug = ?
        AND status IN ('DISCOVERED', 'REVIEWED', 'CONTENT_EXISTS')
    `).get(selection.id, categorySlug);
    if (!row) throw new Error(`Pain point is missing, inactive or outside the opportunity category: ${selection.id}`);
    const mentionScore = Math.min(1, Math.log1p(row.mentions) / Math.log1p(config.thresholds.painMentionTarget)) * 100;
    const strength = Math.round((row.priority * 0.6 + mentionScore * 0.4) * selection.relevance / 100);
    painRows.push({ ...selection, strength });
  }
  const painPointStrength = painRows.length ? Math.max(...painRows.map((row) => row.strength)) : 0;

  const urlMap = new Map();
  const addUrl = (row, preferred = false) => {
    if (!row || row.index_status !== "INDEX" || (row.http_status !== null && row.http_status !== 200)) return;
    urlMap.set(row.id, { ...row, preferred: preferred || urlMap.get(row.id)?.preferred || false });
  };
  if (intent.preferred_url_id) addUrl(db.prepare("SELECT * FROM site_urls WHERE id = ?").get(intent.preferred_url_id), true);
  for (const row of db.prepare(`
    SELECT DISTINCT su.* FROM seo_keywords k JOIN site_urls su ON su.id = k.existing_url_id
    WHERE k.intent_id = ? AND k.cluster_id = ? AND k.existing_url_id IS NOT NULL
  `).all(intent.id, clusterId)) addUrl(row);
  for (const row of db.prepare(`
    SELECT su.* FROM intent_url_mappings m JOIN site_urls su ON su.id = m.site_url_id
    WHERE m.intent_id = ? AND m.status = 'APPROVED'
  `).all(intent.id)) addUrl(row, row.id === intent.preferred_url_id);
  const existingUrls = [...urlMap.values()].sort((left, right) => Number(right.preferred) - Number(left.preferred) || left.path.localeCompare(right.path));
  const keywordRisk = keywords.some((row) => row.cannibalization_risk === "HIGH") ? "HIGH"
    : keywords.some((row) => row.cannibalization_risk === "MEDIUM") ? "MEDIUM" : "LOW";
  const cannibalizationRisk = existingUrls.length > 1 ? "HIGH" : keywordRisk;

  const otherOpportunities = db.prepare(`
    SELECT id, topic, recommended_url_id, decision FROM content_opportunities
    WHERE category_slug = ? AND intent_id != ? AND status IN ('PROPOSED', 'REVIEWED')
      AND decision IN ('CREATE', 'UPDATE')
  `).all(categorySlug, intent.id);
  let duplicateTarget = null;
  let duplicateSimilarity = 0;
  for (const other of otherOpportunities) {
    const similarity = keywordSimilarity(primaryKeyword.normalized_query, other.topic);
    if (similarity > duplicateSimilarity) { duplicateSimilarity = similarity; duplicateTarget = other; }
  }
  const duplicateRisk = duplicateSimilarity >= config.thresholds.duplicateHighSimilarity ? "HIGH"
    : duplicateSimilarity >= config.thresholds.duplicateMediumSimilarity ? "MEDIUM" : "LOW";

  const competitionScore = Math.round(Math.min(1, assessment.commercial_density * 0.65 + assessment.marketplace_share * 0.35) * 100);
  const factors = {
    searchDemand: searchDemandScore(wordstatDemand, googleDemand, config.thresholds.demandCeiling),
    intentValue: config.thresholds.intentValues[intent.intent_class],
    businessPriority: businessInput.business_priority,
    productRelevance,
    contentGap: assessment.content_gap_score,
    painPointStrength,
    productAvailability,
    marginBusiness: businessInput.margin_business_score,
    differentiation: assessment.differentiation_score,
    competitionEase: 100 - competitionScore,
  };
  const baseScore = geometricScore(factors, config.weights.factors, config.thresholds.factorFloor);
  const cannibalizationPenalty = config.weights.penalties.cannibalization[cannibalizationRisk];
  const duplicatePenalty = config.weights.penalties.duplicate[duplicateRisk];
  const opportunityScore = Math.max(0, Math.min(100, Math.round(baseScore - cannibalizationPenalty - duplicatePenalty)));
  const recommendedPageType = pageTypeFromAssessment(assessment, intent.intent_class);
  let decision = "REJECT";
  let reasonCode = "LOW_SCORE";
  let recommendedUrlId = null;
  let mergeIntoOpportunityId = null;

  if (assessment.recommendation === "REJECT" || assessment.differentiation_score < config.thresholds.minDifferentiation) {
    reasonCode = assessment.recommendation === "REJECT" ? "SERP_REJECTED" : "NO_DIFFERENTIATION";
  } else if (assessment.recommendation === "HUMAN_REVIEW" || assessment.dominant_serp_type === "MIXED") {
    reasonCode = "SERP_INCONCLUSIVE";
  } else if (productAvailability < config.thresholds.minProductAvailability) {
    reasonCode = "NO_PRODUCT_AVAILABILITY";
  } else if (duplicateRisk === "HIGH" && duplicateTarget && opportunityScore >= config.thresholds.mergeMinScore) {
    decision = "MERGE"; reasonCode = "DUPLICATE_INTENT";
    mergeIntoOpportunityId = duplicateTarget.id;
    recommendedUrlId = duplicateTarget.recommended_url_id ?? null;
  } else if (duplicateRisk === "HIGH") {
    reasonCode = "DUPLICATE_INTENT";
  } else if (existingUrls.length > 1 && opportunityScore >= config.thresholds.mergeMinScore) {
    decision = "MERGE"; reasonCode = "OVERLAPPING_PAGES"; recommendedUrlId = existingUrls[0].id;
  } else if (cannibalizationRisk === "HIGH") {
    reasonCode = "HIGH_CANNIBALIZATION";
  } else if (existingUrls.length === 1 && opportunityScore >= config.thresholds.updateMinScore) {
    decision = "UPDATE"; reasonCode = "EXISTING_PAGE"; recommendedUrlId = existingUrls[0].id;
  } else if (existingUrls.length === 0 && cannibalizationRisk !== "LOW") {
    reasonCode = "CANNIBALIZATION_REVIEW_REQUIRED";
  } else if (existingUrls.length === 0 && cannibalizationRisk === "LOW"
    && duplicateRisk !== "HIGH" && opportunityScore >= config.thresholds.createMinScore) {
    decision = "CREATE"; reasonCode = "NEW_INTENT";
  }
  const reasons = {
    NEW_INTENT: "No suitable existing page or duplicate opportunity; the score clears the CREATE threshold.",
    EXISTING_PAGE: "One suitable existing URL covers the intent and should be improved instead of creating a new page.",
    OVERLAPPING_PAGES: "Multiple indexable URLs cover the intent and require a merge review.",
    DUPLICATE_INTENT: "A materially similar opportunity already exists and is the proposed merge target.",
    NO_DIFFERENTIATION: "Differentiation evidence is below the approved minimum.",
    NO_PRODUCT_AVAILABILITY: "No sufficient available product inventory supports this opportunity.",
    SERP_REJECTED: "The reviewed SERP assessment found no additional value.",
    SERP_INCONCLUSIVE: "The reviewed SERP evidence does not establish a dominant page type.",
    HIGH_CANNIBALIZATION: "Cannibalization is high and no safe merge proposal cleared the threshold.",
    CANNIBALIZATION_REVIEW_REQUIRED: "Existing cannibalization evidence must be resolved before a new page can be proposed.",
    LOW_SCORE: "The opportunity score does not clear the required decision threshold.",
  };
  const scoreBreakdown = {
    modelVersion: model.version, modelChecksum: model.model_checksum, factors,
    factorWeights: config.weights.factors, factorFloor: config.thresholds.factorFloor,
    baseScore: Math.round(baseScore * 100) / 100,
    penalties: { cannibalization: cannibalizationPenalty, duplicate: duplicatePenalty },
    thresholds: config.thresholds,
    inputs: {
      wordstatDemand, googleDemand, liveProductCount: liveCount, availableProductCount: availableCount,
      competitionScore, existingUrlIds: existingUrls.map((row) => row.id), duplicateSimilarity,
      painPoints: painRows,
    },
  };
  const evaluationChecksum = hash(canonical({
    intentId: intent.id, clusterId, primaryKeywordId: primaryKeyword.id,
    serpAssessmentChecksum: assessment.assessment_checksum, scoreModelChecksum: model.model_checksum,
    businessInputChecksum: businessInput.input_checksum, scoreBreakdown, decision, reasonCode,
    recommendedUrlId, mergeIntoOpportunityId,
  }));
  return {
    topic: cleanText(intent.label || primaryKeyword.query, 500), categorySlug, clusterId, intentId: intent.id,
    primaryKeywordId: primaryKeyword.id, serpAssessmentId: assessment.id, scoreModelId: model.id,
    businessInputId: businessInput.id, wordstatDemand, googleDemand,
    searchDemandScore: factors.searchDemand, intentValue: factors.intentValue,
    businessPriority: factors.businessPriority, productRelevance, contentGapScore: factors.contentGap,
    painPointStrength, productAvailability, marginBusinessScore: factors.marginBusiness,
    differentiationScore: factors.differentiation, competitionScore,
    cannibalizationRisk, duplicateRisk, cannibalizationPenalty, duplicatePenalty,
    existingUrlCount: existingUrls.length, recommendedPageType, recommendedUrlId,
    mergeIntoOpportunityId, decision, opportunityScore, scoreBreakdown,
    decisionReasonCode: reasonCode, decisionReason: reasons[reasonCode], evaluationChecksum,
    painPoints: painRows,
  };
}

export function persistContentOpportunity(db, input) {
  const proposal = evaluateContentOpportunity(db, input);
  const existing = db.prepare("SELECT * FROM content_opportunities WHERE intent_id = ?").get(proposal.intentId);
  if (existing?.evaluation_checksum === proposal.evaluationChecksum) return { opportunity: existing, duplicate: true };
  const opportunityId = existing?.id ?? `opportunity-${hash(proposal.intentId).slice(0, 24)}`;
  const evaluationId = randomUUID();
  const now = Date.now();
  const values = {
    id: opportunityId, topic: proposal.topic, category_slug: proposal.categorySlug,
    cluster_id: proposal.clusterId, intent_id: proposal.intentId,
    primary_keyword_id: proposal.primaryKeywordId, serp_assessment_id: proposal.serpAssessmentId,
    score_model_id: proposal.scoreModelId, business_input_id: proposal.businessInputId,
    wordstat_demand: proposal.wordstatDemand, google_demand: proposal.googleDemand,
    search_demand_score: proposal.searchDemandScore, intent_value: proposal.intentValue,
    business_priority: proposal.businessPriority, product_relevance: proposal.productRelevance,
    content_gap_score: proposal.contentGapScore, pain_point_strength: proposal.painPointStrength,
    product_availability: proposal.productAvailability, margin_business_score: proposal.marginBusinessScore,
    differentiation_score: proposal.differentiationScore, competition_score: proposal.competitionScore,
    cannibalization_risk: proposal.cannibalizationRisk, duplicate_risk: proposal.duplicateRisk,
    cannibalization_penalty: proposal.cannibalizationPenalty, duplicate_penalty: proposal.duplicatePenalty,
    existing_url_count: proposal.existingUrlCount, recommended_page_type: proposal.recommendedPageType,
    recommended_url_id: proposal.recommendedUrlId, merge_into_opportunity_id: proposal.mergeIntoOpportunityId,
    decision: proposal.decision, opportunity_score: proposal.opportunityScore,
    score_breakdown_json: canonical(proposal.scoreBreakdown), decision_reason_code: proposal.decisionReasonCode,
    decision_reason: proposal.decisionReason, evaluation_checksum: proposal.evaluationChecksum,
    created_at: now, updated_at: now,
  };
  db.transaction(() => {
    db.prepare(`
      INSERT INTO content_opportunities (
        id, topic, category_slug, cluster_id, intent_id, primary_keyword_id,
        serp_assessment_id, score_model_id, business_input_id, wordstat_demand, google_demand,
        search_demand_score, intent_value, business_priority, product_relevance,
        content_gap_score, pain_point_strength, product_availability, margin_business_score,
        differentiation_score, competition_score, cannibalization_risk, duplicate_risk,
        cannibalization_penalty, duplicate_penalty, existing_url_count, recommended_page_type,
        recommended_url_id, merge_into_opportunity_id, decision, opportunity_score,
        score_breakdown_json, decision_reason_code, decision_reason, evaluation_checksum,
        status, created_at, updated_at
      ) VALUES (
        @id, @topic, @category_slug, @cluster_id, @intent_id, @primary_keyword_id,
        @serp_assessment_id, @score_model_id, @business_input_id, @wordstat_demand, @google_demand,
        @search_demand_score, @intent_value, @business_priority, @product_relevance,
        @content_gap_score, @pain_point_strength, @product_availability, @margin_business_score,
        @differentiation_score, @competition_score, @cannibalization_risk, @duplicate_risk,
        @cannibalization_penalty, @duplicate_penalty, @existing_url_count, @recommended_page_type,
        @recommended_url_id, @merge_into_opportunity_id, @decision, @opportunity_score,
        @score_breakdown_json, @decision_reason_code, @decision_reason, @evaluation_checksum,
        'PROPOSED', @created_at, @updated_at
      ) ON CONFLICT(intent_id) DO UPDATE SET
        topic = excluded.topic, category_slug = excluded.category_slug, cluster_id = excluded.cluster_id,
        primary_keyword_id = excluded.primary_keyword_id, serp_assessment_id = excluded.serp_assessment_id,
        score_model_id = excluded.score_model_id, business_input_id = excluded.business_input_id,
        wordstat_demand = excluded.wordstat_demand, google_demand = excluded.google_demand,
        search_demand_score = excluded.search_demand_score, intent_value = excluded.intent_value,
        business_priority = excluded.business_priority, product_relevance = excluded.product_relevance,
        content_gap_score = excluded.content_gap_score, pain_point_strength = excluded.pain_point_strength,
        product_availability = excluded.product_availability, margin_business_score = excluded.margin_business_score,
        differentiation_score = excluded.differentiation_score, competition_score = excluded.competition_score,
        cannibalization_risk = excluded.cannibalization_risk, duplicate_risk = excluded.duplicate_risk,
        cannibalization_penalty = excluded.cannibalization_penalty, duplicate_penalty = excluded.duplicate_penalty,
        existing_url_count = excluded.existing_url_count, recommended_page_type = excluded.recommended_page_type,
        recommended_url_id = excluded.recommended_url_id, merge_into_opportunity_id = excluded.merge_into_opportunity_id,
        decision = excluded.decision, opportunity_score = excluded.opportunity_score,
        score_breakdown_json = excluded.score_breakdown_json, decision_reason_code = excluded.decision_reason_code,
        decision_reason = excluded.decision_reason, evaluation_checksum = excluded.evaluation_checksum,
        status = 'PROPOSED', reviewed_by = NULL, reviewed_at = NULL, updated_at = excluded.updated_at
    `).run(values);
    db.prepare("DELETE FROM opportunity_pain_points WHERE opportunity_id = ?").run(opportunityId);
    const linkCurrentPain = db.prepare("INSERT INTO opportunity_pain_points (opportunity_id, pain_point_id, relevance) VALUES (?, ?, ?)");
    for (const pain of proposal.painPoints) linkCurrentPain.run(opportunityId, pain.id, pain.relevance);
    db.prepare(`
      INSERT INTO opportunity_evaluations (
        id, opportunity_id, score_model_id, serp_assessment_id, business_input_id,
        opportunity_score, decision, score_breakdown_json, decision_reason_code,
        decision_reason, evaluation_checksum, evaluated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(evaluationId, opportunityId, proposal.scoreModelId, proposal.serpAssessmentId,
      proposal.businessInputId, proposal.opportunityScore, proposal.decision,
      canonical(proposal.scoreBreakdown), proposal.decisionReasonCode,
      proposal.decisionReason, proposal.evaluationChecksum, now);
    const linkEvaluationPain = db.prepare("INSERT INTO opportunity_evaluation_pain_points (evaluation_id, pain_point_id, relevance) VALUES (?, ?, ?)");
    for (const pain of proposal.painPoints) linkEvaluationPain.run(evaluationId, pain.id, pain.relevance);
  })();
  return { opportunity: db.prepare("SELECT * FROM content_opportunities WHERE id = ?").get(opportunityId), evaluationId, duplicate: false };
}

export function reviewContentOpportunity(db, input) {
  if (!input.reviewedBy) throw new Error("Opportunity review requires a real reviewer");
  if (!new Set(["APPROVE", "REJECT"]).has(input.reviewDecision)) throw new Error("reviewDecision must be APPROVE or REJECT");
  const row = db.prepare(`
    SELECT o.*, m.status AS model_status, b.status AS business_status,
      b.valid_from, b.valid_until, a.status AS assessment_status
    FROM content_opportunities o
    JOIN score_models m ON m.id = o.score_model_id
    JOIN opportunity_business_inputs b ON b.id = o.business_input_id
    JOIN serp_assessments a ON a.id = o.serp_assessment_id
    WHERE o.id = ?
  `).get(input.opportunityId);
  if (!row) throw new Error("Content opportunity not found");
  if (row.status !== "PROPOSED") throw new Error("Content opportunity was already reviewed");
  const now = Date.now();
  if (row.model_status !== "APPROVED" || row.business_status !== "ACTIVE" || row.assessment_status !== "REVIEWED"
    || row.valid_from > now || (row.valid_until !== null && row.valid_until <= now)) {
    throw new Error("Content opportunity evidence is stale; reevaluation is required");
  }
  const model = db.prepare("SELECT thresholds_json FROM score_models WHERE id = ?").get(row.score_model_id);
  const maxSerpAgeDays = JSON.parse(model.thresholds_json).maxSerpAgeDays;
  const oldestSnapshot = db.prepare(`
    SELECT MIN(s.captured_at) AS captured_at FROM serp_assessment_snapshots x
    JOIN serp_snapshots s ON s.id = x.snapshot_id WHERE x.assessment_id = ?
  `).get(row.serp_assessment_id).captured_at;
  if (!oldestSnapshot || oldestSnapshot < now - maxSerpAgeDays * 86_400_000) {
    throw new Error("Content opportunity SERP evidence is stale; reevaluation is required");
  }
  db.prepare(`
    UPDATE content_opportunities SET status = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?
  `).run(input.reviewDecision === "APPROVE" ? "REVIEWED" : "REJECTED", input.reviewedBy, now, now, input.opportunityId);
  return db.prepare("SELECT * FROM content_opportunities WHERE id = ?").get(input.opportunityId);
}

export function listPrioritizedContentOpportunities(db, categorySlug, limit = 100) {
  return db.prepare(`
    SELECT * FROM content_opportunities WHERE category_slug = ? AND status IN ('PROPOSED', 'REVIEWED')
    ORDER BY CASE decision WHEN 'UPDATE' THEN 0 WHEN 'MERGE' THEN 1 WHEN 'CREATE' THEN 2 ELSE 3 END,
      opportunity_score DESC, topic LIMIT ?
  `).all(categorySlug, Math.max(1, Math.min(500, limit)));
}
