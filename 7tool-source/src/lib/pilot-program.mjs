import { createHash } from "node:crypto";

export const PILOT_MODEL_VERSION = "phase19-pilot-v1";
export const PILOT_CANDIDATE_LIMIT = 500;
export const PILOT_TOP_LIMIT = 20;

export const PILOT_CATEGORIES = Object.freeze([
  Object.freeze({ slug: "stanki-sverlilnye", title: "Магнитные сверлильные станки" }),
  Object.freeze({ slug: "koronchatye-sverla", title: "Корончатые сверла" }),
  Object.freeze({ slug: "kromkorezy-po-listu", title: "Кромкорезы" }),
  Object.freeze({ slug: "truborezy", title: "Труборезы" }),
  Object.freeze({ slug: "borfrezy", title: "Борфрезы" }),
]);

export const PILOT_CONTENT_MIX = Object.freeze([
  Object.freeze({ ordinal: 1, slotType: "ARTICLE" }),
  Object.freeze({ ordinal: 2, slotType: "ARTICLE" }),
  Object.freeze({ ordinal: 3, slotType: "TROUBLESHOOTING" }),
  Object.freeze({ ordinal: 4, slotType: "COMPARISON_TABLE" }),
  Object.freeze({ ordinal: 5, slotType: "PRODUCT_CATEGORY_ENHANCEMENT" }),
]);

const SPECIALIZED_SLOT_ORDER = Object.freeze([
  "TROUBLESHOOTING", "COMPARISON_TABLE", "PRODUCT_CATEGORY_ENHANCEMENT", "ARTICLE", "ARTICLE",
]);

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonical(value) {
  return JSON.stringify(value);
}

function cleanText(value, name, maximum = 300) {
  const text = String(value ?? "").trim();
  if (!text || text.length > maximum) throw new Error(`${name} is required and must be at most ${maximum} characters`);
  return text;
}

function pilotId(value) {
  const id = cleanText(value || "phase19-pilot", "pilotId", 100);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error("pilotId must be a lowercase kebab-case identifier");
  return id;
}

function positiveTimestamp(value, name) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) throw new Error(`${name} must be a positive integer timestamp`);
  return number;
}

