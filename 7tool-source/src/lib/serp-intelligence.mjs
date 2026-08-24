import { createHash, randomUUID } from "node:crypto";
import { normalizeKeyword } from "./semantic-intelligence.mjs";

export const SERP_CLASSIFIER_VERSION = "7tool-serp-rules-v1";
export const DIFFERENTIATION_MODEL_VERSION = "7tool-differentiation-v1";

const PAGE_TYPES = new Set([
  "PRODUCT", "CATEGORY", "ARTICLE", "FORUM", "VIDEO", "TABLE", "CALCULATOR",
  "MARKETPLACE", "MANUFACTURER", "ECOMMERCE", "PDF_MANUAL", "OTHER",
]);
const SITE_CLASSES = new Set([
  "OWNED", "COMPETITOR", "MARKETPLACE", "MANUFACTURER", "FORUM", "VIDEO_PLATFORM", "OTHER",
]);
const INSIGHT_TYPES = new Set([
  "COVERED_TOPIC", "MISSING_TOPIC", "MISSING_QUESTION", "MISSING_COMPARISON",
  "WEAK_EXPLANATION", "MISSING_TABLE", "OUTDATED_INFORMATION", "UX_WEAKNESS",
]);
const TRACKING_PARAMS = new Set(["gclid", "yclid", "fbclid", "_openstat"]);
const VIDEO_DOMAINS = new Set(["youtube.com", "www.youtube.com", "youtu.be", "rutube.ru", "vkvideo.ru"]);

const DIFFERENTIATION_WEIGHTS = Object.freeze({
  BETTER_TABLE: 10,
  COMPATIBILITY_DATA: 14,
  OWN_SUPPLIER_DATA: 12,
  CLEARER_EXPLANATION: 8,
  CALCULATOR: 12,
  BETTER_COMPARISON: 9,
  REVIEW_FAQ: 8,
  PRODUCT_SELECTION: 10,
  VERIFIED_SPECIFICATIONS: 12,
  LICENSED_PHOTOGRAPHY: 7,
  EXPERT_COMMENTARY: 10,
});

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function cleanText(value, limit) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function webUrl(value, label = "SERP URL") {
  let url;
  try { url = new URL(value); } catch { throw new Error(`${label} is invalid`); }
  if (!/^https?:$/.test(url.protocol)) throw new Error(`${label} must use HTTP(S)`);
  if (url.username || url.password) throw new Error(`Credentials are forbidden in ${label.toLocaleLowerCase("en-US")}s`);
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLocaleLowerCase("en-US").startsWith("utm_") || TRACKING_PARAMS.has(key.toLocaleLowerCase("en-US"))) {
      url.searchParams.delete(key);
    }
  }
  return url;
}

function asTimestamp(value, label) {
  const timestamp = typeof value === "number" ? value : Date.parse(String(value ?? ""));
  if (!Number.isFinite(timestamp) || timestamp <= 0) throw new Error(`${label} must be a valid timestamp`);
  if (timestamp > Date.now() + 5 * 60_000) throw new Error(`${label} cannot be in the future`);
  return Math.trunc(timestamp);
}

function bool(value) {
  return value === true || value === 1 || value === "1" || String(value).toLocaleLowerCase("en-US") === "true";
}

