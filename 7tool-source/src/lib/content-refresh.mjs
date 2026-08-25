import { createHash } from "node:crypto";

export const CONTENT_REFRESH_MODEL_VERSION = "phase21-content-refresh-v1";
export const CONTENT_REFRESH_DECISIONS = Object.freeze([
  "KEEP", "UPDATE", "MERGE", "REDIRECT", "NOINDEX", "DELETE",
]);
export const CANNIBALIZATION_RISKS = Object.freeze(["LOW", "MEDIUM", "HIGH"]);

const DECISION_SET = new Set(CONTENT_REFRESH_DECISIONS);
const HIGH_COLLISION_SURFACES = new Set([
  "PRODUCT", "CATEGORY", "ARTICLE", "GUIDE", "HOW_TO", "COMPARISON",
  "TROUBLESHOOTING", "COMPATIBILITY", "CASE_STUDY", "TEST", "REFERENCE",
  "FAQ", "FILTER", "FACET", "BRAND", "SEO_LANDING", "LANDING",
]);
const STOP_WORDS = new Set([
  "а", "без", "более", "бы", "был", "была", "были", "быть", "в", "вам", "вас", "весь", "во",
  "вот", "все", "всего", "вы", "где", "да", "для", "до", "его", "ее", "если", "есть", "еще",
  "же", "за", "здесь", "и", "из", "или", "им", "их", "к", "как", "ко", "когда", "кто", "ли",
  "между", "мы", "на", "над", "надо", "наш", "не", "него", "нее", "нет", "ни", "них", "но",
  "о", "об", "один", "он", "она", "они", "оно", "от", "по", "под", "при", "про", "с", "со",
  "так", "также", "такой", "там", "те", "тем", "то", "того", "тоже", "только", "том", "ты",
  "у", "уже", "чем", "что", "чтобы", "эта", "эти", "это", "этот", "я",
  "the", "and", "for", "from", "into", "that", "this", "with", "your",
]);

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

function cleanText(value, name, maximum = 2_000, minimum = 1) {
  const result = String(value ?? "").normalize("NFKC")
    .replace(/<[^>]+>/g, " ").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  if (result.length < minimum || result.length > maximum) {
    throw new Error(`${name} must contain ${minimum}-${maximum} characters`);
  }
  return result;
}

function integer(value, name, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}`);
  }
  return parsed;
}

function numeric(value, name, minimum = 0, maximum = Number.POSITIVE_INFINITY) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be between ${minimum} and ${maximum}`);
  }
  return parsed;
}

