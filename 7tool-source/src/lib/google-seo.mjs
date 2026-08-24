import { createHash, randomUUID } from "node:crypto";

export const GSC_DIMENSIONS = Object.freeze(["date", "page", "query", "country", "device"]);
export const GOOGLE_QUICK_WIN_MODEL_VERSION = "google-quick-wins-v1";
export const FACET_CLASSIFICATIONS = Object.freeze({
  INDEXABLE: "INDEXABLE_SEO_LANDING",
  NON_INDEXABLE: "NON_INDEXABLE_FACET",
});

const SEARCH_TYPES = new Map([
  ["web", "WEB"], ["image", "IMAGE"], ["video", "VIDEO"], ["news", "NEWS"],
  ["discover", "DISCOVER"], ["googlenews", "GOOGLE_NEWS"], ["google_news", "GOOGLE_NEWS"],
]);
const DEVICES = new Set(["DESKTOP", "MOBILE", "TABLET"]);
const TRACKING_PARAMS = new Set([
  "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
  "yclid", "gclid", "fbclid", "_openstat", "roistat",
]);
const NAVIGATION_TYPES = new Set(["NAVIGATE", "RELOAD", "BACK_FORWARD", "PRERENDER", "RESTORE", "UNKNOWN"]);

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

function cleanText(value, limit = 1_000) {
  return String(value ?? "").normalize("NFKC").replace(/<[^>]+>/g, " ").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

function dateOnly(value, name) {
  const result = cleanText(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) throw new Error(`${name} must use YYYY-MM-DD`);
  const date = new Date(`${result}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== result) throw new Error(`${name} must be a real calendar date`);
  return result;
}

function number(value, name, { minimum = 0, maximum = Number.POSITIVE_INFINITY } = {}) {
  const parsed = typeof value === "string" && value.trim().endsWith("%")
    ? Number(value.trim().slice(0, -1).replace(",", ".")) / 100
    : Number(typeof value === "string" ? value.replace(",", ".") : value);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) throw new Error(`${name} must be between ${minimum} and ${maximum}`);
  return parsed;
}

function integer(value, name, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) throw new Error(`${name} must be an integer from ${minimum} to ${maximum}`);
  return parsed;
}

function normalizeSearchType(value) {
  const key = cleanText(value || "web", 30).toLocaleLowerCase("en").replace(/[^a-z_]/g, "");
  const type = SEARCH_TYPES.get(key);
  if (!type) throw new Error("Unsupported Google Search Console search type");
  return type;
}

function normalizePropertyUri(value) {
  const property = cleanText(value, 500);
  if (/^sc-domain:(?:www\.)?7tool\.ru$/i.test(property)) return "sc-domain:7tool.ru";
  try {
    const parsed = new URL(property);
    if (!/^(?:http|https):$/.test(parsed.protocol) || !/^(?:www\.)?7tool\.ru$/i.test(parsed.hostname)
      || parsed.username || parsed.password || parsed.port || parsed.pathname !== "/" || parsed.search || parsed.hash) throw new Error();
    return "https://7tool.ru/";
  } catch {
    throw new Error("GSC property must identify 7tool.ru without credentials or a path");
  }
}

function normalizeDimensions(value) {
  const dimensions = (Array.isArray(value) ? value : String(value ?? "").split(","))
    .map((item) => cleanText(item, 30).toLocaleLowerCase("en"))
    .filter(Boolean);
  if (new Set(dimensions).size !== dimensions.length
    || canonical([...dimensions].sort()) !== canonical([...GSC_DIMENSIONS].sort())) {
    throw new Error(`GSC import dimensions must contain exactly: ${GSC_DIMENSIONS.join(", ")}`);
  }
  return dimensions;
}

function cleanSourceRef(value) {
  const source = cleanText(value, 500);
  if (!source) throw new Error("sourceRef is required");
  try {
    const parsed = new URL(source);
    if (parsed.username || parsed.password) throw new Error("sourceRef must not contain credentials");
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`.slice(0, 500);
  } catch (error) {
    if (error instanceof Error && /credentials/.test(error.message)) throw error;
    return source.replace(/[?#].*$/, "");
  }
}

function normalizePage(value) {
  let parsed;
  try { parsed = new URL(String(value)); } catch { throw new Error("GSC page must be an absolute 7tool.ru URL"); }
  if (!/^(?:http|https):$/.test(parsed.protocol) || !/^(?:www\.)?7tool\.ru$/i.test(parsed.hostname)
    || parsed.username || parsed.password) {
    throw new Error("GSC page must belong to 7tool.ru");
  }
  parsed.protocol = "https:";
  parsed.hostname = "7tool.ru";
  parsed.port = "";
  parsed.hash = "";
  for (const key of [...parsed.searchParams.keys()]) if (TRACKING_PARAMS.has(key.toLocaleLowerCase("en"))) parsed.searchParams.delete(key);
  parsed.searchParams.sort();
  const routePath = parsed.pathname || "/";
  const pagePath = `${routePath}${parsed.search}`;
  const facetKeys = [...parsed.searchParams.keys()].filter((key) => key.toLocaleLowerCase("en") !== "page");
  return { pageUrl: parsed.toString(), pagePath, routePath, isFacet: facetKeys.length > 0 };
}

function requireTable(db, name) {
  const found = db.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = ?").get(name);
  if (!found) throw new Error(`Google SEO schema is not applied: ${name}`);
}

function hasTable(db, name) {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = ?").get(name));
}

export function buildSearchAnalyticsRequest(input) {
  const startDate = dateOnly(input.startDate, "startDate");
  const endDate = dateOnly(input.endDate, "endDate");
  if (endDate < startDate) throw new Error("endDate must not precede startDate");
  return {
    startDate,
    endDate,
    dimensions: [...GSC_DIMENSIONS],
    type: normalizeSearchType(input.type).toLocaleLowerCase("en").replace("google_news", "googleNews"),
    dataState: "final",
    rowLimit: integer(input.rowLimit ?? 25_000, "rowLimit", 1, 25_000),
    startRow: integer(input.startRow ?? 0, "startRow", 0, 50_000),
  };
}

function normalizeGscRow(row, dimensions, input) {
  if (!Array.isArray(row?.keys) || row.keys.length !== dimensions.length) throw new Error("Each GSC row must have one key per requested dimension");
  const keyed = Object.fromEntries(dimensions.map((dimension, index) => [dimension, row.keys[index]]));
  const dataDate = dateOnly(keyed.date, "row date");
  if (dataDate < input.periodStart || dataDate > input.periodEnd) throw new Error("GSC row date is outside the import period");
  const page = normalizePage(keyed.page);
  const queryText = cleanText(keyed.query, 500);
  if (!queryText) throw new Error("GSC query dimension cannot be empty");
  const country = cleanText(keyed.country, 3).toLocaleLowerCase("en");
  if (!/^[a-z]{3}$/.test(country)) throw new Error("GSC country must use its three-letter API code");
  const device = cleanText(keyed.device, 30).toLocaleUpperCase("en");
  if (!DEVICES.has(device)) throw new Error("GSC device must be DESKTOP, MOBILE or TABLET");
  const impressions = number(row.impressions, "impressions");
  const clicks = number(row.clicks, "clicks", { maximum: impressions });
  const ctr = number(row.ctr, "ctr", { maximum: 1 });
  const expectedCtr = impressions > 0 ? clicks / impressions : 0;
  if (Math.abs(expectedCtr - ctr) > 0.005) throw new Error("GSC CTR does not match clicks/impressions");
  const averagePosition = number(row.position, "position");
  const normalized = {
    dataDate, searchType: input.searchType, ...page, queryText, queryHash: hash(queryText.toLocaleLowerCase("ru")),
    country, device, impressions, clicks, ctr, averagePosition,
  };
  return { ...normalized, rowChecksum: hash(canonical(normalized)) };
}

export function validateGoogleSearchConsoleImport(rawInput) {
  const propertyUri = normalizePropertyUri(rawInput.propertyUri);
  const periodStart = dateOnly(rawInput.periodStart, "periodStart");
  const periodEnd = dateOnly(rawInput.periodEnd, "periodEnd");
  if (periodEnd < periodStart) throw new Error("periodEnd must not precede periodStart");
  const searchType = normalizeSearchType(rawInput.searchType);
  const dimensions = normalizeDimensions(rawInput.dimensions);
  const acquisitionMethod = cleanText(rawInput.acquisitionMethod, 50).toLocaleUpperCase("en");
  if (!new Set(["SEARCH_CONSOLE_API", "SEARCH_CONSOLE_EXPORT"]).has(acquisitionMethod)) throw new Error("Unsupported GSC acquisition method");
  const sourceRef = cleanSourceRef(rawInput.sourceRef);
  const sourceSha256 = cleanText(rawInput.sourceSha256, 64).toLocaleLowerCase("en");
  if (!/^[a-f0-9]{64}$/.test(sourceSha256)) throw new Error("sourceSha256 must be a SHA-256 hex digest");
  const importedAt = rawInput.importedAt == null ? Date.now() : integer(rawInput.importedAt, "importedAt", 1);
  const rows = (Array.isArray(rawInput.rows) ? rawInput.rows : []).map((row) => normalizeGscRow(row, dimensions, { periodStart, periodEnd, searchType }));
  if (!rows.length) throw new Error("GSC import must contain at least one row");
  if (new Set(rows.map((row) => row.rowChecksum)).size !== rows.length) throw new Error("GSC import contains duplicate dimension rows");
  const runChecksum = hash(canonical({
    propertyUri, periodStart, periodEnd, searchType, dimensions, acquisitionMethod,
    sourceRef, sourceSha256, rowChecksums: rows.map((row) => row.rowChecksum).sort(),
  }));
  return {
    propertyUri, periodStart, periodEnd, searchType, dimensions, acquisitionMethod,
    sourceRef, sourceSha256, importedAt, rows, runChecksum,
  };
}

export function importGoogleSearchConsole(db, rawInput) {
  requireTable(db, "gsc_import_runs");
  requireTable(db, "gsc_search_performance_daily");
  const {
    propertyUri, periodStart, periodEnd, searchType, dimensions, acquisitionMethod,
    sourceRef, sourceSha256, importedAt, rows, runChecksum,
  } = validateGoogleSearchConsoleImport(rawInput);
  const existing = db.prepare("SELECT * FROM gsc_import_runs WHERE run_checksum = ?").get(runChecksum);
  if (existing) return { run: existing, importedRows: 0, duplicate: true };
  const id = `gsc-${runChecksum.slice(0, 28)}`;
  db.transaction(() => {
    db.prepare(`
      INSERT INTO gsc_import_runs (
        id, property_uri, period_start, period_end, search_type, dimensions_json,
        acquisition_method, source_ref, source_sha256, run_checksum, row_count, status, imported_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETE', ?)
    `).run(id, propertyUri, periodStart, periodEnd, searchType, JSON.stringify(dimensions), acquisitionMethod,
      sourceRef, sourceSha256, runChecksum, rows.length, importedAt);
    const insert = db.prepare(`
      INSERT INTO gsc_search_performance_daily (
        id, run_id, data_date, search_type, page_url, page_path, route_path, query_text, query_hash,
        country, device, impressions, clicks, ctr, average_position, is_facet,
        row_checksum, imported_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    rows.forEach((row, index) => insert.run(
      `gsc-row-${hash(`${runChecksum}:${row.rowChecksum}:${index}`).slice(0, 28)}`, id,
      row.dataDate, row.searchType, row.pageUrl, row.pagePath, row.routePath, row.queryText, row.queryHash,
      row.country, row.device, row.impressions, row.clicks, row.ctr, row.averagePosition,
      row.isFacet ? 1 : 0, row.rowChecksum, importedAt,
    ));
  })();
  return { run: db.prepare("SELECT * FROM gsc_import_runs WHERE id = ?").get(id), importedRows: rows.length, duplicate: false };
}

function validateQuickWinInput(input) {
  const propertyUri = normalizePropertyUri(input.propertyUri);
  const periodStart = dateOnly(input.periodStart, "periodStart");
  const periodEnd = dateOnly(input.periodEnd, "periodEnd");
  if (periodEnd < periodStart) throw new Error("periodEnd must not precede periodStart");
  return { propertyUri, periodStart, periodEnd, minImpressions: number(input.minImpressions, "minImpressions", { minimum: Number.EPSILON }) };
}

export function evaluateGoogleQuickWins(db, rawInput) {
  requireTable(db, "gsc_search_performance_daily");
  requireTable(db, "site_urls");
  const input = validateQuickWinInput(rawInput);
  const rows = db.prepare(`
    WITH ranked AS (
      SELECT p.*, r.property_uri, r.imported_at AS run_imported_at,
        ROW_NUMBER() OVER (
          PARTITION BY p.data_date, p.search_type, p.page_url, p.query_hash, p.country, p.device
          ORDER BY r.imported_at DESC, r.id DESC
        ) AS freshness_rank
      FROM gsc_search_performance_daily p
      JOIN gsc_import_runs r ON r.id = p.run_id AND r.status = 'COMPLETE'
      WHERE r.property_uri = ? AND p.search_type = 'WEB'
        AND p.data_date BETWEEN ? AND ? AND p.is_facet = 0
    ), fresh AS (
      SELECT * FROM ranked WHERE freshness_rank = 1
    )
    SELECT u.id AS page_url_id, fresh.page_path,
      SUM(fresh.impressions) AS impressions,
      SUM(fresh.clicks) AS clicks,
      SUM(fresh.clicks) / SUM(fresh.impressions) AS ctr,
      SUM(fresh.average_position * fresh.impressions) / SUM(fresh.impressions) AS average_position,
      COUNT(DISTINCT fresh.query_hash) AS query_count,
      COUNT(DISTINCT fresh.country) AS country_count,
      COUNT(DISTINCT fresh.device) AS device_count,
      GROUP_CONCAT(fresh.run_id) AS source_run_ids
    FROM fresh
    JOIN site_urls u ON u.path = fresh.page_path
      AND u.index_status = 'INDEX' AND u.http_status BETWEEN 200 AND 299
    GROUP BY u.id, fresh.page_path
    HAVING SUM(fresh.impressions) >= ?
      AND SUM(fresh.average_position * fresh.impressions) / SUM(fresh.impressions) BETWEEN 6 AND 20
    ORDER BY impressions DESC, fresh.page_path
  `).all(input.propertyUri, input.periodStart, input.periodEnd, input.minImpressions);
  return rows.map((row) => ({
    pageUrlId: row.page_url_id,
    pagePath: row.page_path,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    minImpressions: input.minImpressions,
    minPosition: 6,
    maxPosition: 20,
    impressions: row.impressions,
    clicks: row.clicks,
    ctr: row.ctr,
    averagePosition: row.average_position,
    queryCount: row.query_count,
    countryCount: row.country_count,
    deviceCount: row.device_count,
    sourceRunIds: Array.from(new Set(String(row.source_run_ids).split(","))).sort(),
    status: "HIGH_PRIORITY_UPDATE",
    decision: "UPDATE",
    modelVersion: GOOGLE_QUICK_WIN_MODEL_VERSION,
  }));
}

export function materializeGoogleQuickWins(db, rawInput) {
  requireTable(db, "google_quick_wins");
  const items = evaluateGoogleQuickWins(db, rawInput);
  const evaluatedAt = rawInput.evaluatedAt == null ? Date.now() : integer(rawInput.evaluatedAt, "evaluatedAt", 1);
  const insert = db.prepare(`
    INSERT OR IGNORE INTO google_quick_wins (
      id, page_url_id, page_path, period_start, period_end, min_impressions,
      min_position, max_position, impressions, clicks, ctr, average_position,
      query_count, country_count, device_count, source_run_ids_json, status,
      decision, model_version, evidence_checksum, evaluated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 6, 20, ?, ?, ?, ?, ?, ?, ?, ?, 'HIGH_PRIORITY_UPDATE',
      'UPDATE', ?, ?, ?)
  `);
  let saved = 0;
  db.transaction(() => {
    for (const item of items) {
      const evidenceChecksum = hash(canonical(item));
      const info = insert.run(
        `google-win-${evidenceChecksum.slice(0, 24)}`, item.pageUrlId, item.pagePath,
        item.periodStart, item.periodEnd, item.minImpressions, item.impressions, item.clicks,
        item.ctr, item.averagePosition, item.queryCount, item.countryCount, item.deviceCount,
        JSON.stringify(item.sourceRunIds), item.modelVersion, evidenceChecksum, evaluatedAt,
      );
      saved += info.changes;
    }
  })();
  return { items, saved };
}

export function listGooglePerformanceForUrl(db, rawInput) {
  requireTable(db, "gsc_search_performance_daily");
  const propertyUri = normalizePropertyUri(rawInput.propertyUri);
  const pagePath = normalizePerformancePath(rawInput.pagePath);
  const periodStart = dateOnly(rawInput.periodStart, "periodStart");
  const periodEnd = dateOnly(rawInput.periodEnd, "periodEnd");
  const limit = integer(rawInput.limit ?? 1_000, "limit", 1, 10_000);
  return db.prepare(`
    WITH ranked AS (
      SELECT p.*,
        ROW_NUMBER() OVER (
          PARTITION BY p.data_date, p.search_type, p.page_url, p.query_hash, p.country, p.device
          ORDER BY r.imported_at DESC, r.id DESC
        ) AS freshness_rank
      FROM gsc_search_performance_daily p
      JOIN gsc_import_runs r ON r.id = p.run_id
      WHERE r.property_uri = ? AND p.page_path = ? AND p.data_date BETWEEN ? AND ?
    )
    SELECT data_date AS date, page_url AS pageUrl, query_text AS query, country, device,
      impressions, clicks, ctr, average_position AS position, search_type AS searchType,
      is_facet AS isFacet
    FROM ranked WHERE freshness_rank = 1
    ORDER BY data_date DESC, impressions DESC, query_text LIMIT ?
  `).all(propertyUri, pagePath, periodStart, periodEnd, limit);
}

export function classifyCoreWebVital(nameValue, rawValue) {
  const name = cleanText(nameValue, 3).toLocaleUpperCase("en");
  if (!new Set(["LCP", "INP", "CLS"]).has(name)) throw new Error("Unsupported Core Web Vital");
  const value = number(rawValue, name, { maximum: name === "CLS" ? 10 : 60_000 });
  const good = { LCP: 2_500, INP: 200, CLS: 0.1 }[name];
  const poor = { LCP: 4_000, INP: 500, CLS: 0.25 }[name];
  return { name, value, rating: value <= good ? "GOOD" : value > poor ? "POOR" : "NEEDS_IMPROVEMENT" };
}

function normalizePath(value) {
  const raw = cleanText(value, 500);
  try {
    const parsed = new URL(raw, "https://7tool.ru");
    if (parsed.origin !== "https://7tool.ru") throw new Error();
    return parsed.pathname || "/";
  } catch {
    throw new Error("pagePath must be an internal 7tool.ru path");
  }
}

function normalizePerformancePath(value) {
  const raw = cleanText(value, 500);
  try {
    const parsed = new URL(raw, "https://7tool.ru");
    if (parsed.origin !== "https://7tool.ru" || parsed.username || parsed.password || parsed.hash) throw new Error();
    for (const key of [...parsed.searchParams.keys()]) if (TRACKING_PARAMS.has(key.toLocaleLowerCase("en"))) parsed.searchParams.delete(key);
    parsed.searchParams.sort();
    return `${parsed.pathname || "/"}${parsed.search}`;
  } catch {
    throw new Error("pagePath must be an internal 7tool.ru path");
  }
}

export function recordCoreWebVital(db, rawInput) {
  if (!hasTable(db, "core_web_vital_samples")) return { recorded: false, reason: "SCHEMA_NOT_APPLIED" };
  const metric = classifyCoreWebVital(rawInput.name, rawInput.value);
  const metricId = cleanText(rawInput.metricId, 200);
  if (!/^[A-Za-z0-9._-]{8,200}$/.test(metricId)) throw new Error("Invalid web-vital metric id");
  const pagePath = normalizePath(rawInput.pagePath);
  const candidateNavigation = cleanText(rawInput.navigationType || "UNKNOWN", 30).toLocaleUpperCase("en").replace(/[- ]/g, "_");
  const navigationType = NAVIGATION_TYPES.has(candidateNavigation) ? candidateNavigation : "UNKNOWN";
  const capturedAt = rawInput.capturedAt == null ? Date.now() : integer(rawInput.capturedAt, "capturedAt", 1);
  const id = `cwv-${hash(`${metricId}:${metric.name}:${pagePath}`).slice(0, 28)}`;
  const info = db.prepare(`
    INSERT OR IGNORE INTO core_web_vital_samples (
      id, metric_id, metric_name, page_path, metric_value, rating, navigation_type, captured_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, metricId, metric.name, pagePath, metric.value, metric.rating, navigationType, capturedAt);
  return { recorded: info.changes > 0, id, ...metric, pagePath, navigationType };
}

export function summarizeCoreWebVitals(db, rawInput = {}) {
  requireTable(db, "core_web_vital_samples");
  const pagePath = rawInput.pagePath ? normalizePath(rawInput.pagePath) : null;
  const since = rawInput.since == null ? 0 : integer(rawInput.since, "since", 0);
  const rows = pagePath
    ? db.prepare("SELECT metric_name, metric_value FROM core_web_vital_samples WHERE page_path = ? AND captured_at >= ?").all(pagePath, since)
    : db.prepare("SELECT metric_name, metric_value FROM core_web_vital_samples WHERE captured_at >= ?").all(since);
  return ["LCP", "INP", "CLS"].map((name) => {
    const values = rows.filter((row) => row.metric_name === name).map((row) => row.metric_value).sort((left, right) => left - right);
    if (!values.length) return { name, samples: 0, p75: null, rating: "NO_DATA" };
    const p75 = values[Math.max(0, Math.ceil(values.length * 0.75) - 1)];
    return { ...classifyCoreWebVital(name, p75), samples: values.length, p75 };
  });
}

function requireHuman(value) {
  const actor = cleanText(value, 200);
  if (!actor || /^(?:ai|system|automation)(?:$|[-_: ])/i.test(actor)) throw new Error("Facet policy requires a real human reviewer");
  return actor;
}

export function registerFacetPolicy(db, rawInput) {
  requireTable(db, "facet_indexing_policies");
  requireTable(db, "site_urls");
  const scopePath = normalizePath(rawInput.scopePath);
  if (!scopePath.startsWith("/c/")) throw new Error("Facet scope must be a catalog path");
  const facetKey = cleanText(rawInput.facetKey, 200);
  const facetValue = cleanText(rawInput.facetValue, 300);
  const classification = cleanText(rawInput.classification, 50).toLocaleUpperCase("en");
  if (!facetKey || !facetValue || !Object.values(FACET_CLASSIFICATIONS).includes(classification)) throw new Error("Facet key, value and classification are required");
  const reviewedBy = requireHuman(rawInput.reviewedBy);
  const rationale = cleanText(rawInput.rationale, 1_000);
  if (rationale.length < 10) throw new Error("Facet policy requires a review rationale");
  let landingUrlId = null;
  if (classification === FACET_CLASSIFICATIONS.INDEXABLE) {
    landingUrlId = cleanText(rawInput.landingUrlId, 200);
    const landing = db.prepare("SELECT id, path, page_type, index_status, http_status FROM site_urls WHERE id = ?").get(landingUrlId);
    if (!landing || landing.index_status !== "INDEX" || landing.http_status < 200 || landing.http_status >= 300
      || landing.page_type !== "SEO_LANDING" || landing.path.includes("?") || landing.path === scopePath) {
      throw new Error("INDEXABLE_SEO_LANDING requires a separate live indexable landing URL");
    }
  }
  const active = db.prepare(`
    SELECT * FROM facet_indexing_policies
    WHERE scope_path = ? AND facet_key = ? AND facet_value = ? AND status = 'ACTIVE'
  `).get(scopePath, facetKey, facetValue);
  if (active && active.classification === classification && active.landing_url_id === landingUrlId && active.rationale === rationale) return active;
  const now = rawInput.reviewedAt == null ? Date.now() : integer(rawInput.reviewedAt, "reviewedAt", 1);
  const id = randomUUID();
  db.transaction(() => {
    if (active) db.prepare("UPDATE facet_indexing_policies SET status = 'SUPERSEDED' WHERE id = ?").run(active.id);
    db.prepare(`
      INSERT INTO facet_indexing_policies (
        id, scope_path, facet_key, facet_value, classification, landing_url_id,
        rationale, status, reviewed_by, reviewed_at, supersedes_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?)
    `).run(id, scopePath, facetKey, facetValue, classification, landingUrlId, rationale,
      reviewedBy, now, active?.id ?? null, now);
  })();
  return db.prepare("SELECT * FROM facet_indexing_policies WHERE id = ?").get(id);
}

export function classifyFacet(db, rawInput) {
  const scopePath = normalizePath(rawInput.scopePath);
  const facetKey = cleanText(rawInput.facetKey, 200);
  const facetValue = cleanText(rawInput.facetValue, 300);
  if (!facetKey || !facetValue) throw new Error("Facet key and value are required");
  if (!hasTable(db, "facet_indexing_policies")) return defaultFacetDecision(scopePath, facetKey, facetValue);
  const policy = db.prepare(`
    SELECT p.*, u.path AS landing_path FROM facet_indexing_policies p
    LEFT JOIN site_urls u ON u.id = p.landing_url_id
    WHERE p.scope_path = ? AND p.facet_key = ? AND p.facet_value = ? AND p.status = 'ACTIVE'
  `).get(scopePath, facetKey, facetValue);
  return policy ? {
    scopePath, facetKey, facetValue, classification: policy.classification,
    landingPath: policy.landing_path ?? null, policyId: policy.id, reviewed: true,
  } : defaultFacetDecision(scopePath, facetKey, facetValue);
}

function defaultFacetDecision(scopePath, facetKey, facetValue) {
  return {
    scopePath, facetKey, facetValue, classification: FACET_CLASSIFICATIONS.NON_INDEXABLE,
    landingPath: null, policyId: null, reviewed: false,
  };
}

export function auditFacetDefinitions(db, input) {
  const scopePath = normalizePath(input.scopePath);
  return (Array.isArray(input.facets) ? input.facets : []).map((facet) => classifyFacet(db, {
    scopePath, facetKey: facet.key, facetValue: facet.value,
  }));
}