export function classifySerpResult(input) {
  const explicitPageType = String(input.pageType ?? "").toLocaleUpperCase("en-US");
  if (explicitPageType && !PAGE_TYPES.has(explicitPageType)) throw new Error(`Unsupported SERP page type: ${explicitPageType}`);
  const url = webUrl(input.url);
  const domain = url.hostname.toLocaleLowerCase("en-US");
  const text = `${url.pathname} ${cleanText(input.title, 300)}`.toLocaleLowerCase("ru");
  const mime = String(input.mimeType ?? "").toLocaleLowerCase("en-US");
  const explicitSiteClass = String(input.siteClass ?? "").toLocaleUpperCase("en-US");
  if (explicitSiteClass && !SITE_CLASSES.has(explicitSiteClass)) throw new Error(`Unsupported SERP site class: ${explicitSiteClass}`);

  let siteClass = explicitSiteClass || "OTHER";
  if (!explicitSiteClass) {
    if (domain === "7tool.ru" || domain.endsWith(".7tool.ru")) siteClass = "OWNED";
    else if (VIDEO_DOMAINS.has(domain)) siteClass = "VIDEO_PLATFORM";
    else if (/forum|форум/u.test(text)) siteClass = "FORUM";
  }

  let pageType = explicitPageType;
  if (!pageType) {
    if (mime.includes("pdf") || /\.pdf$/iu.test(url.pathname)) pageType = "PDF_MANUAL";
    else if (siteClass === "MARKETPLACE") pageType = "MARKETPLACE";
    else if (siteClass === "MANUFACTURER") pageType = "MANUFACTURER";
    else if (siteClass === "VIDEO_PLATFORM" || /(?:^|[\s/_-])video|видео/iu.test(text)) pageType = "VIDEO";
    else if (siteClass === "FORUM" || /forum|форум/iu.test(text)) pageType = "FORUM";
    else if (/calculator|калькулятор|расчет|расчёт/iu.test(text)) pageType = "CALCULATOR";
    else if (/table|таблиц/iu.test(text)) pageType = "TABLE";
    else if (/\/products?\/|\/p\/|карточк[аи]? товар/iu.test(text)) pageType = "PRODUCT";
    else if (/\/catalog(?:\/|$)|\/categor(?:y|ies)\/|\/c\/|каталог|категори/iu.test(text)) pageType = "CATEGORY";
    else if (/\/blog\/|\/articles?\/|\/guide\/|стать|обзор|инструкц/iu.test(text)) pageType = "ARTICLE";
    else pageType = "OTHER";
  }
  return { url: url.toString(), domain, pageType, siteClass };
}

export function registerSerpSourceCandidate(db, input) {
  const engine = String(input.engine ?? "").toLocaleUpperCase("en-US");
  if (!new Set(["GOOGLE", "YANDEX", "OTHER"]).has(engine)) throw new Error("SERP engine must be GOOGLE, YANDEX or OTHER");
  const provider = cleanText(input.provider, 200);
  const discoverySource = cleanText(input.discoverySource, 300);
  if (!provider || !discoverySource) throw new Error("SERP source provider and discoverySource are required");
  const url = webUrl(input.baseUrl, "SERP source URL");
  const baseUrl = `${url.protocol}//${url.host}`;
  const id = input.id ?? `serp-source-${hash(`${engine}\u0000${baseUrl}`).slice(0, 20)}`;
  const now = Date.now();
  db.prepare(`
    INSERT INTO serp_source_candidates (
      id, provider, engine, base_url, discovery_source, acquisition_method,
      terms_status, robots_status, status, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'DISCOVERED', ?, ?, ?)
    ON CONFLICT(engine, base_url) DO UPDATE SET provider = excluded.provider,
      discovery_source = excluded.discovery_source, acquisition_method = excluded.acquisition_method,
      terms_status = excluded.terms_status, robots_status = excluded.robots_status,
      status = CASE WHEN
        serp_source_candidates.acquisition_method = excluded.acquisition_method AND
        serp_source_candidates.terms_status = excluded.terms_status AND
        serp_source_candidates.robots_status = excluded.robots_status
        THEN serp_source_candidates.status ELSE 'DISCOVERED' END,
      reviewed_by = CASE WHEN
        serp_source_candidates.acquisition_method = excluded.acquisition_method AND
        serp_source_candidates.terms_status = excluded.terms_status AND
        serp_source_candidates.robots_status = excluded.robots_status
        THEN serp_source_candidates.reviewed_by ELSE NULL END,
      reviewed_at = CASE WHEN
        serp_source_candidates.acquisition_method = excluded.acquisition_method AND
        serp_source_candidates.terms_status = excluded.terms_status AND
        serp_source_candidates.robots_status = excluded.robots_status
        THEN serp_source_candidates.reviewed_at ELSE NULL END,
      notes = excluded.notes, updated_at = excluded.updated_at
  `).run(id, provider, engine, baseUrl, discoverySource,
    input.acquisitionMethod ?? "NONE", input.termsStatus ?? "REVIEW_REQUIRED",
    input.robotsStatus ?? "UNKNOWN", input.notes ?? null, now, now);
  return db.prepare("SELECT * FROM serp_source_candidates WHERE engine = ? AND base_url = ?").get(engine, baseUrl);
}