function dateOnly(value, name) {
  const result = cleanText(value, name, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) throw new Error(`${name} must use YYYY-MM-DD`);
  const parsed = new Date(`${result}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== result) {
    throw new Error(`${name} must be a real calendar date`);
  }
  return result;
}

function actor(value, name, { human = false } = {}) {
  const result = cleanText(value, name, 200, 2);
  if (human && /^(?:ai|system|automation|bot)(?:$|[-_: ])/i.test(result)) {
    throw new Error(`${name} must identify a real human`);
  }
  return result;
}

function safeReference(value, name) {
  const result = cleanText(value, name, 500, 10);
  if (/(?:password|passwd|oauth|api[_ -]?key|secret|bearer|access[_ -]?token)\s*[:=]/i.test(result)) {
    throw new Error(`${name} must not contain credentials`);
  }
  try {
    const parsed = new URL(result);
    if (parsed.username || parsed.password) throw new Error(`${name} must not contain credentials`);
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch (error) {
    if (error instanceof Error && /credentials/.test(error.message)) throw error;
    return result;
  }
}

function tableExists(db, name) {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = ?").get(name));
}

function requireTables(db, names) {
  const missing = names.filter((name) => !tableExists(db, name));
  if (missing.length) throw new Error(`Required Phase 21 schema is missing: ${missing.join(", ")}`);
}

function columns(db, table) {
  if (!tableExists(db, table)) return new Set();
  return new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((row) => row.name));
}

function hasColumns(db, table, required) {
  const available = columns(db, table);
  return required.every((name) => available.has(name));
}

function normalizeGoogleProperty(value) {
  const property = cleanText(value, "googlePropertyUri", 500);
  if (/^sc-domain:(?:www\.)?7tool\.ru$/i.test(property)) return "sc-domain:7tool.ru";
  try {
    const parsed = new URL(property);
    if (!/^(?:https?):$/.test(parsed.protocol) || !/^(?:www\.)?7tool\.ru$/i.test(parsed.hostname)
      || parsed.username || parsed.password || parsed.port || parsed.pathname !== "/" || parsed.search || parsed.hash) throw new Error();
    return "https://7tool.ru/";
  } catch {
    throw new Error("googlePropertyUri must identify 7tool.ru without credentials or a path");
  }
}

function normalizeCtrCurve(raw) {
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > 20) {
    throw new Error("expectedCtrCurve must contain 2-20 position bands");
  }
  const curve = raw.map((item, index) => ({
    maxPosition: numeric(item?.maxPosition, `expectedCtrCurve[${index}].maxPosition`, 1, 1_000),
    expectedCtr: numeric(item?.expectedCtr, `expectedCtrCurve[${index}].expectedCtr`, 0, 1),
  }));
  for (let index = 1; index < curve.length; index++) {
    if (curve[index].maxPosition <= curve[index - 1].maxPosition) {
      throw new Error("expectedCtrCurve maxPosition values must increase");
    }
  }
  if (curve.at(-1).maxPosition < 20) throw new Error("expectedCtrCurve must cover at least position 20");
  return curve;
}

function validateRefreshInput(rawInput) {
  const periodStart = dateOnly(rawInput.periodStart, "periodStart");
  const periodEnd = dateOnly(rawInput.periodEnd, "periodEnd");
  const previousPeriodStart = dateOnly(rawInput.previousPeriodStart, "previousPeriodStart");
  const previousPeriodEnd = dateOnly(rawInput.previousPeriodEnd, "previousPeriodEnd");
  if (periodEnd < periodStart || previousPeriodEnd < previousPeriodStart || previousPeriodEnd >= periodStart) {
    throw new Error("Refresh periods must be valid, non-overlapping and chronological");
  }
  return {
    periodStart,
    periodEnd,
    previousPeriodStart,
    previousPeriodEnd,
    googlePropertyUri: normalizeGoogleProperty(rawInput.googlePropertyUri),
    yandexSubjectRef: cleanText(rawInput.yandexSubjectRef, "yandexSubjectRef", 300),
    highImpressionsThreshold: numeric(rawInput.highImpressionsThreshold, "highImpressionsThreshold", Number.EPSILON),
    expectedCtrCurve: normalizeCtrCurve(rawInput.expectedCtrCurve),
    expectedCtrSourceRef: safeReference(rawInput.expectedCtrSourceRef, "expectedCtrSourceRef"),
    minimumPruningDays: integer(rawInput.minimumPruningDays ?? 90, "minimumPruningDays", 30, 1_000),
    semanticSimilarityThreshold: numeric(rawInput.semanticSimilarityThreshold ?? 0.82, "semanticSimilarityThreshold", 0.5, 1),
    evaluatedBy: actor(rawInput.evaluatedBy, "evaluatedBy"),
    evaluatedAt: rawInput.evaluatedAt == null ? Date.now() : integer(rawInput.evaluatedAt, "evaluatedAt", 1),
  };
}

function periodDays(start, end) {
  return Math.floor((Date.parse(`${end}T00:00:00.000Z`) - Date.parse(`${start}T00:00:00.000Z`)) / 86_400_000) + 1;
}

function sourceRun(db, type, subject, start, end) {
  if (type === "GOOGLE") {
    return db.prepare(`
      SELECT id, imported_at FROM gsc_import_runs
      WHERE property_uri = ? AND search_type = 'WEB' AND status = 'COMPLETE'
        AND period_start <= ? AND period_end >= ?
      ORDER BY imported_at DESC, id DESC LIMIT 1
    `).get(subject, start, end);
  }
  return db.prepare(`
    SELECT id, imported_at FROM yandex_import_runs
    WHERE subject_ref = ? AND source_system = 'YANDEX_WEBMASTER'
      AND dataset_type = 'WEBMASTER_URL_QUERIES' AND status = 'COMPLETE'
      AND period_start <= ? AND period_end >= ?
    ORDER BY imported_at DESC, id DESC LIMIT 1
  `).get(subject, start, end);
}

function resolveSourceRuns(db, input) {
  requireTables(db, [
    "gsc_import_runs", "gsc_search_performance_daily",
    "yandex_import_runs", "yandex_webmaster_performance_daily",
  ]);
  const runs = {
    googleCurrent: sourceRun(db, "GOOGLE", input.googlePropertyUri, input.periodStart, input.periodEnd),
    googlePrevious: sourceRun(db, "GOOGLE", input.googlePropertyUri, input.previousPeriodStart, input.previousPeriodEnd),
    yandexCurrent: sourceRun(db, "YANDEX", input.yandexSubjectRef, input.periodStart, input.periodEnd),
    yandexPrevious: sourceRun(db, "YANDEX", input.yandexSubjectRef, input.previousPeriodStart, input.previousPeriodEnd),
  };
  const missing = Object.entries(runs).filter(([, value]) => !value).map(([key]) => key);
  if (missing.length) throw new Error(`Refresh requires complete Google and Yandex coverage: ${missing.join(", ")}`);
  return Object.fromEntries(Object.entries(runs).map(([key, value]) => [key, value.id]));
}

function performance(db, pagePath, start, end, googleRunId, yandexRunId) {
  const google = db.prepare(`
    SELECT query_hash, impressions, clicks, average_position
    FROM gsc_search_performance_daily
    WHERE run_id = ? AND search_type = 'WEB' AND is_facet = 0
      AND page_path = ? AND data_date BETWEEN ? AND ?
  `).all(googleRunId, pagePath, start, end);
  const yandex = db.prepare(`
    SELECT query_hash, impressions, clicks, average_position
    FROM yandex_webmaster_performance_daily
    WHERE run_id = ? AND is_facet = 0
      AND page_path = ? AND data_date BETWEEN ? AND ?
  `).all(yandexRunId, pagePath, start, end);
  const rows = [...google, ...yandex];
  const impressions = rows.reduce((sum, row) => sum + row.impressions, 0);
  const clicks = rows.reduce((sum, row) => sum + row.clicks, 0);
  const positioned = rows.filter((row) => row.average_position != null && row.impressions > 0);
  const positionedImpressions = positioned.reduce((sum, row) => sum + row.impressions, 0);
  const averagePosition = positionedImpressions > 0
    ? positioned.reduce((sum, row) => sum + row.average_position * row.impressions, 0) / positionedImpressions
    : null;
  return {
    impressions,
    clicks,
    ctr: impressions > 0 ? clicks / impressions : 0,
    averagePosition,
    queryHashes: new Set(rows.map((row) => row.query_hash).filter(Boolean)),
  };
}

function expectedCtr(position, curve) {
  if (position == null) return 0;
  return (curve.find((band) => position <= band.maxPosition) ?? curve.at(-1)).expectedCtr;
}

function inboundLinks(db, article) {
  let count = 0;
  if (tableExists(db, "content_internal_links")) {
    count += db.prepare(`
      SELECT COUNT(*) AS count FROM content_internal_links
      WHERE target_site_url_id = ? OR target_path = ?
    `).get(article.site_url_id, article.canonical).count;
  }
  if (tableExists(db, "semantic_link_sets") && tableExists(db, "semantic_link_items")) {
    count += db.prepare(`
      SELECT COUNT(*) AS count FROM semantic_link_items item
      JOIN semantic_link_sets link_set ON link_set.id = item.link_set_id
      WHERE item.target_path = ? AND link_set.status = 'PUBLISHED'
    `).get(article.canonical).count;
  }
  return count;
}

function roiSnapshot(db, article, input) {
  if (!tableExists(db, "content_roi_snapshots")) return null;
  return db.prepare(`
    SELECT * FROM content_roi_snapshots
    WHERE page_path = ? AND period_start = ? AND period_end = ?
    ORDER BY evaluated_at DESC, id DESC LIMIT 1
  `).get(article.canonical, input.periodStart, input.periodEnd) ?? null;
}

function flattenText(value) {
  const parsed = typeof value === "string" ? parseJson(value, value) : value;
  return JSON.stringify(parsed ?? "").replace(/[{}[\]"_:,]+/g, " ");
}

function terms(value) {
  const frequencies = new Map();
  for (const token of flattenText(value).normalize("NFKC").toLocaleLowerCase("ru")
    .replace(/[^a-zа-яё0-9]+/giu, " ").split(/\s+/u).filter(Boolean)) {
    if (token.length < 3 || STOP_WORDS.has(token) || /^\d+$/.test(token)) continue;
    frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
    // Character n-grams make the deterministic comparison tolerant of Russian
    // inflection without inventing an embedding or sending content externally.
    if (token.length >= 5) {
      for (let index = 0; index <= token.length - 3; index++) {
        const trigram = `#${token.slice(index, index + 3)}`;
        frequencies.set(trigram, (frequencies.get(trigram) ?? 0) + 1);
      }
    }
  }
  return frequencies;
}