function dateOnly(value, name) {
  const text = cleanText(value, name, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00.000Z`))) {
    throw new Error(`${name} must be an ISO date`);
  }
  return text;
}

function normalizePeriod(input) {
  const periodStart = dateOnly(input.periodStart, "periodStart");
  const periodEnd = dateOnly(input.periodEnd, "periodEnd");
  if (periodEnd < periodStart) throw new Error("periodEnd must not precede periodStart");
  return { periodStart, periodEnd };
}

function requireTables(db, names) {
  const statement = db.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = ?");
  const missing = names.filter((name) => !statement.get(name));
  if (missing.length) throw new Error(`Required pilot schema is missing: ${missing.join(", ")}`);
}

function programConfiguration(id) {
  return {
    id,
    name: "Phase 19 — 5-category SEO pilot",
    modelVersion: PILOT_MODEL_VERSION,
    categoryLimit: PILOT_CATEGORIES.length,
    candidateLimitPerCategory: PILOT_CANDIDATE_LIMIT,
    topLimitPerCategory: PILOT_TOP_LIMIT,
    contentItemsPerCategory: PILOT_CONTENT_MIX.length,
    categories: PILOT_CATEGORIES.map((category, index) => ({
      ...category, ordinal: index + 1, baselinePath: `/c/${category.slug}`,
    })),
  };
}

function contentPreference(slotType, opportunity) {
  const pageType = opportunity.recommendedPageType;
  if (slotType === "TROUBLESHOOTING") return pageType === "TROUBLESHOOTING" ? 100 : 0;
  if (slotType === "COMPARISON_TABLE") {
    if (pageType === "COMPARISON") return 100;
    if (pageType === "TABLE") return 95;
    return 0;
  }
  if (slotType === "PRODUCT_CATEGORY_ENHANCEMENT") {
    if (!opportunity.targetUrlId || !new Set(["UPDATE", "MERGE"]).has(opportunity.decision)) return 0;
    if (pageType === "CATEGORY_ENRICHMENT") return 100;
    if (pageType === "PRODUCT_ENRICHMENT") return 95;
    return 0;
  }
  const articleTypes = new Map([
    ["PILLAR_GUIDE", 100], ["HOW_TO", 95], ["CASE_STUDY", 90], ["TEST", 85],
    ["REFERENCE", 80], ["FAQ", 75], ["COMPATIBILITY", 70], ["VIDEO", 60],
  ]);
  return articleTypes.get(pageType) ?? 0;
}

function chooseWorkItems(topOpportunities) {
  const available = [...topOpportunities];
  const selected = new Set();
  const assignments = [];
  const pendingSlots = PILOT_CONTENT_MIX.map((slot) => ({ ...slot }));

  for (const slotType of SPECIALIZED_SLOT_ORDER) {
    const slot = pendingSlots.find((candidate) => candidate.slotType === slotType && !assignments.some((item) => item.ordinal === candidate.ordinal));
    if (!slot) continue;
    const best = available
      .filter((opportunity) => !selected.has(opportunity.id))
      .map((opportunity) => ({ opportunity, preference: contentPreference(slotType, opportunity) }))
      .filter((candidate) => candidate.preference > 0)
      .sort((left, right) => right.preference - left.preference || left.opportunity.topRank - right.opportunity.topRank)[0];
    if (!best) continue;
    selected.add(best.opportunity.id);
    assignments.push({
      ...slot,
      opportunityId: best.opportunity.id,
      topRank: best.opportunity.topRank,
      recommendedAction: best.opportunity.decision,
      targetUrlId: best.opportunity.targetUrlId,
      topic: best.opportunity.topic,
    });
  }
  return assignments.sort((left, right) => left.ordinal - right.ordinal);
}

function candidateRows(db, categorySlug) {
  const count = db.prepare(`
    SELECT COUNT(*) AS count FROM content_opportunities
    WHERE category_slug = ? AND status IN ('PROPOSED', 'REVIEWED')
      AND decision IN ('CREATE', 'UPDATE', 'MERGE')
  `).get(categorySlug).count;
  const rows = db.prepare(`
    SELECT id, topic, category_slug, recommended_page_type, recommended_url_id,
      decision, opportunity_score, status, evaluation_checksum
    FROM content_opportunities
    WHERE category_slug = ? AND status IN ('PROPOSED', 'REVIEWED')
      AND decision IN ('CREATE', 'UPDATE', 'MERGE')
    ORDER BY
      CASE decision WHEN 'UPDATE' THEN 0 WHEN 'MERGE' THEN 1 ELSE 2 END,
      opportunity_score DESC, topic COLLATE NOCASE, id
    LIMIT ?
  `).all(categorySlug, PILOT_CANDIDATE_LIMIT);
  return {
    count,
    candidates: rows.map((row, index) => ({
      id: row.id,
      categorySlug: row.category_slug,
      candidateRank: index + 1,
      topRank: index < PILOT_TOP_LIMIT ? index + 1 : null,
      opportunityScore: row.opportunity_score,
      status: row.status,
      decision: row.decision,
      recommendedPageType: row.recommended_page_type,
      targetUrlId: row.recommended_url_id,
      topic: row.topic,
      evaluationChecksum: row.evaluation_checksum,
    })),
  };
}

export function evaluatePilotPlan(db, rawInput = {}) {
  requireTables(db, ["categories", "content_opportunities"]);
  const id = pilotId(rawInput.pilotId);
  const config = programConfiguration(id);
  const categoryLookup = db.prepare("SELECT slug FROM categories WHERE slug = ?");
  const blockers = [];
  const categories = config.categories.map((category) => {
    if (!categoryLookup.get(category.slug)) blockers.push(`${category.slug}: category is missing from the catalog database`);
    const source = candidateRows(db, category.slug);
    const topOpportunities = source.candidates.filter((opportunity) => opportunity.topRank !== null);
    const workItems = chooseWorkItems(topOpportunities);
    if (topOpportunities.length !== PILOT_TOP_LIMIT) {
      blockers.push(`${category.slug}: expected Top ${PILOT_TOP_LIMIT}, found ${topOpportunities.length}`);
    }
    for (const slot of PILOT_CONTENT_MIX) {
      if (!workItems.some((item) => item.ordinal === slot.ordinal)) {
        blockers.push(`${category.slug}: no eligible Top 20 opportunity for ${slot.slotType} slot ${slot.ordinal}`);
      }
    }
    return {
      ...category,
      sourceOpportunityCount: source.count,
      candidates: source.candidates,
      topOpportunities,
      workItems,
    };
  });
  const selectedCandidates = categories.reduce((sum, category) => sum + category.candidates.length, 0);
  const selectedTop = categories.reduce((sum, category) => sum + category.topOpportunities.length, 0);
  const plannedContent = categories.reduce((sum, category) => sum + category.workItems.length, 0);
  const sourceOpportunities = categories.reduce((sum, category) => sum + category.sourceOpportunityCount, 0);
  const evidence = {
    pilotId: id,
    modelVersion: PILOT_MODEL_VERSION,
    categories: categories.map((category) => ({
      slug: category.slug,
      candidates: category.candidates.map((candidate) => ({
        id: candidate.id,
        candidateRank: candidate.candidateRank,
        topRank: candidate.topRank,
        score: candidate.opportunityScore,
        status: candidate.status,
        decision: candidate.decision,
        recommendedPageType: candidate.recommendedPageType,
        targetUrlId: candidate.targetUrlId,
        topic: candidate.topic,
        evaluationChecksum: candidate.evaluationChecksum,
      })),
      workItems: category.workItems.map((item) => ({
        ordinal: item.ordinal, slotType: item.slotType, opportunityId: item.opportunityId,
        topRank: item.topRank, recommendedAction: item.recommendedAction, targetUrlId: item.targetUrlId,
      })),
    })),
  };
  return {
    pilot: config,
    categories,
    sourceOpportunityCount: sourceOpportunities,
    selectedCandidateCount: selectedCandidates,
    selectedTopCount: selectedTop,
    plannedContentCount: plannedContent,
    blockers,
    ready: blockers.length === 0 && selectedTop === 100 && plannedContent === 25,
    selectionChecksum: hash(canonical(evidence)),
  };
}

export function materializePilotPlan(db, rawInput = {}) {
  requireTables(db, [
    "pilot_programs", "pilot_categories", "pilot_selection_runs",
    "pilot_opportunity_selections", "pilot_content_work_items",
  ]);
  const evaluation = evaluatePilotPlan(db, rawInput);
  if (!evaluation.ready) throw new Error(`Pilot plan is not ready: ${evaluation.blockers.join("; ")}`);
  const createdBy = cleanText(rawInput.createdBy, "createdBy", 200);
  const evaluatedAt = rawInput.evaluatedAt == null ? Date.now() : positiveTimestamp(rawInput.evaluatedAt, "evaluatedAt");
  const programChecksum = hash(canonical(evaluation.pilot));
  const selectionRunId = `pilot-selection-${evaluation.selectionChecksum.slice(0, 24)}`;

  return db.transaction(() => {
    db.prepare(`
      INSERT OR IGNORE INTO pilot_programs (
        id, name, model_version, category_limit, candidate_limit_per_category,
        top_limit_per_category, content_items_per_category, config_checksum,
        status, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, 5, 500, 20, 5, ?, 'REVIEW_REQUIRED', ?, ?, ?)
    `).run(
      evaluation.pilot.id, evaluation.pilot.name, PILOT_MODEL_VERSION,
      programChecksum, createdBy, evaluatedAt, evaluatedAt,
    );
    const program = db.prepare("SELECT * FROM pilot_programs WHERE id = ?").get(evaluation.pilot.id);
    if (!program || program.config_checksum !== programChecksum) throw new Error("Pilot program id already uses a different immutable configuration");

    const insertCategory = db.prepare(`
      INSERT OR IGNORE INTO pilot_categories (
        pilot_id, category_slug, category_title, category_ordinal, baseline_path, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const category of evaluation.categories) {
      insertCategory.run(evaluation.pilot.id, category.slug, category.title, category.ordinal, category.baselinePath, evaluatedAt);
    }
    const storedCategories = db.prepare("SELECT category_slug, category_ordinal FROM pilot_categories WHERE pilot_id = ? ORDER BY category_ordinal")
      .all(evaluation.pilot.id);
    const expectedCategories = evaluation.categories.map((category) => ({ category_slug: category.slug, category_ordinal: category.ordinal }));
    if (canonical(storedCategories) !== canonical(expectedCategories)) throw new Error("Stored pilot category scope differs from the fixed Phase 19 scope");

    const existingSelection = db.prepare("SELECT * FROM pilot_selection_runs WHERE selection_checksum = ?").get(evaluation.selectionChecksum);
    if (existingSelection) {
      if (existingSelection.pilot_id !== evaluation.pilot.id) throw new Error("Pilot selection checksum belongs to another program");
      return { ...evaluation, selectionRunId: existingSelection.id, duplicate: true, savedCandidates: 0, savedWorkItems: 0 };
    }
    if (program.status !== "REVIEW_REQUIRED") throw new Error("An approved or rejected pilot is immutable; create a new pilot id for a new selection");

    db.prepare(`
      INSERT INTO pilot_selection_runs (
        id, pilot_id, candidate_limit_per_category, top_limit_per_category,
        source_opportunity_count, selected_candidate_count, selected_top_count,
        planned_content_count, selection_checksum, model_version, status, evaluated_at
      ) VALUES (?, ?, 500, 20, ?, ?, ?, ?, ?, ?, 'REVIEW_REQUIRED', ?)
    `).run(
      selectionRunId, evaluation.pilot.id, evaluation.sourceOpportunityCount,
      evaluation.selectedCandidateCount, evaluation.selectedTopCount,
      evaluation.plannedContentCount, evaluation.selectionChecksum, PILOT_MODEL_VERSION, evaluatedAt,
    );

    const insertSelection = db.prepare(`
      INSERT INTO pilot_opportunity_selections (
        selection_run_id, pilot_id, category_slug, opportunity_id, candidate_rank,
        top_rank, opportunity_score, source_status, source_decision,
        recommended_page_type, topic, source_evaluation_checksum, selected_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertWorkItem = db.prepare(`
      INSERT INTO pilot_content_work_items (
        id, selection_run_id, pilot_id, category_slug, slot_ordinal, slot_type,
        opportunity_id, top_rank, recommended_action, target_url_id,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'REVIEW_REQUIRED', ?, ?)
    `);
    let savedCandidates = 0;
    let savedWorkItems = 0;
    for (const category of evaluation.categories) {
      for (const candidate of category.candidates) {
        savedCandidates += insertSelection.run(
          selectionRunId, evaluation.pilot.id, category.slug, candidate.id,
          candidate.candidateRank, candidate.topRank, candidate.opportunityScore,
          candidate.status, candidate.decision, candidate.recommendedPageType,
          candidate.topic, candidate.evaluationChecksum, evaluatedAt,
        ).changes;
      }
      for (const item of category.workItems) {
        const itemEvidence = hash(canonical({ selectionRunId, categorySlug: category.slug, ...item }));
        savedWorkItems += insertWorkItem.run(
          `pilot-item-${itemEvidence.slice(0, 26)}`, selectionRunId, evaluation.pilot.id,
          category.slug, item.ordinal, item.slotType, item.opportunityId, item.topRank,
          item.recommendedAction, item.targetUrlId, evaluatedAt, evaluatedAt,
        ).changes;
      }
    }
    return { ...evaluation, selectionRunId, duplicate: false, savedCandidates, savedWorkItems };
  })();
}

export function reviewPilotContentWorkItem(db, rawInput) {
  requireTables(db, ["pilot_content_work_items", "pilot_opportunity_selections", "content_opportunities"]);
  const itemId = cleanText(rawInput.itemId, "itemId", 100);
  const decision = cleanText(rawInput.decision, "decision", 20).toLocaleUpperCase("en");
  if (!new Set(["APPROVE", "REJECT"]).has(decision)) throw new Error("decision must be APPROVE or REJECT");
  const reviewedBy = cleanText(rawInput.reviewedBy, "reviewedBy", 200);
  const reviewedAt = rawInput.reviewedAt == null ? Date.now() : positiveTimestamp(rawInput.reviewedAt, "reviewedAt");
  const item = db.prepare(`
    SELECT wi.*, selection.source_evaluation_checksum,
      opportunity.evaluation_checksum AS current_evaluation_checksum,
      opportunity.status AS opportunity_status
    FROM pilot_content_work_items wi
    JOIN pilot_opportunity_selections selection
      ON selection.selection_run_id = wi.selection_run_id AND selection.opportunity_id = wi.opportunity_id
    JOIN content_opportunities opportunity ON opportunity.id = wi.opportunity_id
    WHERE wi.id = ?
  `).get(itemId);
  if (!item) throw new Error(`Unknown pilot content work item: ${itemId}`);
  const nextStatus = decision === "APPROVE" ? "APPROVED" : "REJECTED";
  if (item.status !== "REVIEW_REQUIRED") {
    if (item.status === nextStatus) return { ...item, duplicate: true };
    throw new Error("Pilot content work item already has a conflicting review decision");
  }
  if (item.source_evaluation_checksum !== item.current_evaluation_checksum) {
    throw new Error("Pilot work item is stale; rebuild the pilot selection before review");
  }
  if (decision === "APPROVE" && item.opportunity_status !== "REVIEWED") {
    throw new Error("Pilot work item approval requires a current human-reviewed content opportunity");
  }
  db.prepare(`
    UPDATE pilot_content_work_items
    SET status = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ?
    WHERE id = ? AND status = 'REVIEW_REQUIRED'
  `).run(nextStatus, reviewedBy, reviewedAt, reviewedAt, itemId);
  return { ...db.prepare("SELECT * FROM pilot_content_work_items WHERE id = ?").get(itemId), duplicate: false };
}

function latestSelectionRun(db, id, explicitSelectionRunId) {
  const selection = explicitSelectionRunId
    ? db.prepare("SELECT * FROM pilot_selection_runs WHERE id = ? AND pilot_id = ?").get(explicitSelectionRunId, id)
    : db.prepare("SELECT * FROM pilot_selection_runs WHERE pilot_id = ? ORDER BY evaluated_at DESC, id DESC LIMIT 1").get(id);
  if (!selection) throw new Error(`Pilot ${id} has no materialized selection run`);
  return selection;
}

export function reviewPilotProgram(db, rawInput) {
  requireTables(db, [
    "pilot_programs", "pilot_selection_runs", "pilot_opportunity_selections",
    "pilot_content_work_items", "content_opportunities",
  ]);
  const id = pilotId(rawInput.pilotId);
  const decision = cleanText(rawInput.decision, "decision", 20).toLocaleUpperCase("en");
  if (!new Set(["APPROVE", "REJECT"]).has(decision)) throw new Error("decision must be APPROVE or REJECT");
  const reviewedBy = cleanText(rawInput.reviewedBy, "reviewedBy", 200);
  const reviewedAt = rawInput.reviewedAt == null ? Date.now() : positiveTimestamp(rawInput.reviewedAt, "reviewedAt");
  const program = db.prepare("SELECT * FROM pilot_programs WHERE id = ?").get(id);
  if (!program) throw new Error(`Unknown pilot program: ${id}`);
  const nextStatus = decision === "APPROVE" ? "APPROVED" : "REJECTED";
  if (program.status !== "REVIEW_REQUIRED") {
    if (program.status === nextStatus) return { ...program, duplicate: true };
    throw new Error("Pilot program already has a conflicting review decision");
  }
  const selection = latestSelectionRun(db, id, rawInput.selectionRunId);
  if (decision === "APPROVE") {
    const counts = db.prepare(`
      SELECT COUNT(*) AS total,
        SUM(CASE WHEN work.status = 'APPROVED' THEN 1 ELSE 0 END) AS approved,
        SUM(CASE WHEN opportunity.status != 'REVIEWED'
          OR opportunity.evaluation_checksum != selection.source_evaluation_checksum
          THEN 1 ELSE 0 END) AS stale
      FROM pilot_content_work_items work
      JOIN pilot_opportunity_selections selection
        ON selection.selection_run_id = work.selection_run_id
        AND selection.opportunity_id = work.opportunity_id
      JOIN content_opportunities opportunity ON opportunity.id = work.opportunity_id
      WHERE work.selection_run_id = ?
    `).get(selection.id);
    if (counts.total !== 25 || counts.approved !== 25) {
      throw new Error("Pilot approval requires all 25 content work items to be human-approved");
    }
    if (counts.stale !== 0) throw new Error("Pilot approval requires all 25 opportunity reviews to remain current");
  }
  db.prepare(`
    UPDATE pilot_programs SET status = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ?
    WHERE id = ? AND status = 'REVIEW_REQUIRED'
  `).run(nextStatus, reviewedBy, reviewedAt, reviewedAt, id);
  return { ...db.prepare("SELECT * FROM pilot_programs WHERE id = ?").get(id), selectionRunId: selection.id, duplicate: false };
}

function placeholders(values) {
  return values.map(() => "?").join(", ");
}

function trackedPathsByCategory(db, selectionRunId, id) {
  const categories = db.prepare(`
    SELECT category_slug, baseline_path FROM pilot_categories
    WHERE pilot_id = ? ORDER BY category_ordinal
  `).all(id);
  const result = new Map(categories.map((category) => [category.category_slug, new Set([category.baseline_path])]));
  const targets = db.prepare(`
    SELECT work.category_slug, url.path
    FROM pilot_content_work_items work
    JOIN site_urls url ON url.id = work.target_url_id
    WHERE work.selection_run_id = ?
  `).all(selectionRunId);
  for (const target of targets) result.get(target.category_slug)?.add(target.path);
  const assets = db.prepare(`
    SELECT work.category_slug, asset.canonical AS path
    FROM pilot_content_work_items work
    JOIN content_assets asset ON asset.opportunity_id = work.opportunity_id
    WHERE work.selection_run_id = ?
  `).all(selectionRunId);
  for (const asset of assets) result.get(asset.category_slug)?.add(asset.path);
  return result;
}

function latestSearchRuns(db, input, periodStart, periodEnd) {
  const propertyUri = cleanText(input.gscPropertyUri, "gscPropertyUri", 500);
  const yandexHostId = cleanText(input.yandexHostId, "yandexHostId", 300);
  const gsc = db.prepare(`
    SELECT * FROM gsc_import_runs
    WHERE property_uri = ? AND search_type = 'WEB' AND status = 'COMPLETE'
      AND period_start <= ? AND period_end >= ?
    ORDER BY imported_at DESC, id DESC LIMIT 1
  `).get(propertyUri, periodStart, periodEnd);
  if (!gsc) throw new Error("No complete Google Search Console WEB run covers the pilot KPI period");
  const yandex = db.prepare(`
    SELECT * FROM yandex_import_runs
    WHERE source_system = 'YANDEX_WEBMASTER' AND dataset_type = 'WEBMASTER_URL_QUERIES'
      AND subject_ref = ? AND status = 'COMPLETE'
      AND period_start <= ? AND period_end >= ?
    ORDER BY imported_at DESC, id DESC LIMIT 1
  `).get(yandexHostId, periodStart, periodEnd);
  if (!yandex) throw new Error("No complete Yandex Webmaster URL-query run covers the pilot KPI period");
  return { gsc, yandex };
}

function scopedKpi(db, paths, periodStart, periodEnd, runs) {
  const orderedPaths = [...new Set(paths)].sort();
  if (!orderedPaths.length) throw new Error("Pilot KPI scope has no tracked URLs");
  const pathSql = placeholders(orderedPaths);
  const registryRows = db.prepare(`SELECT path, index_status FROM site_urls WHERE path IN (${pathSql})`).all(...orderedPaths);
  const indexed = registryRows.filter((row) => row.index_status === "INDEX").length;

  const googleRows = db.prepare(`
    SELECT query_hash, impressions, clicks, average_position
    FROM gsc_search_performance_daily
    WHERE run_id = ? AND data_date BETWEEN ? AND ? AND page_path IN (${pathSql})
  `).all(runs.gsc.id, periodStart, periodEnd, ...orderedPaths);
  const yandexRows = db.prepare(`
    SELECT query_hash, impressions, clicks, average_position
    FROM yandex_webmaster_performance_daily
    WHERE run_id = ? AND data_date BETWEEN ? AND ? AND page_path IN (${pathSql})
  `).all(runs.yandex.id, periodStart, periodEnd, ...orderedPaths);
  const impressions = [...googleRows, ...yandexRows].reduce((sum, row) => sum + row.impressions, 0);
  const clicks = [...googleRows, ...yandexRows].reduce((sum, row) => sum + row.clicks, 0);
  const queryKeys = new Set([
    ...googleRows.map((row) => `GOOGLE:${row.query_hash}`),
    ...yandexRows.map((row) => `YANDEX:${row.query_hash}`),
  ]);
  const positioned = [...googleRows, ...yandexRows].filter((row) => row.average_position !== null && row.impressions > 0);
  const positionWeight = positioned.reduce((sum, row) => sum + row.impressions, 0);
  const averagePosition = positionWeight
    ? positioned.reduce((sum, row) => sum + row.average_position * row.impressions, 0) / positionWeight
    : null;

  const roiRows = db.prepare(`
    SELECT * FROM content_roi_snapshots
    WHERE period_start = ? AND period_end = ? AND page_path IN (${pathSql})
    ORDER BY page_path, evaluated_at DESC, id DESC
  `).all(periodStart, periodEnd, ...orderedPaths);
  const latestRoiByPath = new Map();
  for (const row of roiRows) if (!latestRoiByPath.has(row.page_path)) latestRoiByPath.set(row.page_path, row);
  const roi = [...latestRoiByPath.values()];
  const organicSessions = roi.reduce((sum, row) => sum + row.organic_sessions, 0);
  const productClicks = roi.reduce((sum, row) => sum + row.product_clicks, 0);
  const organicLeads = roi.reduce((sum, row) => sum + row.leads, 0);
  if (organicLeads > organicSessions) {
    throw new Error("Pilot KPI attribution is inconsistent: organic leads exceed organic sessions");
  }
  const revenueMinor = roi.reduce((sum, row) => sum + row.revenue_minor, 0);
  return {
    paths: orderedPaths,
    trackedUrlCount: orderedPaths.length,
    indexedUrlCount: indexed,
    indexationRate: indexed / orderedPaths.length,
    impressions,
    queryCount: queryKeys.size,
    clicks,
    ctr: impressions ? clicks / impressions : 0,
    averagePosition,
    organicSessions,
    productClicks,
    organicLeads,
    leadRate: organicSessions ? organicLeads / organicSessions : 0,
    revenueMinor,
    currency: "RUB",
    roiSnapshotIds: roi.map((row) => row.id).sort(),
  };
}

export function evaluatePilotKpis(db, rawInput) {
  requireTables(db, [
    "pilot_programs", "pilot_categories", "pilot_selection_runs", "pilot_content_work_items",
    "site_urls", "content_assets", "gsc_import_runs", "gsc_search_performance_daily",
    "yandex_import_runs", "yandex_webmaster_performance_daily", "content_roi_snapshots",
  ]);
  const id = pilotId(rawInput.pilotId);
  const { periodStart, periodEnd } = normalizePeriod(rawInput);
  const program = db.prepare("SELECT * FROM pilot_programs WHERE id = ?").get(id);
  if (!program) throw new Error(`Unknown pilot program: ${id}`);
  const selection = latestSelectionRun(db, id, rawInput.selectionRunId);
  const pathsByCategory = trackedPathsByCategory(db, selection.id, id);
  if (pathsByCategory.size !== 5) throw new Error("Pilot KPI requires the fixed five-category scope");
  const runs = latestSearchRuns(db, rawInput, periodStart, periodEnd);
  const scopes = [];
  for (const category of PILOT_CATEGORIES) {
    const metrics = scopedKpi(db, [...(pathsByCategory.get(category.slug) ?? [])], periodStart, periodEnd, runs);
    scopes.push({ scopeType: "CATEGORY", categorySlug: category.slug, ...metrics });
  }
  const allPaths = [...new Set([...pathsByCategory.values()].flatMap((paths) => [...paths]))];
  scopes.push({ scopeType: "PILOT", categorySlug: null, ...scopedKpi(db, allPaths, periodStart, periodEnd, runs) });
  return {
    pilotId: id,
    selectionRunId: selection.id,
    periodStart,
    periodEnd,
    sourceRuns: { gscRunId: runs.gsc.id, yandexWebmasterRunId: runs.yandex.id },
    modelVersion: PILOT_MODEL_VERSION,
    scopes,
  };
}

export function materializePilotKpis(db, rawInput) {
  requireTables(db, ["pilot_kpi_snapshots"]);
  const evaluation = evaluatePilotKpis(db, rawInput);
  const evaluatedAt = rawInput.evaluatedAt == null ? Date.now() : positiveTimestamp(rawInput.evaluatedAt, "evaluatedAt");
  return db.transaction(() => {
    const insert = db.prepare(`
      INSERT OR IGNORE INTO pilot_kpi_snapshots (
        id, pilot_id, selection_run_id, scope_type, category_slug, period_start, period_end,
        tracked_url_count, indexed_url_count, indexation_rate, impressions, query_count,
        clicks, ctr, average_position, organic_sessions, product_clicks, organic_leads,
        lead_rate, revenue_minor, currency, gsc_run_id, yandex_webmaster_run_id,
        source_roi_snapshot_ids_json, evidence_checksum, model_version, status, evaluated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'RUB', ?, ?, ?, ?, ?, 'REVIEW_REQUIRED', ?)
    `);
    let savedSnapshots = 0;
    for (const scope of evaluation.scopes) {
      const evidenceChecksum = hash(canonical({
        pilotId: evaluation.pilotId,
        selectionRunId: evaluation.selectionRunId,
        periodStart: evaluation.periodStart,
        periodEnd: evaluation.periodEnd,
        scope,
        sourceRuns: evaluation.sourceRuns,
        modelVersion: evaluation.modelVersion,
      }));
      savedSnapshots += insert.run(
        `pilot-kpi-${evidenceChecksum.slice(0, 26)}`, evaluation.pilotId,
        evaluation.selectionRunId, scope.scopeType, scope.categorySlug,
        evaluation.periodStart, evaluation.periodEnd, scope.trackedUrlCount,
        scope.indexedUrlCount, scope.indexationRate, scope.impressions,
        scope.queryCount, scope.clicks, scope.ctr, scope.averagePosition,
        scope.organicSessions, scope.productClicks, scope.organicLeads,
        scope.leadRate, scope.revenueMinor, evaluation.sourceRuns.gscRunId,
        evaluation.sourceRuns.yandexWebmasterRunId, canonical(scope.roiSnapshotIds),
        evidenceChecksum, evaluation.modelVersion, evaluatedAt,
      ).changes;
    }
    return { ...evaluation, savedSnapshots };
  })();
}

export function getPilotStatus(db, rawInput = {}) {
  requireTables(db, ["pilot_programs", "pilot_categories", "pilot_selection_runs", "pilot_content_work_items", "pilot_kpi_snapshots"]);
  const id = pilotId(rawInput.pilotId);
  const program = db.prepare("SELECT * FROM pilot_programs WHERE id = ?").get(id);
  if (!program) return null;
  const categories = db.prepare("SELECT * FROM pilot_categories WHERE pilot_id = ? ORDER BY category_ordinal").all(id);
  const selection = db.prepare("SELECT * FROM pilot_selection_runs WHERE pilot_id = ? ORDER BY evaluated_at DESC, id DESC LIMIT 1").get(id) ?? null;
  const workItemCounts = selection ? db.prepare(`
    SELECT status, COUNT(*) AS count FROM pilot_content_work_items
    WHERE selection_run_id = ? GROUP BY status ORDER BY status
  `).all(selection.id) : [];
  const latestKpis = db.prepare(`
    SELECT * FROM pilot_kpi_snapshots WHERE pilot_id = ?
    ORDER BY period_end DESC, evaluated_at DESC, scope_type, category_slug
  `).all(id);
  const seenScopes = new Set();
  const uniqueLatestKpis = latestKpis.filter((row) => {
    const key = `${row.scope_type}:${row.category_slug ?? ""}`;
    if (seenScopes.has(key)) return false;
    seenScopes.add(key);
    return true;
  });
  return { program, categories, selection, workItemCounts, latestKpis: uniqueLatestKpis };
}