export function approveSerpSourceCandidate(db, input) {
  if (!input.reviewedBy) throw new Error("SERP source approval requires a real reviewer");
  const now = Date.now();
  const result = db.prepare(`
    UPDATE serp_source_candidates SET acquisition_method = ?, terms_status = 'ALLOWED',
      robots_status = ?, status = 'APPROVED', reviewed_by = ?, reviewed_at = ?, updated_at = ?
    WHERE id = ?
  `).run(input.acquisitionMethod, input.robotsStatus, input.reviewedBy, now, now, input.id);
  if (!result.changes) throw new Error("SERP source candidate not found");
}

function prepareResults(rows, topN) {
  if (!Array.isArray(rows) || !rows.length || rows.length > 20) throw new Error("SERP snapshot requires 1–20 results");
  const positions = new Set();
  const urls = new Set();
  return rows.map((row) => {
    const position = Number(row.position);
    if (!Number.isInteger(position) || position < 1 || position > topN) throw new Error(`Invalid SERP position: ${row.position}`);
    if (positions.has(position)) throw new Error(`Duplicate SERP position: ${position}`);
    positions.add(position);
    const classified = classifySerpResult(row);
    if (urls.has(classified.url)) throw new Error(`Duplicate SERP URL: ${classified.url}`);
    urls.add(classified.url);
    return {
      ...classified, position, title: cleanText(row.title, 300) || null,
      mimeType: cleanText(row.mimeType, 100) || null,
      hasTable: bool(row.hasTable), hasCalculator: bool(row.hasCalculator),
      hasVideo: bool(row.hasVideo), hasFaq: bool(row.hasFaq),
    };
  }).sort((left, right) => left.position - right.position);
}

function prepareInsights(rows) {
  if (!rows) return [];
  if (!Array.isArray(rows) || rows.length > 200) throw new Error("SERP insights must be an array with at most 200 rows");
  return rows.map((row) => {
    const insightType = String(row.insightType ?? "").toLocaleUpperCase("en-US");
    if (!INSIGHT_TYPES.has(insightType)) throw new Error(`Unsupported competitor insight type: ${insightType}`);
    const summary = cleanText(row.summary, 500);
    if (!summary) throw new Error("Competitor insight summary is required");
    const severity = row.severity == null ? 50 : Number(row.severity);
    if (!Number.isInteger(severity) || severity < 0 || severity > 100) throw new Error(`Invalid competitor insight severity: ${row.severity}`);
    const evidenceUrl = row.evidenceUrl ? webUrl(row.evidenceUrl, "Competitor evidence URL").toString() : null;
    const resultPosition = row.resultPosition == null ? null : Number(row.resultPosition);
    if (resultPosition !== null && (!Number.isInteger(resultPosition) || resultPosition < 1 || resultPosition > 20)) {
      throw new Error(`Invalid competitor insight result position: ${row.resultPosition}`);
    }
    return { insightType, summary, severity, evidenceUrl, resultPosition };
  });
}