export function semanticSimilarity(left, right) {
  const leftTerms = terms(left);
  const rightTerms = terms(right);
  if (leftTerms.size < 3 || rightTerms.size < 3) return 0;
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (const value of leftTerms.values()) leftMagnitude += value * value;
  for (const [term, value] of rightTerms) {
    rightMagnitude += value * value;
    dot += value * (leftTerms.get(term) ?? 0);
  }
  if (!leftMagnitude || !rightMagnitude) return 0;
  return Math.max(0, Math.min(1, dot / Math.sqrt(leftMagnitude * rightMagnitude)));
}

function slugify(value) {
  const transliteration = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z", и: "i", й: "y",
    к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
    х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  };
  return String(value).normalize("NFKD").toLocaleLowerCase("ru").split("")
    .map((character) => transliteration[character] ?? character).join("")
    .replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "brand";
}

function pageDocuments(db) {
  const documents = [];
  if (hasColumns(db, "content_assets", ["id", "current_revision_id", "canonical", "title", "h1", "meta_title", "meta_description", "excerpt", "status"])) {
    const rows = db.prepare(`
      SELECT asset.id, asset.content_type AS surface_type, asset.canonical AS page_path,
        asset.title, asset.h1, asset.meta_title, asset.meta_description, asset.excerpt,
        revision.content_body, revision.content_hash
      FROM content_assets asset
      JOIN content_revisions revision ON revision.id = asset.current_revision_id
      WHERE asset.status != 'ARCHIVED'
    `).all();
    for (const row of rows) documents.push({
      id: row.id, surfaceType: row.surface_type, pagePath: row.page_path,
      text: [row.title, row.h1, row.meta_title, row.meta_description, row.excerpt, row.content_body].filter(Boolean).join(" "),
      fingerprint: row.content_hash,
    });
  }
  if (hasColumns(db, "products", ["id", "slug", "title", "brand", "description", "seo_text", "meta_title", "meta_description", "draft"])) {
    const rows = db.prepare(`
      SELECT id, slug, title, brand, description, seo_text, meta_title, meta_description
      FROM products WHERE draft = 0
    `).all();
    for (const row of rows) documents.push({
      id: row.id, surfaceType: "PRODUCT", pagePath: `/p/${row.slug}`,
      text: [row.title, row.brand, row.description, row.seo_text, row.meta_title, row.meta_description].filter(Boolean).join(" "),
      fingerprint: null,
    });
    const brands = new Map();
    for (const row of rows.filter((item) => item.brand)) {
      const current = brands.get(row.brand) ?? [];
      current.push(row.title, row.description, row.seo_text);
      brands.set(row.brand, current);
    }
    for (const [brand, values] of brands) documents.push({
      id: brand, surfaceType: "BRAND", pagePath: `/brand/${slugify(brand)}`,
      text: [brand, ...values].filter(Boolean).join(" "), fingerprint: null,
    });
  }
  if (hasColumns(db, "categories", ["slug", "title", "intro", "seo_text", "meta_title", "meta_description", "published"])) {
    const rows = db.prepare(`
      SELECT slug, title, intro, seo_text, meta_title, meta_description
      FROM categories WHERE published = 1
    `).all();
    for (const row of rows) documents.push({
      id: row.slug, surfaceType: "CATEGORY", pagePath: `/c/${row.slug}`,
      text: [row.title, row.intro, row.seo_text, row.meta_title, row.meta_description].filter(Boolean).join(" "), fingerprint: null,
    });
  }
  if (hasColumns(db, "subcategories", ["id", "category_slug", "slug", "title", "short_description", "intro", "seo_text", "meta_title", "meta_description", "published"])) {
    const rows = db.prepare(`
      SELECT id, category_slug, slug, title, short_description, intro, seo_text, meta_title, meta_description
      FROM subcategories WHERE published = 1
    `).all();
    for (const row of rows) documents.push({
      id: String(row.id), surfaceType: "FILTER", pagePath: `/c/${row.category_slug}/${row.slug}`,
      text: [row.title, row.short_description, row.intro, row.seo_text, row.meta_title, row.meta_description].filter(Boolean).join(" "), fingerprint: null,
    });
  }
  if (hasColumns(db, "landing_content", ["category_slug", "intent_slug", "content_json"])) {
    const rows = db.prepare("SELECT category_slug, intent_slug, content_json FROM landing_content").all();
    for (const row of rows) documents.push({
      id: `${row.category_slug}:${row.intent_slug}`, surfaceType: "LANDING",
      pagePath: `/lp/${row.category_slug}/${row.intent_slug}`, text: row.content_json, fingerprint: null,
    });
  }
  return documents;
}