export function importSerpSnapshot(db, input) {
  const engine = String(input.engine ?? "").toLocaleUpperCase("en-US");
  const candidate = db.prepare(`
    SELECT * FROM serp_source_candidates WHERE id = ? AND status = 'APPROVED'
      AND terms_status = 'ALLOWED' AND robots_status IN ('ALLOWED', 'NOT_APPLICABLE')
  `).get(input.sourceCandidateId);
  if (!candidate) throw new Error("SERP source must pass recorded human approval before import");
  if (candidate.engine !== engine || candidate.acquisition_method !== input.acquisitionMethod) {
    throw new Error("SERP import does not match the approved engine or acquisition method");
  }
  const query = cleanText(input.query, 400);
  const normalizedQuery = normalizeKeyword(query);
  if (!normalizedQuery) throw new Error("SERP query is required");
  const semanticLink = db.prepare(`
    SELECT 1 FROM seo_keywords WHERE cluster_id = ? AND intent_id = ? LIMIT 1
  `).get(input.clusterId, input.intentId);
  if (!semanticLink) throw new Error("SERP snapshot must reference a matching semantic cluster and intent");
  const device = String(input.device ?? "DESKTOP").toLocaleUpperCase("en-US");
  if (!new Set(["DESKTOP", "MOBILE"]).has(device)) throw new Error("SERP device must be DESKTOP or MOBILE");
  const capturedAt = asTimestamp(input.capturedAt, "capturedAt");
  if (!Array.isArray(input.results) || !input.results.length) throw new Error("SERP snapshot requires results");
  const topN = input.topN == null ? Math.max(...input.results.map((row) => Number(row.position))) : Number(input.topN);
  if (!Number.isInteger(topN) || topN < 1 || topN > 20) throw new Error("SERP topN must be between 1 and 20");
  const results = prepareResults(input.results, topN);
  const insights = prepareInsights(input.insights);
  for (const insight of insights) {
    if (insight.resultPosition !== null && !results.some((result) => result.position === insight.resultPosition)) {
      throw new Error(`Competitor insight references missing result position: ${insight.resultPosition}`);
    }
  }
  const checksumPayload = {
    engine, query: normalizedQuery, region: input.region ?? "RU", language: input.language ?? "ru",
    device, clusterId: input.clusterId, intentId: input.intentId, capturedAt, results, insights,
  };
  const inputChecksum = hash(JSON.stringify(checksumPayload));
  const duplicate = db.prepare(`
    SELECT id FROM serp_snapshots WHERE source_candidate_id = ? AND input_checksum = ?
  `).get(candidate.id, inputChecksum);
  if (duplicate) return { snapshotId: duplicate.id, duplicate: true, resultCount: results.length, insightCount: insights.length, inputChecksum };

  const now = Date.now();
  const sourceId = `serp-${hash(candidate.id).slice(0, 20)}`;
  const runId = randomUUID();
  const snapshotId = randomUUID();
  db.transaction(() => {
    db.prepare(`
      INSERT INTO sources (id, source_type, name, base_url, rights_policy, active, created_at, updated_at)
      VALUES (?, 'SERP', ?, ?, 'RESEARCH_ONLY', 1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, base_url = excluded.base_url,
        rights_policy = 'RESEARCH_ONLY', active = 1, updated_at = excluded.updated_at
    `).run(sourceId, `${candidate.provider} ${candidate.engine}`, candidate.base_url, now, now);
    db.prepare(`
      INSERT INTO import_runs (id, source_id, started_at, completed_at, status, input_checksum,
        record_count, rejected_count, parser_version, schema_version)
      VALUES (?, ?, ?, ?, 'SUCCEEDED', ?, ?, 0, ?, 'serp-snapshot-v1')
    `).run(runId, sourceId, now, now, inputChecksum, results.length, input.parserVersion ?? "serp-import-v1");
    db.prepare(`
      INSERT INTO serp_snapshots (
        id, source_candidate_id, source_id, import_run_id, engine, query, normalized_query,
        region, language, device, cluster_id, intent_id, captured_at, top_n, result_count,
        input_checksum, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
    `).run(snapshotId, candidate.id, sourceId, runId, engine, query, normalizedQuery,
      input.region ?? "RU", input.language ?? "ru", device, input.clusterId, input.intentId,
      capturedAt, topN, results.length, inputChecksum, now, now);
    const insertResult = db.prepare(`
      INSERT INTO serp_results (
        id, snapshot_id, position, url, domain, title, page_type, site_class, mime_type,
        has_table, has_calculator, has_video, has_faq, checksum, rights_status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'RESEARCH_ONLY', ?)
    `);
    const resultIds = new Map();
    for (const result of results) {
      const id = randomUUID();
      resultIds.set(result.position, id);
      insertResult.run(id, snapshotId, result.position, result.url, result.domain, result.title,
        result.pageType, result.siteClass, result.mimeType, Number(result.hasTable),
        Number(result.hasCalculator), Number(result.hasVideo), Number(result.hasFaq),
        hash(`${result.position}\u0000${result.url}\u0000${result.pageType}`), now);
    }
    const insertInsight = db.prepare(`
      INSERT INTO serp_competitor_insights (
        id, snapshot_id, result_id, insight_type, summary, evidence_url, severity,
        checksum, rights_status, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'RESEARCH_ONLY', 'PROPOSED', ?, ?)
    `);
    for (const insight of insights) {
      const checksum = hash(`${insight.insightType}\u0000${insight.summary}\u0000${insight.evidenceUrl ?? ""}`);
      insertInsight.run(randomUUID(), snapshotId, insight.resultPosition === null ? null : resultIds.get(insight.resultPosition),
        insight.insightType, insight.summary, insight.evidenceUrl, insight.severity, checksum, now, now);
    }
  })();
  return { snapshotId, runId, sourceId, duplicate: false, resultCount: results.length, insightCount: insights.length, inputChecksum };
}

export function scoreDifferentiation(signals, weightOverrides = {}) {
  const weights = { ...DIFFERENTIATION_WEIGHTS };
  for (const [key, value] of Object.entries(weightOverrides)) {
    if (!(key in weights)) throw new Error(`Unsupported differentiation weight: ${key}`);
    if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error(`Invalid differentiation weight: ${key}`);
    weights[key] = value;
  }
  const selected = Array.isArray(signals)
    ? new Set(signals.map((value) => String(value).toLocaleUpperCase("en-US")))
    : new Set(Object.entries(signals ?? {}).filter(([, enabled]) => bool(enabled)).map(([key]) => key.toLocaleUpperCase("en-US")));
  for (const signal of selected) if (!(signal in weights)) throw new Error(`Unsupported differentiation signal: ${signal}`);
  const totalWeight = Object.values(weights).reduce((sum, value) => sum + value, 0);
  const earnedWeight = [...selected].reduce((sum, key) => sum + weights[key], 0);
  const score = totalWeight ? Math.round((earnedWeight / totalWeight) * 100) : 0;
  return { score, selected: [...selected].sort(), weights, earnedWeight, totalWeight, modelVersion: DIFFERENTIATION_MODEL_VERSION };
}

function recommendedPageType(dominantType) {
  if (dominantType === "PRODUCT") return "PRODUCT_ENRICHMENT";
  if (["CATEGORY", "MARKETPLACE", "ECOMMERCE"].includes(dominantType)) return "CATEGORY_ENRICHMENT";
  if (dominantType === "ARTICLE") return "ARTICLE_CANDIDATE";
  if (dominantType === "CALCULATOR") return "CALCULATOR";
  if (dominantType === "VIDEO") return "VIDEO";
  if (dominantType === "TABLE") return "TABLE_REFERENCE";
  return "HUMAN_REVIEW";
}