function duplicateAssessment(article, documents, threshold) {
  const target = documents.find((document) => document.surfaceType !== "PRODUCT" && document.id === article.id);
  if (!target) return { similarity: 0, pagePath: null, risk: "LOW", matches: [] };
  const matches = documents.filter((document) => !(document.id === target.id && document.surfaceType === target.surfaceType))
    .map((document) => {
      const exact = target.fingerprint && document.fingerprint && target.fingerprint === document.fingerprint;
      const similarity = exact ? 1 : semanticSimilarity(target.text, document.text);
      return {
        surfaceType: document.surfaceType,
        surfaceId: document.id,
        pagePath: document.pagePath,
        similarity: Math.round(similarity * 10_000) / 10_000,
        method: exact ? "EXACT_FINGERPRINT" : "SEMANTIC_COSINE",
      };
    })
    .filter((match) => match.similarity >= Math.max(0.35, threshold * 0.75))
    .sort((left, right) => right.similarity - left.similarity || left.pagePath.localeCompare(right.pagePath, "ru"))
    .slice(0, 10);
  const strongest = matches[0];
  const similarity = strongest?.similarity ?? 0;
  return {
    similarity,
    pagePath: strongest?.pagePath ?? null,
    risk: similarity >= threshold ? "HIGH" : similarity >= threshold * 0.85 ? "MEDIUM" : "LOW",
    matches,
  };
}

function collisionAssessment(db, article, duplicate) {
  const evidence = [];
  if (duplicate.risk === "HIGH") evidence.push({
    code: "SEMANTIC_DUPLICATE", risk: "HIGH", pagePath: duplicate.pagePath, similarity: duplicate.similarity,
  });
  const opportunity = article.opportunity_id && tableExists(db, "content_opportunities")
    ? db.prepare("SELECT cannibalization_risk, duplicate_risk FROM content_opportunities WHERE id = ?").get(article.opportunity_id)
    : null;
  if (opportunity?.cannibalization_risk === "HIGH") evidence.push({ code: "OPPORTUNITY_CANNIBALIZATION", risk: "HIGH" });
  if (opportunity?.duplicate_risk === "HIGH") evidence.push({ code: "OPPORTUNITY_DUPLICATE", risk: "HIGH" });

  if (tableExists(db, "intent_url_mappings") && tableExists(db, "site_urls")) {
    const overlaps = db.prepare(`
      SELECT mapping.mapping_role, mapping.status, url.id, url.path, url.page_type, url.entity_type
      FROM intent_url_mappings mapping
      JOIN site_urls url ON url.id = mapping.site_url_id
      WHERE mapping.intent_id = ? AND url.id != ?
        AND mapping.status = 'APPROVED'
      ORDER BY mapping.mapping_role, url.path
    `).all(article.intent_id, article.site_url_id ?? "");
    for (const overlap of overlaps) evidence.push({
      code: overlap.mapping_role === "PRIMARY" ? "OTHER_PRIMARY_INTENT_URL" : "APPROVED_INTENT_OVERLAP",
      risk: overlap.mapping_role === "PRIMARY" ? "HIGH" : "MEDIUM",
      pagePath: overlap.path,
      surfaceType: overlap.page_type || overlap.entity_type || "UNKNOWN",
    });
  }
  if (tableExists(db, "content_assets")) {
    const clusterRows = db.prepare(`
      SELECT id, canonical, content_type FROM content_assets
      WHERE cluster_id = ? AND id != ? AND status IN ('READY', 'PUBLISHED')
      ORDER BY canonical
    `).all(article.cluster_id, article.id);
    for (const row of clusterRows) evidence.push({
      code: "SAME_CLUSTER_PAGE", risk: "MEDIUM", pagePath: row.canonical, surfaceType: row.content_type,
    });
  }
  const high = evidence.some((item) => item.risk === "HIGH"
    && (!item.surfaceType || HIGH_COLLISION_SURFACES.has(item.surfaceType)));
  return { risk: high ? "HIGH" : evidence.length ? "MEDIUM" : "LOW", evidence };
}

function publishedArticles(db) {
  return db.prepare(`
    SELECT asset.*, url.path AS route_path
    FROM content_assets asset
    JOIN site_urls url ON url.id = asset.site_url_id
    WHERE asset.status = 'PUBLISHED' AND asset.index_status = 'INDEX'
      AND asset.human_reviewed = 1 AND asset.current_revision_id IS NOT NULL
      AND url.index_status = 'INDEX' AND url.http_status BETWEEN 200 AND 299
    ORDER BY asset.canonical, asset.id
  `).all();
}