export function createSerpAssessment(db, input) {
  const snapshotIds = [...new Set(input.snapshotIds ?? [])];
  if (snapshotIds.length !== 2) throw new Error("SERP assessment requires exactly one current Google and one current Yandex snapshot");
  const placeholders = snapshotIds.map(() => "?").join(", ");
  const snapshots = db.prepare(`
    SELECT * FROM serp_snapshots WHERE id IN (${placeholders}) AND status = 'ACTIVE'
  `).all(...snapshotIds);
  if (snapshots.length !== snapshotIds.length) throw new Error("SERP assessment snapshot is missing or inactive");
  const engines = new Set(snapshots.map((row) => row.engine));
  if (!engines.has("GOOGLE") || !engines.has("YANDEX") || engines.size !== 2) {
    throw new Error("SERP assessment requires both Google and Yandex snapshots");
  }
  const comparableFields = ["cluster_id", "intent_id", "normalized_query", "region", "language", "device"];
  for (const field of comparableFields) {
    if (new Set(snapshots.map((row) => row[field])).size !== 1) throw new Error(`SERP snapshots must have matching ${field}`);
  }
  const maxAgeDays = input.maxAgeDays ?? 30;
  if (!Number.isInteger(maxAgeDays) || maxAgeDays < 1 || maxAgeDays > 90) throw new Error("maxAgeDays must be between 1 and 90");
  const freshnessBoundary = Date.now() - maxAgeDays * 86_400_000;
  if (snapshots.some((row) => row.captured_at < freshnessBoundary)) throw new Error("SERP assessment requires current snapshots");

  const results = db.prepare(`
    SELECT snapshot_id, page_type, site_class FROM serp_results
    WHERE snapshot_id IN (${placeholders}) ORDER BY snapshot_id, position
  `).all(...snapshotIds);
  const distribution = {};
  let sampleSize = 0;
  let commercialDensity = 0;
  let marketplaceShare = 0;
  for (const snapshot of snapshots) {
    const engineResults = results.filter((row) => row.snapshot_id === snapshot.id);
    if (!engineResults.length) throw new Error(`SERP snapshot ${snapshot.id} has no results`);
    sampleSize += engineResults.length;
    for (const result of engineResults) {
      const weight = 1 / snapshots.length / engineResults.length;
      distribution[result.page_type] = (distribution[result.page_type] ?? 0) + weight;
      if (["PRODUCT", "CATEGORY", "MARKETPLACE", "ECOMMERCE"].includes(result.page_type)) commercialDensity += weight;
      if (result.site_class === "MARKETPLACE" || result.page_type === "MARKETPLACE") marketplaceShare += weight;
    }
  }
  commercialDensity = Math.min(1, commercialDensity);
  marketplaceShare = Math.min(1, marketplaceShare);
  const ranked = Object.entries(distribution).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  const [first, second] = ranked;
  const dominantType = !first || first[1] < 0.4 || (second && first[1] - second[1] < 0.05) ? "MIXED" : first[0];
  const dominantShare = Math.min(1, first?.[1] ?? 0);
  const insightRows = db.prepare(`
    SELECT insight_type, severity FROM serp_competitor_insights
    WHERE snapshot_id IN (${placeholders}) AND status != 'REJECTED'
  `).all(...snapshotIds);
  const gaps = insightRows.filter((row) => row.insight_type !== "COVERED_TOPIC");
  const avgSeverity = gaps.length ? gaps.reduce((sum, row) => sum + row.severity, 0) / gaps.length : 0;
  const gapBreadth = new Set(gaps.map((row) => row.insight_type)).size / 7;
  const contentGapScore = Math.round(avgSeverity * 0.7 + gapBreadth * 100 * 0.3);
  const differentiation = scoreDifferentiation(input.differentiationSignals, input.weightOverrides);
  let pageType = recommendedPageType(dominantType);
  let recommendation = pageType === "HUMAN_REVIEW" ? "HUMAN_REVIEW" : "KEEP_FOR_OPPORTUNITY_REVIEW";
  if (!differentiation.score) {
    pageType = "REJECT";
    recommendation = "REJECT";
  }
  const rationale = recommendation === "REJECT"
    ? "No approved differentiation signal beyond the current Google/Yandex result set."
    : `Balanced Google/Yandex evidence suggests ${dominantType} (${Math.round(dominantShare * 100)}% weighted share); no page or URL is created in PHASE 7.`;
  const assessmentChecksum = hash(JSON.stringify({
    snapshotIds: [...snapshotIds].sort(), differentiation,
    scoreModelVersion: DIFFERENTIATION_MODEL_VERSION,
  }));
  const duplicate = db.prepare("SELECT * FROM serp_assessments WHERE assessment_checksum = ?").get(assessmentChecksum);
  if (duplicate) return duplicate;
  const now = Date.now();
  const assessmentId = randomUUID();
  db.transaction(() => {
    db.prepare(`
      INSERT INTO serp_assessments (
        id, cluster_id, intent_id, dominant_serp_type, dominant_share, sample_size,
        distribution_json, commercial_density, marketplace_share, content_gap_score,
        differentiation_score, differentiation_signals_json, score_model_version,
        assessment_checksum, recommended_page_type, recommendation, rationale, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PROPOSED', ?, ?)
    `).run(assessmentId, snapshots[0].cluster_id, snapshots[0].intent_id, dominantType,
      dominantShare, sampleSize, JSON.stringify(distribution), commercialDensity, marketplaceShare,
      contentGapScore, differentiation.score, JSON.stringify(differentiation), differentiation.modelVersion,
      assessmentChecksum, pageType, recommendation, rationale, now, now);
    const link = db.prepare("INSERT INTO serp_assessment_snapshots (assessment_id, snapshot_id) VALUES (?, ?)");
    for (const snapshotId of snapshotIds) link.run(assessmentId, snapshotId);
  })();
  return db.prepare("SELECT * FROM serp_assessments WHERE id = ?").get(assessmentId);
}

export function reviewSerpAssessment(db, input) {
  if (!input.reviewedBy) throw new Error("SERP assessment review requires a real reviewer");
  if (!new Set(["APPROVE", "REJECT"]).has(input.decision)) throw new Error("SERP assessment decision must be APPROVE or REJECT");
  const assessment = db.prepare(`
    SELECT a.*, i.status AS intent_status FROM serp_assessments a
    JOIN search_intents i ON i.id = a.intent_id WHERE a.id = ?
  `).get(input.assessmentId);
  if (!assessment) throw new Error("SERP assessment not found");
  if (assessment.status !== "PROPOSED") throw new Error("SERP assessment was already reviewed");
  if (["MERGED", "REJECTED"].includes(assessment.intent_status)) throw new Error("Cannot approve SERP evidence for an inactive intent");
  const engineCount = db.prepare(`
    SELECT COUNT(DISTINCT s.engine) AS count FROM serp_assessment_snapshots x
    JOIN serp_snapshots s ON s.id = x.snapshot_id
    WHERE x.assessment_id = ? AND s.engine IN ('GOOGLE', 'YANDEX')
  `).get(input.assessmentId).count;
  if (engineCount !== 2) throw new Error("SERP assessment lost required Google/Yandex evidence");
  const now = Date.now();
  db.transaction(() => {
    db.prepare(`
      UPDATE serp_assessments SET status = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?
    `).run(input.decision === "APPROVE" ? "REVIEWED" : "REJECTED", input.reviewedBy, now, now, input.assessmentId);
    if (input.decision === "APPROVE") {
      db.prepare("UPDATE search_intents SET dominant_serp_type = ?, updated_at = ? WHERE id = ?")
        .run(assessment.dominant_serp_type, now, assessment.intent_id);
    }
  })();
}

export function listCompetitorDomainCoverage(db, intentId) {
  return db.prepare(`
    SELECT r.domain, r.site_class, r.page_type, COUNT(*) AS appearances,
      ROUND(AVG(r.position), 2) AS average_position,
      COUNT(DISTINCT s.engine) AS engines
    FROM serp_results r JOIN serp_snapshots s ON s.id = r.snapshot_id
    WHERE s.intent_id = ? AND s.status = 'ACTIVE' AND r.site_class != 'OWNED'
    GROUP BY r.domain, r.site_class, r.page_type
    ORDER BY engines DESC, appearances DESC, average_position, r.domain
  `).all(intentId);
}