function buildEvaluation(db, input, sourceRuns) {
  const documents = pageDocuments(db);
  const duration = periodDays(input.periodStart, input.periodEnd);
  const articles = publishedArticles(db);
  const assessments = articles.map((article) => {
    const current = performance(
      db, article.canonical, input.periodStart, input.periodEnd,
      sourceRuns.googleCurrent, sourceRuns.yandexCurrent,
    );
    const previous = performance(
      db, article.canonical, input.previousPeriodStart, input.previousPeriodEnd,
      sourceRuns.googlePrevious, sourceRuns.yandexPrevious,
    );
    const newQueries = [...current.queryHashes].filter((queryHash) => !previous.queryHashes.has(queryHash));
    const queryClusterExpanded = current.queryHashes.size > previous.queryHashes.size && newQueries.length > 0;
    const expected = expectedCtr(current.averagePosition, input.expectedCtrCurve);
    const quickWin = current.averagePosition != null && current.averagePosition >= 6 && current.averagePosition <= 20
      && current.impressions >= input.highImpressionsThreshold;
    const lowCtr = current.impressions > 0 && current.ctr < expected;
    const links = inboundLinks(db, article);
    const roi = roiSnapshot(db, article, input);
    const pruningEligible = duration >= input.minimumPruningDays
      && current.impressions === 0 && current.clicks === 0 && links === 0
      && roi != null && roi.leads === 0;
    const duplicate = duplicateAssessment(article, documents, input.semanticSimilarityThreshold);
    const cannibalization = collisionAssessment(db, article, duplicate);
    const reasons = [];
    if (quickWin) reasons.push("UPDATE_PRIORITY_HIGH");
    if (lowCtr) reasons.push("CTR_BELOW_EXPECTED");
    if (queryClusterExpanded) reasons.push("QUERY_CLUSTER_EXPANDED");
    if (pruningEligible) reasons.push("LONG_ZERO_SIGNAL");
    if (duplicate.risk === "HIGH") reasons.push("DUPLICATE_HIGH");
    if (cannibalization.risk === "HIGH") reasons.push("CANNIBALIZATION_HIGH");
    const recommendedUpdate = lowCtr && queryClusterExpanded
      ? "COMPREHENSIVE_UPDATE"
      : lowCtr ? "IMPROVE_TITLE_DESCRIPTION"
        : queryClusterExpanded ? "EXPAND_CONTENT" : "MONITOR";
    const systemRecommendation = duplicate.risk === "HIGH"
      ? "MERGE"
      : reasons.length ? "UPDATE" : "KEEP";
    return {
      contentId: article.id,
      revisionId: article.current_revision_id,
      siteUrlId: article.site_url_id,
      pagePath: article.canonical,
      impressions: current.impressions,
      clicks: current.clicks,
      ctr: current.ctr,
      expectedCtr: expected,
      averagePosition: current.averagePosition,
      currentQueryCount: current.queryHashes.size,
      previousQueryCount: previous.queryHashes.size,
      newQueryCount: newQueries.length,
      queryClusterExpanded,
      inboundLinkCount: links,
      organicLeads: roi?.leads ?? null,
      roiSnapshotId: roi?.id ?? null,
      updatePriority: quickWin ? "HIGH" : reasons.length ? "NORMAL" : "NONE",
      recommendedUpdate,
      duplicate,
      cannibalization,
      pruningEligible,
      systemRecommendation,
      reasonCodes: reasons,
    };
  });
  return { sourceRuns, durationDays: duration, assessments };
}

export function evaluateContentRefresh(db, rawInput) {
  requireTables(db, ["content_assets", "content_revisions", "site_urls"]);
  const input = validateRefreshInput(rawInput);
  const sourceRuns = resolveSourceRuns(db, input);
  return { input, ...buildEvaluation(db, input, sourceRuns) };
}

export function materializeContentRefresh(db, rawInput) {
  requireTables(db, ["content_refresh_runs", "content_refresh_assessments"]);
  const evaluation = evaluateContentRefresh(db, rawInput);
  const runConfig = {
    periodStart: evaluation.input.periodStart,
    periodEnd: evaluation.input.periodEnd,
    previousPeriodStart: evaluation.input.previousPeriodStart,
    previousPeriodEnd: evaluation.input.previousPeriodEnd,
    googlePropertyUri: evaluation.input.googlePropertyUri,
    yandexSubjectRef: evaluation.input.yandexSubjectRef,
    highImpressionsThreshold: evaluation.input.highImpressionsThreshold,
    expectedCtrCurve: evaluation.input.expectedCtrCurve,
    expectedCtrSourceRef: evaluation.input.expectedCtrSourceRef,
    minimumPruningDays: evaluation.input.minimumPruningDays,
    semanticSimilarityThreshold: evaluation.input.semanticSimilarityThreshold,
  };
  const runSnapshot = {
    input: runConfig,
    sourceRuns: evaluation.sourceRuns,
    assessmentEvidence: evaluation.assessments,
    modelVersion: CONTENT_REFRESH_MODEL_VERSION,
  };
  const runChecksum = hash(canonical(runSnapshot));
  const existing = db.prepare("SELECT * FROM content_refresh_runs WHERE evidence_checksum = ?").get(runChecksum);
  if (existing) {
    return {
      run: existing,
      assessments: db.prepare("SELECT * FROM content_refresh_assessments WHERE run_id = ? ORDER BY page_path").all(existing.id),
      duplicate: true,
    };
  }
  const runId = `refresh-${runChecksum.slice(0, 28)}`;
  return db.transaction(() => {
    db.prepare(`
      INSERT INTO content_refresh_runs (
        id, period_start, period_end, previous_period_start, previous_period_end,
        google_property_uri, yandex_subject_ref, high_impressions_threshold,
        expected_ctr_curve_json, expected_ctr_source_ref, minimum_pruning_days,
        semantic_similarity_threshold, source_run_ids_json, model_version,
        evidence_checksum, evaluated_by, evaluated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      runId, evaluation.input.periodStart, evaluation.input.periodEnd,
      evaluation.input.previousPeriodStart, evaluation.input.previousPeriodEnd,
      evaluation.input.googlePropertyUri, evaluation.input.yandexSubjectRef,
      evaluation.input.highImpressionsThreshold, canonical(evaluation.input.expectedCtrCurve),
      evaluation.input.expectedCtrSourceRef, evaluation.input.minimumPruningDays,
      evaluation.input.semanticSimilarityThreshold, canonical(evaluation.sourceRuns),
      CONTENT_REFRESH_MODEL_VERSION, runChecksum, evaluation.input.evaluatedBy,
      evaluation.input.evaluatedAt,
    );
    const insert = db.prepare(`
      INSERT INTO content_refresh_assessments (
        id, run_id, content_id, revision_id, site_url_id, page_path,
        impressions, clicks, ctr, expected_ctr, average_position,
        current_query_count, previous_query_count, new_query_count,
        query_cluster_expanded, inbound_link_count, organic_leads, roi_snapshot_id,
        update_priority, recommended_update, duplicate_similarity,
        duplicate_page_path, duplicate_risk, duplicate_evidence_json,
        cannibalization_risk, cannibalization_evidence_json, pruning_eligible,
        system_recommendation, reason_codes_json, evidence_checksum, status, evaluated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'REVIEW_REQUIRED', ?)
    `);
    const stored = [];
    for (const item of evaluation.assessments) {
      const evidenceChecksum = hash(canonical({ runChecksum, ...item }));
      const id = `refresh-item-${evidenceChecksum.slice(0, 24)}`;
      insert.run(
        id, runId, item.contentId, item.revisionId, item.siteUrlId, item.pagePath,
        item.impressions, item.clicks, item.ctr, item.expectedCtr, item.averagePosition,
        item.currentQueryCount, item.previousQueryCount, item.newQueryCount,
        item.queryClusterExpanded ? 1 : 0, item.inboundLinkCount,
        item.organicLeads, item.roiSnapshotId, item.updatePriority,
        item.recommendedUpdate, item.duplicate.similarity, item.duplicate.pagePath,
        item.duplicate.risk, canonical(item.duplicate.matches), item.cannibalization.risk,
        canonical(item.cannibalization.evidence), item.pruningEligible ? 1 : 0,
        item.systemRecommendation, canonical(item.reasonCodes), evidenceChecksum,
        evaluation.input.evaluatedAt,
      );
      stored.push(db.prepare("SELECT * FROM content_refresh_assessments WHERE id = ?").get(id));
    }
    return { run: db.prepare("SELECT * FROM content_refresh_runs WHERE id = ?").get(runId), assessments: stored, duplicate: false };
  })();
}

export function reviewContentRefreshAssessment(db, rawInput) {
  requireTables(db, ["content_refresh_assessments", "content_refresh_reviews", "site_urls"]);
  const assessmentId = cleanText(rawInput.assessmentId, "assessmentId", 200);
  const decision = cleanText(rawInput.decision, "decision", 20).toLocaleUpperCase("en");
  if (!DECISION_SET.has(decision)) throw new Error(`decision must be one of: ${CONTENT_REFRESH_DECISIONS.join(", ")}`);
  const reviewedBy = actor(rawInput.reviewedBy, "reviewedBy", { human: true });
  const rationaleMinimum = new Set(["REDIRECT", "NOINDEX", "DELETE"]).has(decision) ? 80 : 40;
  const rationale = cleanText(rawInput.rationale, "rationale", 2_000, rationaleMinimum);
  const reviewedAt = rawInput.reviewedAt == null ? Date.now() : integer(rawInput.reviewedAt, "reviewedAt", 1);
  const assessment = db.prepare("SELECT * FROM content_refresh_assessments WHERE id = ?").get(assessmentId);
  if (!assessment) throw new Error(`Unknown content refresh assessment: ${assessmentId}`);
  const existing = db.prepare("SELECT * FROM content_refresh_reviews WHERE assessment_id = ?").get(assessmentId);
  let target = null;
  if (new Set(["MERGE", "REDIRECT"]).has(decision)) {
    const targetId = cleanText(rawInput.targetSiteUrlId, "targetSiteUrlId", 200);
    target = db.prepare("SELECT * FROM site_urls WHERE id = ?").get(targetId);
    if (!target || target.id === assessment.site_url_id || target.index_status !== "INDEX"
      || target.http_status < 200 || target.http_status >= 300) {
      throw new Error("MERGE and REDIRECT require a different live indexable target URL");
    }
  } else if (rawInput.targetSiteUrlId != null) {
    throw new Error("targetSiteUrlId is allowed only for MERGE or REDIRECT");
  }
  if (decision === "DELETE" && assessment.pruning_eligible !== 1) {
    throw new Error("DELETE can be reviewed only for a long-term zero-signal pruning candidate");
  }
  if (new Set(["REDIRECT", "NOINDEX"]).has(decision)
    && assessment.pruning_eligible !== 1
    && assessment.duplicate_risk !== "HIGH" && assessment.cannibalization_risk !== "HIGH") {
    throw new Error(`${decision} requires zero-signal or high collision evidence`);
  }
  const identity = hash(canonical({ assessmentId, decision, targetId: target?.id ?? null, rationale, reviewedBy }));
  const id = `refresh-review-${identity.slice(0, 24)}`;
  if (existing) {
    if (existing.id === id) return { ...existing, duplicate: true };
    throw new Error("Content refresh assessment already has a different human decision");
  }
  db.prepare(`
    INSERT INTO content_refresh_reviews (
      id, assessment_id, decision, target_site_url_id, rationale, reviewed_by, reviewed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, assessmentId, decision, target?.id ?? null, rationale, reviewedBy, reviewedAt);
  return { ...db.prepare("SELECT * FROM content_refresh_reviews WHERE id = ?").get(id), duplicate: false };
}

export function assessContentPublicationCollision(db, contentId, rawInput = {}) {
  requireTables(db, ["content_assets", "content_revisions"]);
  const article = db.prepare("SELECT * FROM content_assets WHERE id = ?").get(cleanText(contentId, "contentId", 200));
  if (!article || !article.current_revision_id) throw new Error(`Unknown current content asset: ${contentId}`);
  const threshold = numeric(rawInput.semanticSimilarityThreshold ?? 0.82, "semanticSimilarityThreshold", 0.5, 1);
  const duplicate = duplicateAssessment(article, pageDocuments(db), threshold);
  const cannibalization = collisionAssessment(db, article, duplicate);
  return { article, threshold, duplicate, cannibalization };
}

export function requireContentPublicationClearance(db, article) {
  if (!tableExists(db, "content_refresh_assessments")) return null;
  const latestRun = tableExists(db, "content_refresh_runs")
    ? db.prepare("SELECT semantic_similarity_threshold FROM content_refresh_runs ORDER BY evaluated_at DESC, id DESC LIMIT 1").get()
    : null;
  const assessment = assessContentPublicationCollision(db, article.id, {
    semanticSimilarityThreshold: latestRun?.semantic_similarity_threshold ?? 0.82,
  });
  if (assessment.duplicate.risk === "HIGH") {
    throw new Error(`MERGE_REQUIRED: semantic duplicate of ${assessment.duplicate.pagePath}`);
  }
  if (assessment.cannibalization.risk === "HIGH") {
    throw new Error("HIGH cannibalization risk blocks publication across products, categories, articles, filters, brands and landing pages");
  }
  return assessment;
}

function uniqueStrings(raw, name, maximum = 100) {
  if (!Array.isArray(raw) || !raw.length || raw.length > maximum) throw new Error(`${name} must contain 1-${maximum} values`);
  const values = raw.map((value, index) => cleanText(value, `${name}[${index}]`, 200));
  if (new Set(values).size !== values.length) throw new Error(`${name} must be unique`);
  return values.sort((left, right) => left.localeCompare(right, "ru"));
}

export function registerExpertProfile(db, rawInput) {
  requireTables(db, ["experts", "expert_categories", "expert_brands", "categories", "products"]);
  const profile = {
    name: cleanText(rawInput.name, "name", 200, 3),
    photoPath: cleanText(rawInput.photoPath, "photoPath", 500),
    photoRightsRef: safeReference(rawInput.photoRightsRef, "photoRightsRef"),
    specialization: cleanText(rawInput.specialization, "specialization", 1_000, 20),
    experienceText: cleanText(rawInput.experienceText, "experienceText", 2_000, 20),
    identityEvidenceRef: safeReference(rawInput.identityEvidenceRef, "identityEvidenceRef"),
    categories: uniqueStrings(rawInput.categories, "categories"),
    brands: uniqueStrings(rawInput.brands, "brands"),
    reviewedBy: actor(rawInput.reviewedBy, "reviewedBy", { human: true }),
    reviewedAt: rawInput.reviewedAt == null ? Date.now() : integer(rawInput.reviewedAt, "reviewedAt", 1),
  };
  if (!/^\/(?:media|uploads)\//.test(profile.photoPath) || profile.photoPath.includes("..")) {
    throw new Error("photoPath must be a safe local /media/ or /uploads/ path");
  }
  for (const category of profile.categories) {
    if (!db.prepare("SELECT 1 FROM categories WHERE slug = ?").get(category)) throw new Error(`Unknown expert category: ${category}`);
  }
  for (const brand of profile.brands) {
    if (!db.prepare("SELECT 1 FROM products WHERE brand = ? LIMIT 1").get(brand)) throw new Error(`Unknown expert brand: ${brand}`);
  }
  const identityProfile = {
    name: profile.name,
    photoPath: profile.photoPath,
    photoRightsRef: profile.photoRightsRef,
    specialization: profile.specialization,
    experienceText: profile.experienceText,
    identityEvidenceRef: profile.identityEvidenceRef,
    categories: profile.categories,
    brands: profile.brands,
    reviewedBy: profile.reviewedBy,
  };
  const identity = hash(canonical(identityProfile));
  const id = `expert-${identity.slice(0, 28)}`;
  const existing = db.prepare("SELECT * FROM experts WHERE name = ?").get(profile.name);
  if (existing) {
    if (existing.id !== id) throw new Error("Expert name already exists with different immutable identity evidence");
    return { expert: existing, duplicate: true };
  }
  return db.transaction(() => {
    db.prepare(`
      INSERT INTO experts (
        id, name, photo_path, photo_rights_ref, specialization, experience_text,
        identity_evidence_ref, status, reviewed_by, reviewed_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?)
    `).run(
      id, profile.name, profile.photoPath, profile.photoRightsRef, profile.specialization,
      profile.experienceText, profile.identityEvidenceRef, profile.reviewedBy,
      profile.reviewedAt, profile.reviewedAt,
    );
    const insertCategory = db.prepare("INSERT INTO expert_categories (expert_id, category_slug) VALUES (?, ?)");
    for (const category of profile.categories) insertCategory.run(id, category);
    const insertBrand = db.prepare("INSERT INTO expert_brands (expert_id, brand) VALUES (?, ?)");
    for (const brand of profile.brands) insertBrand.run(id, brand);
    return { expert: db.prepare("SELECT * FROM experts WHERE id = ?").get(id), duplicate: false };
  })();
}

export function reviewContentByExpert(db, rawInput) {
  requireTables(db, ["experts", "expert_categories", "expert_brands", "content_expert_reviews", "content_assets", "content_revisions"]);
  const contentId = cleanText(rawInput.contentId, "contentId", 200);
  const expertId = cleanText(rawInput.expertId, "expertId", 200);
  const decision = cleanText(rawInput.decision, "decision", 20).toLocaleUpperCase("en");
  if (!new Set(["APPROVED", "REJECTED"]).has(decision)) throw new Error("decision must be APPROVED or REJECTED");
  const assignedBy = actor(rawInput.assignedBy, "assignedBy", { human: true });
  const reviewStatement = cleanText(rawInput.reviewStatement, "reviewStatement", 2_000, 40);
  const reviewedAt = rawInput.reviewedAt == null ? Date.now() : integer(rawInput.reviewedAt, "reviewedAt", 1);
  const article = db.prepare("SELECT * FROM content_assets WHERE id = ?").get(contentId);
  if (!article || !article.current_revision_id || !new Set(["READY", "PUBLISHED"]).has(article.status)) {
    throw new Error("Expert review requires current READY or PUBLISHED content");
  }
  const expert = db.prepare("SELECT * FROM experts WHERE id = ? AND status = 'ACTIVE'").get(expertId);
  if (!expert) throw new Error("Expert profile must be active and human-verified");
  if (!db.prepare("SELECT 1 FROM expert_categories WHERE expert_id = ? AND category_slug = ?").get(expert.id, article.category_slug)) {
    throw new Error("Expert is not approved for the content category");
  }
  const expertBrands = new Set(db.prepare("SELECT brand FROM expert_brands WHERE expert_id = ?").all(expert.id).map((row) => row.brand));
  if (expertBrands.size && tableExists(db, "content_products")) {
    const articleBrands = db.prepare(`
      SELECT DISTINCT product.brand FROM content_products relation
      JOIN products product ON product.id = relation.product_id
      WHERE relation.content_asset_id = ? AND product.brand IS NOT NULL
    `).all(article.id).map((row) => row.brand);
    if (articleBrands.some((brand) => !expertBrands.has(brand))) {
      throw new Error("Expert brand scope does not cover every referenced product brand");
    }
  }
  const identity = hash(canonical({ contentId, revisionId: article.current_revision_id, expertId, decision, reviewStatement, assignedBy }));
  const id = `expert-review-${identity.slice(0, 24)}`;
  const existing = db.prepare(`
    SELECT * FROM content_expert_reviews
    WHERE content_id = ? AND revision_id = ? AND expert_id = ?
  `).get(article.id, article.current_revision_id, expert.id);
  if (existing) {
    if (existing.id === id) return { review: existing, expert, duplicate: true };
    throw new Error("Expert already reviewed this content revision with different evidence");
  }
  return db.transaction(() => {
    db.prepare(`
      INSERT INTO content_expert_reviews (
        id, content_id, revision_id, expert_id, decision, review_statement,
        assigned_by, reviewed_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, article.id, article.current_revision_id, expert.id, decision, reviewStatement, assignedBy, reviewedAt, reviewedAt);
    if (decision === "APPROVED") {
      db.prepare("UPDATE content_assets SET expert_reviewer = ?, updated_at = ? WHERE id = ?")
        .run(expert.name, reviewedAt, article.id);
    }
    return { review: db.prepare("SELECT * FROM content_expert_reviews WHERE id = ?").get(id), expert, duplicate: false };
  })();
}

export function requireVerifiedExpertReview(db, article) {
  if (!tableExists(db, "experts") || !tableExists(db, "content_expert_reviews")) return null;
  const activeCount = db.prepare("SELECT COUNT(*) AS count FROM experts WHERE status = 'ACTIVE'").get().count;
  if (!activeCount) return null;
  const review = db.prepare(`
    SELECT review.*, expert.name, expert.photo_path, expert.specialization,
      expert.experience_text
    FROM content_expert_reviews review
    JOIN experts expert ON expert.id = review.expert_id AND expert.status = 'ACTIVE'
    JOIN expert_categories category ON category.expert_id = expert.id
      AND category.category_slug = ?
    WHERE review.content_id = ? AND review.revision_id = ? AND review.decision = 'APPROVED'
    ORDER BY review.reviewed_at DESC, review.id DESC LIMIT 1
  `).get(article.category_slug, article.id, article.current_revision_id);
  if (!review || review.name !== article.expert_reviewer) {
    throw new Error("Publication requires an approved real expert profile for the current revision and category");
  }
  return review;
}

export function getExpertProfileForContent(db, contentId, revisionId) {
  if (!tableExists(db, "experts") || !tableExists(db, "content_expert_reviews")) return null;
  const row = db.prepare(`
    SELECT expert.id, expert.name, expert.photo_path, expert.specialization,
      expert.experience_text, review.review_statement
    FROM content_expert_reviews review
    JOIN experts expert ON expert.id = review.expert_id AND expert.status = 'ACTIVE'
    WHERE review.content_id = ? AND review.revision_id = ? AND review.decision = 'APPROVED'
    ORDER BY review.reviewed_at DESC, review.id DESC LIMIT 1
  `).get(contentId, revisionId);
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    photoPath: row.photo_path,
    specialization: row.specialization,
    experience: row.experience_text,
    reviewStatement: row.review_statement,
    categories: db.prepare("SELECT category_slug FROM expert_categories WHERE expert_id = ? ORDER BY category_slug").all(row.id).map((item) => item.category_slug),
    brands: db.prepare("SELECT brand FROM expert_brands WHERE expert_id = ? ORDER BY brand").all(row.id).map((item) => item.brand),
    articles: db.prepare(`
      SELECT asset.title, asset.canonical FROM content_expert_reviews review
      JOIN content_assets asset ON asset.id = review.content_id
      WHERE review.expert_id = ? AND review.decision = 'APPROVED'
        AND asset.status = 'PUBLISHED' AND asset.index_status = 'INDEX'
      ORDER BY asset.published_at DESC, asset.title
    `).all(row.id).map((item) => ({ title: item.title, path: item.canonical })),
  };
}

export function getContentRefreshStatus(db, rawInput = {}) {
  requireTables(db, ["content_refresh_runs", "content_refresh_assessments", "content_refresh_reviews"]);
  const run = rawInput.runId
    ? db.prepare("SELECT * FROM content_refresh_runs WHERE id = ?").get(cleanText(rawInput.runId, "runId", 200))
    : db.prepare("SELECT * FROM content_refresh_runs ORDER BY evaluated_at DESC, id DESC LIMIT 1").get();
  if (!run) return null;
  const counts = db.prepare(`
    SELECT assessment.update_priority, assessment.system_recommendation,
      assessment.duplicate_risk, assessment.cannibalization_risk,
      COUNT(*) AS count
    FROM content_refresh_assessments assessment
    WHERE assessment.run_id = ?
    GROUP BY assessment.update_priority, assessment.system_recommendation,
      assessment.duplicate_risk, assessment.cannibalization_risk
    ORDER BY assessment.update_priority, assessment.system_recommendation
  `).all(run.id);
  const reviewed = db.prepare(`
    SELECT review.decision, COUNT(*) AS count FROM content_refresh_reviews review
    JOIN content_refresh_assessments assessment ON assessment.id = review.assessment_id
    WHERE assessment.run_id = ? GROUP BY review.decision ORDER BY review.decision
  `).all(run.id);
  return { run, counts, reviewed };
}
