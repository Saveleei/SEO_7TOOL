import { createHash } from "node:crypto";
import { importKeywordBatch, normalizeKeyword, persistConservativeClusters } from "./semantic-intelligence.mjs";

export const YANDEX_OPPORTUNITY_MODEL_VERSION = "yandex-query-opportunity-v1";
export const YANDEX_DATASETS = Object.freeze({
  WEBMASTER: "WEBMASTER_URL_QUERIES",
  WORDSTAT: "WORDSTAT_DEMAND",
  METRIKA: "METRIKA_ORGANIC_LANDINGS",
});

const TRACKING_PARAMS = new Set([
  "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
  "yclid", "gclid", "fbclid", "_openstat", "roistat",
]);
const WEBMASTER_DEVICES = new Set(["ALL", "DESKTOP", "MOBILE_AND_TABLET", "MOBILE", "TABLET", "UNKNOWN"]);
const WORDSTAT_DEVICES = new Set(["ALL", "DESKTOP", "PHONE", "TABLET"]);
const ACQUISITION_METHODS = new Set([
  "YANDEX_WEBMASTER_API", "YANDEX_WORDSTAT_API", "YANDEX_METRIKA_REPORTS_API", "OFFICIAL_EXPORT",
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

function cleanText(value, limit = 1_000) {
  return String(value ?? "").normalize("NFKC").replace(/<[^>]+>/g, " ")
    .replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

function dateOnly(value, name) {
  const result = cleanText(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) throw new Error(`${name} must use YYYY-MM-DD`);
  const date = new Date(`${result}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== result) throw new Error(`${name} must be a real calendar date`);
  return result;
}

function number(value, name, { minimum = 0, maximum = Number.POSITIVE_INFINITY, optional = false } = {}) {
  if (optional && (value === undefined || value === null || String(value).trim() === "")) return null;
  const raw = String(value ?? "").trim();
  const parsed = raw.endsWith("%")
    ? Number(raw.slice(0, -1).replace(/\s/g, "").replace(",", ".")) / 100
    : Number(raw.replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) throw new Error(`${name} must be between ${minimum} and ${maximum}`);
  return parsed;
}

function optionalYandexMetric(value) {
  const marker = cleanText(value, 50).toLocaleLowerCase("ru");
  if (/^(?:-|—|n\/?a|not defined|undefined|не определено)$/.test(marker)) return null;
  return value;
}

function integer(value, name, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) throw new Error(`${name} must be an integer from ${minimum} to ${maximum}`);
  return parsed;
}

function integerMetric(value, name, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = number(value, name, { maximum });
  if (!Number.isInteger(parsed)) throw new Error(`${name} must be an integer`);
  return parsed;
}

function normalizeQuery(value, { optional = false } = {}) {
  const queryText = cleanText(value, 500);
  if (!queryText) {
    if (optional) return { queryText: null, queryHash: null, normalizedQuery: null };
    throw new Error("Yandex query must contain 1 to 500 characters");
  }
  const normalizedQuery = normalizeKeyword(queryText);
  if (!normalizedQuery) throw new Error("Yandex query must contain searchable text");
  return { queryText, normalizedQuery, queryHash: hash(normalizedQuery) };
}

function normalizePage(value) {
  let parsed;
  try { parsed = new URL(String(value)); } catch { throw new Error("Yandex page must be an absolute 7tool.ru URL"); }
  if (!/^(?:http|https):$/.test(parsed.protocol) || !/^(?:www\.)?7tool\.ru$/i.test(parsed.hostname)
    || parsed.username || parsed.password) throw new Error("Yandex page must belong to 7tool.ru without credentials");
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

function normalizeInternalPath(value) {
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

function normalizeSubjectRef(sourceSystem, value) {
  const subject = cleanText(value, 300);
  if (sourceSystem === "YANDEX_WEBMASTER") {
    if (/^(?:www\.)?7tool\.ru$/i.test(subject)) return "https://7tool.ru/";
    try {
      const parsed = new URL(subject);
      if (!/^https?:$/.test(parsed.protocol) || !/^(?:www\.)?7tool\.ru$/i.test(parsed.hostname)
        || parsed.username || parsed.password || parsed.port || parsed.pathname !== "/" || parsed.search || parsed.hash) throw new Error();
      return "https://7tool.ru/";
    } catch { throw new Error("Yandex Webmaster subject must identify only 7tool.ru"); }
  }
  if (sourceSystem === "YANDEX_METRIKA") return String(integer(subject, "Metrica counter id", 1));
  if (!subject || /(?:oauth|token|password|secret)/i.test(subject)) throw new Error("Wordstat subject reference is invalid");
  try {
    const parsed = new URL(subject);
    if (parsed.username || parsed.password) throw new Error("Wordstat subject reference must not contain credentials");
  } catch (error) {
    if (error instanceof Error && /credentials/.test(error.message)) throw error;
  }
  return subject;
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

function normalizeAcquisition(value, allowed) {
  const method = cleanText(value, 50).toLocaleUpperCase("en");
  if (!ACQUISITION_METHODS.has(method) || !allowed.has(method)) throw new Error("Unsupported Yandex acquisition method for this dataset");
  return method;
}

function normalizeDigest(value) {
  const digest = cleanText(value, 64).toLocaleLowerCase("en");
  if (!/^[a-f0-9]{64}$/.test(digest)) throw new Error("sourceSha256 must be a SHA-256 hex digest");
  return digest;
}

function normalizePeriod(input) {
  const periodStart = dateOnly(input.periodStart, "periodStart");
  const periodEnd = dateOnly(input.periodEnd, "periodEnd");
  if (periodEnd < periodStart) throw new Error("periodEnd must not precede periodStart");
  return { periodStart, periodEnd };
}

function normalizeImportedAt(value) {
  return value == null ? Date.now() : integer(value, "importedAt", 1);
}

function normalizeRows(value) {
  if (!Array.isArray(value) || !value.length) throw new Error("Yandex import must contain at least one row");
  return value;
}

function requireTables(db, names) {
  const present = new Set(db.prepare("SELECT name FROM sqlite_schema WHERE type = 'table'").all().map((row) => row.name));
  const missing = names.filter((name) => !present.has(name));
  if (missing.length) throw new Error(`Yandex SEO schema is not applied: ${missing.join(", ")}`);
}

function assertUniqueRows(rows) {
  if (new Set(rows.map((row) => row.rowChecksum)).size !== rows.length) throw new Error("Yandex import contains duplicate rows at the declared grain");
}

function assertUniqueGrain(rows, keyForRow, label) {
  if (new Set(rows.map(keyForRow)).size !== rows.length) throw new Error(`${label} import contains duplicate dimension grain`);
}

function runIdentity(input, rows) {
  return hash(canonical({
    sourceSystem: input.sourceSystem, datasetType: input.datasetType, subjectRef: input.subjectRef,
    periodStart: input.periodStart, periodEnd: input.periodEnd, dimensions: input.dimensions,
    metrics: input.metrics, acquisitionMethod: input.acquisitionMethod, sourceRef: input.sourceRef,
    sourceSha256: input.sourceSha256, rowChecksums: rows.map((row) => row.rowChecksum).sort(),
    semanticMirror: input.mirrorSemantic ?? null, semanticSourceId: input.semanticSourceId ?? null,
  }));
}

function insertImportRun(db, input, semanticImportRunId = null) {
  const id = `yandex-${input.runChecksum.slice(0, 28)}`;
  db.prepare(`
    INSERT INTO yandex_import_runs (
      id, source_system, dataset_type, subject_ref, period_start, period_end,
      dimensions_json, metrics_json, acquisition_method, source_ref, source_sha256,
      run_checksum, row_count, semantic_import_run_id, status, imported_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETE', ?)
  `).run(id, input.sourceSystem, input.datasetType, input.subjectRef, input.periodStart, input.periodEnd,
    JSON.stringify(input.dimensions), JSON.stringify(input.metrics), input.acquisitionMethod,
    input.sourceRef, input.sourceSha256, input.runChecksum, input.rows.length, semanticImportRunId, input.importedAt);
  return id;
}

function duplicateRun(db, runChecksum) {
  return db.prepare("SELECT * FROM yandex_import_runs WHERE run_checksum = ?").get(runChecksum);
}

function normalizeWebmasterDevice(value) {
  const device = cleanText(value || "UNKNOWN", 30).toLocaleUpperCase("en").replace(/[- ]/g, "_");
  if (!WEBMASTER_DEVICES.has(device)) throw new Error("Unsupported Yandex Webmaster device");
  return device;
}

export function validateYandexWebmasterImport(rawInput) {
  const sourceSystem = "YANDEX_WEBMASTER";
  const datasetType = YANDEX_DATASETS.WEBMASTER;
  const { periodStart, periodEnd } = normalizePeriod(rawInput);
  const subjectRef = normalizeSubjectRef(sourceSystem, rawInput.subjectRef || "https://7tool.ru/");
  const acquisitionMethod = normalizeAcquisition(rawInput.acquisitionMethod || "OFFICIAL_EXPORT",
    new Set(["YANDEX_WEBMASTER_API", "OFFICIAL_EXPORT"]));
  const sourceRef = cleanSourceRef(rawInput.sourceRef);
  const sourceSha256 = normalizeDigest(rawInput.sourceSha256);
  const importedAt = normalizeImportedAt(rawInput.importedAt);
  const defaultDevice = normalizeWebmasterDevice(rawInput.device || "UNKNOWN");
  const rows = normalizeRows(rawInput.rows).map((row) => {
    const dataDate = dateOnly(row.date, "Webmaster row date");
    if (dataDate < periodStart || dataDate > periodEnd) throw new Error("Webmaster row date is outside the import period");
    const query = normalizeQuery(row.query);
    const page = normalizePage(row.page ?? row.url);
    const impressions = number(row.impressions ?? row.shows, "Webmaster impressions");
    const clicks = number(row.clicks, "Webmaster clicks", { maximum: impressions });
    const expectedCtr = impressions > 0 ? clicks / impressions : 0;
    const ctr = row.ctr == null || String(row.ctr).trim() === "" ? expectedCtr : number(row.ctr, "Webmaster CTR", { maximum: 1 });
    if (Math.abs(expectedCtr - ctr) > 0.005) throw new Error("Webmaster CTR does not match clicks/impressions");
    const averagePosition = number(optionalYandexMetric(row.position ?? row.averagePosition), "Webmaster position", { optional: true });
    const regionId = integer(row.regionId ?? row.region ?? 0, "Webmaster region id", 0);
    const normalized = {
      dataDate, ...query, ...page, queryId: cleanText(row.queryId, 200) || null,
      regionId, device: normalizeWebmasterDevice(row.device || defaultDevice), impressions,
      clicks, ctr, averagePosition,
    };
    return { ...normalized, rowChecksum: hash(canonical(normalized)) };
  });
  assertUniqueRows(rows);
  assertUniqueGrain(rows, (row) => canonical([
    row.dataDate, row.pageUrl, row.queryHash, row.regionId, row.device,
  ]), "Webmaster");
  const input = {
    sourceSystem, datasetType, subjectRef, periodStart, periodEnd,
    dimensions: ["date", "page", "query", "region", "device"],
    metrics: ["impressions", "clicks", "ctr", "average_position"],
    acquisitionMethod, sourceRef, sourceSha256, importedAt, rows,
  };
  return { ...input, runChecksum: runIdentity(input, rows) };
}

export function importYandexWebmaster(db, rawInput) {
  requireTables(db, ["yandex_import_runs", "yandex_webmaster_performance_daily"]);
  const input = validateYandexWebmasterImport(rawInput);
  const existing = duplicateRun(db, input.runChecksum);
  if (existing) return { run: existing, importedRows: 0, duplicate: true };
  let id;
  db.transaction(() => {
    id = insertImportRun(db, input);
    const insert = db.prepare(`
      INSERT INTO yandex_webmaster_performance_daily (
        id, run_id, data_date, query_id, query_text, query_hash, page_url, page_path,
        route_path, region_id, device, impressions, clicks, ctr, average_position,
        is_facet, row_checksum, imported_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    input.rows.forEach((row, index) => insert.run(
      `ywm-row-${hash(`${input.runChecksum}:${row.rowChecksum}:${index}`).slice(0, 28)}`, id,
      row.dataDate, row.queryId, row.queryText, row.queryHash, row.pageUrl, row.pagePath,
      row.routePath, row.regionId, row.device, row.impressions, row.clicks, row.ctr,
      row.averagePosition, row.isFacet ? 1 : 0, row.rowChecksum, input.importedAt,
    ));
  })();
  return { run: db.prepare("SELECT * FROM yandex_import_runs WHERE id = ?").get(id), importedRows: input.rows.length, duplicate: false };
}

function normalizeWordstatDevice(value) {
  const aliases = { MOBILE: "PHONE", MOBILE_PHONE: "PHONE" };
  const raw = cleanText(value || "ALL", 30).toLocaleUpperCase("en").replace(/[- ]/g, "_");
  const device = aliases[raw] || raw;
  if (!WORDSTAT_DEVICES.has(device)) throw new Error("Unsupported Wordstat device");
  return device;
}

function normalizeRegionIds(value) {
  const source = Array.isArray(value) ? value : String(value ?? "").split(",").filter(Boolean);
  return [...new Set(source.map((item) => integer(item, "Wordstat region id", 0)))].sort((left, right) => left - right);
}

function safeSourceId(value) {
  const normalized = cleanText(value, 100).toLocaleLowerCase("en").replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!normalized) throw new Error("Wordstat semantic source id is invalid");
  return normalized;
}

export function validateYandexWordstatImport(rawInput) {
  const sourceSystem = "WORDSTAT";
  const datasetType = YANDEX_DATASETS.WORDSTAT;
  const { periodStart, periodEnd } = normalizePeriod(rawInput);
  const subjectRef = normalizeSubjectRef(sourceSystem, rawInput.subjectRef || "wordstat:7tool.ru");
  const acquisitionMethod = normalizeAcquisition(rawInput.acquisitionMethod || "OFFICIAL_EXPORT",
    new Set(["YANDEX_WORDSTAT_API", "OFFICIAL_EXPORT"]));
  const sourceRef = cleanSourceRef(rawInput.sourceRef);
  const sourceSha256 = normalizeDigest(rawInput.sourceSha256);
  const importedAt = normalizeImportedAt(rawInput.importedAt);
  const seedPhrase = cleanText(rawInput.seedPhrase, 500);
  if (!seedPhrase) throw new Error("Wordstat seedPhrase is required");
  const regionIds = normalizeRegionIds(rawInput.regionIds);
  const regionKey = cleanText(rawInput.regionKey || "RU", 100).toLocaleUpperCase("en");
  if (!/^[A-Z0-9_-]{1,100}$/.test(regionKey)) throw new Error("Wordstat regionKey is invalid");
  const device = normalizeWordstatDevice(rawInput.device || "ALL");
  const defaultCategory = cleanText(rawInput.categorySlug, 200) || null;
  const rows = normalizeRows(rawInput.rows).map((row) => {
    const query = normalizeQuery(row.query ?? row.phrase);
    const categorySlug = cleanText(row.categorySlug || defaultCategory, 200) || null;
    const normalized = {
      ...query, seedPhrase, regionIds, regionKey, device,
      demandCount: integerMetric(row.demandCount ?? row.count ?? row.frequency, "Wordstat demand"),
      sourceKeywordId: cleanText(row.sourceKeywordId ?? row.id, 200) || null,
      categorySlug,
    };
    return { ...normalized, rowChecksum: hash(canonical(normalized)) };
  });
  assertUniqueRows(rows);
  assertUniqueGrain(rows, (row) => canonical([
    row.queryHash, row.seedPhrase, row.regionIds, row.device, row.categorySlug,
  ]), "Wordstat");
  const input = {
    sourceSystem, datasetType, subjectRef, periodStart, periodEnd,
    dimensions: ["query", "region_ids", "device"], metrics: ["demand_count"],
    acquisitionMethod, sourceRef, sourceSha256, importedAt, rows, seedPhrase,
    regionIds, regionKey, device, mirrorSemantic: rawInput.mirrorSemantic !== false,
    semanticSourceId: safeSourceId(rawInput.semanticSourceId || `wordstat-${regionKey.toLocaleLowerCase("en")}-${device.toLocaleLowerCase("en")}`),
  };
  return { ...input, runChecksum: runIdentity(input, rows) };
}

export function importYandexWordstat(db, rawInput) {
  requireTables(db, ["yandex_import_runs", "yandex_wordstat_demand"]);
  const input = validateYandexWordstatImport(rawInput);
  const existing = duplicateRun(db, input.runChecksum);
  if (existing) return { run: existing, importedRows: 0, duplicate: true, semantic: null, clusters: [] };
  if (input.mirrorSemantic) requireTables(db, ["sources", "import_runs", "site_urls", "seo_keywords", "keyword_clusters", "search_intents"]);
  const semanticSource = input.mirrorSemantic
    ? db.prepare("SELECT source_type FROM sources WHERE id = ?").get(input.semanticSourceId)
    : null;
  if (semanticSource && semanticSource.source_type !== "WORDSTAT") {
    throw new Error("Wordstat semantic source id is already owned by another source type");
  }
  let id;
  let semantic = null;
  let clusters = [];
  db.transaction(() => {
    if (input.mirrorSemantic) {
      semantic = importKeywordBatch(db, {
        sourceType: "WORDSTAT", sourceId: input.semanticSourceId, sourceName: "Yandex Wordstat",
        region: input.regionKey, language: "ru", parserVersion: "yandex-wordstat-v1",
        rows: input.rows.map((row) => ({
          query: row.queryText, frequency: row.demandCount, categorySlug: row.categorySlug,
          sourceKeywordId: row.sourceKeywordId,
        })),
      });
      const categories = [...new Set(input.rows.map((row) => row.categorySlug).filter(Boolean))];
      clusters = categories.map((categorySlug) => ({
        categorySlug,
        count: persistConservativeClusters(db, { categorySlug, sourceId: input.semanticSourceId }).length,
      }));
    }
    id = insertImportRun(db, input, semantic?.runId ?? null);
    const insert = db.prepare(`
      INSERT INTO yandex_wordstat_demand (
        id, run_id, query_text, query_hash, seed_phrase, region_ids_json, region_key,
        device, demand_count, source_keyword_id, category_slug, row_checksum, imported_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    input.rows.forEach((row, index) => insert.run(
      `yws-row-${hash(`${input.runChecksum}:${row.rowChecksum}:${index}`).slice(0, 28)}`, id,
      row.queryText, row.queryHash, row.seedPhrase, JSON.stringify(row.regionIds), row.regionKey,
      row.device, row.demandCount, row.sourceKeywordId, row.categorySlug, row.rowChecksum, input.importedAt,
    ));
  })();
  return {
    run: db.prepare("SELECT * FROM yandex_import_runs WHERE id = ?").get(id),
    importedRows: input.rows.length, duplicate: false, semantic, clusters,
  };
}

function normalizeBounceRate(value, unit = "PERCENT") {
  const raw = String(value ?? "").trim();
  if (!raw) throw new Error("Metrica bounce rate is required");
  if (raw.endsWith("%")) return number(raw, "Metrica bounce rate", { maximum: 1 });
  if (unit === "RATIO") return number(raw, "Metrica bounce rate", { maximum: 1 });
  if (unit !== "PERCENT") throw new Error("Metrica bounceRateUnit must be PERCENT or RATIO");
  return number(raw, "Metrica bounce rate", { maximum: 100 }) / 100;
}

export function validateYandexMetricaImport(rawInput) {
  const sourceSystem = "YANDEX_METRIKA";
  const datasetType = YANDEX_DATASETS.METRIKA;
  const { periodStart, periodEnd } = normalizePeriod(rawInput);
  const subjectRef = normalizeSubjectRef(sourceSystem, rawInput.counterId ?? rawInput.subjectRef);
  const acquisitionMethod = normalizeAcquisition(rawInput.acquisitionMethod || "OFFICIAL_EXPORT",
    new Set(["YANDEX_METRIKA_REPORTS_API", "OFFICIAL_EXPORT"]));
  const sourceRef = cleanSourceRef(rawInput.sourceRef);
  const sourceSha256 = normalizeDigest(rawInput.sourceSha256);
  const importedAt = normalizeImportedAt(rawInput.importedAt);
  const bounceRateUnit = cleanText(rawInput.bounceRateUnit || "PERCENT", 20).toLocaleUpperCase("en");
  const rows = normalizeRows(rawInput.rows).map((row) => {
    const dataDate = dateOnly(row.date, "Metrica row date");
    if (dataDate < periodStart || dataDate > periodEnd) throw new Error("Metrica row date is outside the import period");
    const page = normalizePage(row.page ?? row.url ?? row.startUrl);
    const query = normalizeQuery(row.query ?? row.searchPhrase, { optional: true });
    const visits = integerMetric(row.visits, "Metrica visits");
    const users = integerMetric(row.users, "Metrica users", visits);
    const pageviews = integerMetric(row.pageviews ?? row.pageViews, "Metrica pageviews");
    if (pageviews < visits) throw new Error("Metrica pageviews cannot be lower than visits");
    const searchEngine = cleanText(row.searchEngine || "Yandex", 100);
    if (!searchEngine) throw new Error("Metrica search engine is required");
    const normalized = {
      dataDate, ...page, ...query, searchEngine, visits, users, pageviews,
      bounceRate: normalizeBounceRate(row.bounceRate, bounceRateUnit),
    };
    return { ...normalized, rowChecksum: hash(canonical(normalized)) };
  });
  assertUniqueRows(rows);
  assertUniqueGrain(rows, (row) => canonical([
    row.dataDate, row.pageUrl, row.searchEngine.toLocaleLowerCase("ru"), row.queryHash,
  ]), "Metrica");
  const input = {
    sourceSystem, datasetType, subjectRef, periodStart, periodEnd,
    dimensions: ["date", "start_url", "search_engine", "search_phrase"],
    metrics: ["visits", "users", "pageviews", "bounce_rate"],
    acquisitionMethod, sourceRef, sourceSha256, importedAt, rows,
  };
  return { ...input, runChecksum: runIdentity(input, rows) };
}

export function importYandexMetrica(db, rawInput) {
  requireTables(db, ["yandex_import_runs", "yandex_metrica_organic_daily"]);
  const input = validateYandexMetricaImport(rawInput);
  const existing = duplicateRun(db, input.runChecksum);
  if (existing) return { run: existing, importedRows: 0, duplicate: true };
  let id;
  db.transaction(() => {
    id = insertImportRun(db, input);
    const insert = db.prepare(`
      INSERT INTO yandex_metrica_organic_daily (
        id, run_id, data_date, page_url, page_path, route_path, search_engine,
        query_text, query_hash, visits, users, pageviews, bounce_rate, row_checksum, imported_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    input.rows.forEach((row, index) => insert.run(
      `ym-row-${hash(`${input.runChecksum}:${row.rowChecksum}:${index}`).slice(0, 28)}`, id,
      row.dataDate, row.pageUrl, row.pagePath, row.routePath, row.searchEngine,
      row.queryText, row.queryHash, row.visits, row.users, row.pageviews, row.bounceRate,
      row.rowChecksum, input.importedAt,
    ));
  })();
  return { run: db.prepare("SELECT * FROM yandex_import_runs WHERE id = ?").get(id), importedRows: input.rows.length, duplicate: false };
}

export function buildWordstatTopRequestsRequest(input) {
  const phrase = cleanText(input.phrase, 500);
  if (!phrase) throw new Error("Wordstat phrase is required");
  const regions = normalizeRegionIds(input.regionIds);
  const devices = (Array.isArray(input.devices) ? input.devices : [input.devices || "ALL"])
    .map(normalizeWordstatDevice).map((device) => device.toLocaleLowerCase("en"));
  return {
    method: "POST",
    url: "https://api.wordstat.yandex.net/v1/topRequests",
    headers: { "Content-Type": "application/json" },
    body: { phrase, ...(regions.length ? { regions } : {}), devices: [...new Set(devices)] },
  };
}

export function buildMetricaOrganicReportRequest(input) {
  const counterId = integer(input.counterId, "Metrica counter id", 1);
  const startDate = dateOnly(input.startDate, "startDate");
  const endDate = dateOnly(input.endDate, "endDate");
  if (endDate < startDate) throw new Error("endDate must not precede startDate");
  return {
    method: "GET",
    url: "https://api-metrika.yandex.net/stat/v1/data",
    params: {
      ids: String(counterId), date1: startDate, date2: endDate, accuracy: "full", lang: "ru",
      dimensions: "ym:s:date,ym:s:startURL,ym:s:lastsignSearchEngineRoot,ym:s:lastsignSearchPhrase",
      metrics: "ym:s:visits,ym:s:users,ym:s:pageviews,ym:s:bounceRate",
      filters: "ym:s:lastsignTrafficSource=='organic'",
      limit: 100_000,
    },
  };
}

export function webmasterEnhancedExportContract() {
  return {
    source: "YANDEX_WEBMASTER",
    dataset: YANDEX_DATASETS.WEBMASTER,
    dimensions: ["date", "page", "query", "region", "device"],
    metrics: ["impressions", "clicks", "ctr", "average_position"],
    requiresUrlGrain: true,
    standardPopularQueriesEndpointIsInsufficient: true,
  };
}

function validateOpportunityInput(input) {
  const { periodStart, periodEnd } = normalizePeriod(input);
  const minWordstatDemand = number(input.minWordstatDemand, "minWordstatDemand");
  const minWebmasterImpressions = number(input.minWebmasterImpressions, "minWebmasterImpressions");
  const regionKey = cleanText(input.regionKey || "RU", 100).toLocaleUpperCase("en");
  if (!/^[A-Z0-9_-]{1,100}$/.test(regionKey)) throw new Error("regionKey is invalid");
  const wordstatDevice = normalizeWordstatDevice(input.wordstatDevice || "ALL");
  const categorySlug = cleanText(input.categorySlug, 200) || null;
  const wordstatSubjectRef = normalizeSubjectRef("WORDSTAT", input.wordstatSubjectRef || "wordstat:7tool.ru");
  const metricaCounterId = normalizeSubjectRef("YANDEX_METRIKA", input.metricaCounterId || 109097461);
  return {
    periodStart, periodEnd, minWordstatDemand, minWebmasterImpressions, regionKey,
    wordstatDevice, categorySlug, wordstatSubjectRef, metricaCounterId,
  };
}

export function discoverYandexQueryOpportunities(db, rawInput) {
  requireTables(db, [
    "yandex_import_runs", "yandex_webmaster_performance_daily", "yandex_wordstat_demand",
    "yandex_metrica_organic_daily", "site_urls",
  ]);
  const input = validateOpportunityInput(rawInput);
  const wordstat = db.prepare(`
    WITH ranked AS (
      SELECT w.*, r.period_start, r.period_end, r.imported_at AS run_imported_at,
        ROW_NUMBER() OVER (
          PARTITION BY w.query_hash, w.seed_phrase, w.region_key, w.device
          ORDER BY r.imported_at DESC, r.id DESC
        ) AS freshness_rank
      FROM yandex_wordstat_demand w
      JOIN yandex_import_runs r ON r.id = w.run_id AND r.status = 'COMPLETE'
      WHERE w.region_key = ? AND w.device = ? AND r.subject_ref = ?
        AND r.period_end >= ? AND r.period_start <= ?
        AND (? IS NULL OR w.category_slug = ?)
    )
    SELECT query_hash, MIN(query_text) AS query_text, category_slug,
      MAX(demand_count) AS demand_count, GROUP_CONCAT(DISTINCT run_id) AS source_run_ids
    FROM ranked WHERE freshness_rank = 1
    GROUP BY query_hash, category_slug HAVING MAX(demand_count) >= ?
    ORDER BY demand_count DESC, query_text
  `).all(input.regionKey, input.wordstatDevice, input.wordstatSubjectRef, input.periodStart, input.periodEnd,
    input.categorySlug, input.categorySlug, input.minWordstatDemand);
  const demandByQuery = new Map();
  for (const row of wordstat) {
    const current = demandByQuery.get(row.query_hash);
    if (!current || row.demand_count > current.demand_count) demandByQuery.set(row.query_hash, row);
  }
  const webmasterRows = db.prepare(`
    WITH ranked AS (
      SELECT p.*, r.imported_at AS run_imported_at,
        ROW_NUMBER() OVER (
          PARTITION BY p.data_date, p.page_url, p.query_hash, p.region_id, p.device
          ORDER BY r.imported_at DESC, r.id DESC
        ) AS freshness_rank
      FROM yandex_webmaster_performance_daily p
      JOIN yandex_import_runs r ON r.id = p.run_id AND r.status = 'COMPLETE'
      WHERE p.data_date BETWEEN ? AND ? AND p.is_facet = 0
    ), fresh AS (SELECT * FROM ranked WHERE freshness_rank = 1)
    SELECT u.id AS existing_url_id, fresh.page_path, fresh.query_hash,
      MIN(fresh.query_text) AS query_text, SUM(fresh.impressions) AS impressions,
      SUM(fresh.clicks) AS clicks, SUM(fresh.clicks) / NULLIF(SUM(fresh.impressions), 0) AS ctr,
      SUM(CASE WHEN fresh.average_position IS NOT NULL THEN fresh.average_position * fresh.impressions ELSE 0 END)
        / NULLIF(SUM(CASE WHEN fresh.average_position IS NOT NULL THEN fresh.impressions ELSE 0 END), 0) AS average_position,
      GROUP_CONCAT(DISTINCT fresh.run_id) AS source_run_ids
    FROM fresh JOIN site_urls u ON u.path = fresh.page_path
      AND u.index_status = 'INDEX' AND u.http_status BETWEEN 200 AND 299
    GROUP BY u.id, fresh.page_path, fresh.query_hash
    HAVING SUM(fresh.impressions) >= ?
    ORDER BY impressions DESC, fresh.page_path, query_text
  `).all(input.periodStart, input.periodEnd, input.minWebmasterImpressions);
  const webmaster = input.categorySlug
    ? webmasterRows.filter((row) => demandByQuery.has(row.query_hash))
    : webmasterRows;
  const metrica = db.prepare(`
    WITH ranked AS (
      SELECT m.*, r.imported_at AS run_imported_at,
        ROW_NUMBER() OVER (
          PARTITION BY m.data_date, m.page_url, m.search_engine, COALESCE(m.query_hash, '')
          ORDER BY r.imported_at DESC, r.id DESC
        ) AS freshness_rank
      FROM yandex_metrica_organic_daily m
      JOIN yandex_import_runs r ON r.id = m.run_id AND r.status = 'COMPLETE'
      WHERE m.data_date BETWEEN ? AND ? AND m.query_hash IS NOT NULL
        AND r.subject_ref = ?
        AND LOWER(m.search_engine) LIKE '%yandex%'
    )
    SELECT page_path, query_hash, SUM(visits) AS visits,
      GROUP_CONCAT(DISTINCT run_id) AS source_run_ids
    FROM ranked WHERE freshness_rank = 1 GROUP BY page_path, query_hash
  `).all(input.periodStart, input.periodEnd, input.metricaCounterId);
  const metricaByKey = new Map(metrica.map((row) => [`${row.page_path}\u0000${row.query_hash}`, row]));
  const existingQueryHashes = new Set(webmaster.map((row) => row.query_hash));
  const existing = webmaster.map((row) => {
    const demand = demandByQuery.get(row.query_hash);
    const behavior = metricaByKey.get(`${row.page_path}\u0000${row.query_hash}`);
    const sourceRunIds = [...new Set([
      ...String(row.source_run_ids || "").split(","),
      ...String(demand?.source_run_ids || "").split(","),
      ...String(behavior?.source_run_ids || "").split(","),
    ].filter(Boolean))].sort();
    return {
      queryText: row.query_text, queryHash: row.query_hash, categorySlug: demand?.category_slug ?? null,
      existingUrlId: row.existing_url_id, pagePath: row.page_path,
      periodStart: input.periodStart, periodEnd: input.periodEnd,
      wordstatDemand: demand?.demand_count ?? null, webmasterImpressions: row.impressions,
      webmasterClicks: row.clicks, webmasterCtr: row.ctr, webmasterPosition: row.average_position,
      metricaOrganicVisits: behavior?.visits ?? null,
      discoveryBasis: "WEBMASTER_EXISTING_PERFORMANCE", recommendedAction: "UPDATE_EXISTING",
      sourceRunIds, status: "REVIEW_REQUIRED", modelVersion: YANDEX_OPPORTUNITY_MODEL_VERSION,
    };
  });
  const demandOnly = wordstat.filter((row) => !existingQueryHashes.has(row.query_hash)).map((row) => ({
    queryText: row.query_text, queryHash: row.query_hash, categorySlug: row.category_slug ?? null,
    existingUrlId: null, pagePath: null, periodStart: input.periodStart, periodEnd: input.periodEnd,
    wordstatDemand: row.demand_count, webmasterImpressions: null, webmasterClicks: null,
    webmasterCtr: null, webmasterPosition: null, metricaOrganicVisits: null,
    discoveryBasis: "WORDSTAT_DEMAND", recommendedAction: "DEMAND_REVIEW",
    sourceRunIds: [...new Set(String(row.source_run_ids || "").split(",").filter(Boolean))].sort(),
    status: "REVIEW_REQUIRED", modelVersion: YANDEX_OPPORTUNITY_MODEL_VERSION,
  }));
  return [...existing, ...demandOnly];
}

export function materializeYandexQueryOpportunities(db, rawInput) {
  requireTables(db, ["yandex_query_opportunity_snapshots"]);
  const items = discoverYandexQueryOpportunities(db, rawInput);
  const evaluatedAt = rawInput.evaluatedAt == null ? Date.now() : integer(rawInput.evaluatedAt, "evaluatedAt", 1);
  const insert = db.prepare(`
    INSERT OR IGNORE INTO yandex_query_opportunity_snapshots (
      id, query_text, query_hash, category_slug, existing_url_id, page_path,
      period_start, period_end, wordstat_demand, webmaster_impressions, webmaster_clicks,
      webmaster_ctr, webmaster_position, metrica_organic_visits, discovery_basis,
      recommended_action, source_run_ids_json, evidence_checksum, status, model_version, evaluated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'REVIEW_REQUIRED', ?, ?)
  `);
  let saved = 0;
  db.transaction(() => {
    for (const item of items) {
      const evidenceChecksum = hash(canonical(item));
      const info = insert.run(
        `yandex-opp-${evidenceChecksum.slice(0, 24)}`, item.queryText, item.queryHash,
        item.categorySlug, item.existingUrlId, item.pagePath, item.periodStart, item.periodEnd,
        item.wordstatDemand, item.webmasterImpressions, item.webmasterClicks, item.webmasterCtr,
        item.webmasterPosition, item.metricaOrganicVisits, item.discoveryBasis,
        item.recommendedAction, JSON.stringify(item.sourceRunIds), evidenceChecksum,
        item.modelVersion, evaluatedAt,
      );
      saved += info.changes;
    }
  })();
  return { items, saved };
}

export function listYandexWebmasterPerformanceForUrl(db, rawInput) {
  requireTables(db, ["yandex_webmaster_performance_daily", "yandex_import_runs"]);
  const pagePath = normalizeInternalPath(rawInput.pagePath);
  const { periodStart, periodEnd } = normalizePeriod(rawInput);
  const limit = integer(rawInput.limit ?? 1_000, "limit", 1, 10_000);
  return db.prepare(`
    WITH ranked AS (
      SELECT p.*, ROW_NUMBER() OVER (
        PARTITION BY p.data_date, p.page_url, p.query_hash, p.region_id, p.device
        ORDER BY r.imported_at DESC, r.id DESC
      ) AS freshness_rank
      FROM yandex_webmaster_performance_daily p
      JOIN yandex_import_runs r ON r.id = p.run_id
      WHERE p.page_path = ? AND p.data_date BETWEEN ? AND ?
    )
    SELECT data_date AS date, page_url AS pageUrl, query_text AS query, region_id AS regionId,
      device, impressions, clicks, ctr, average_position AS position, is_facet AS isFacet
    FROM ranked WHERE freshness_rank = 1
    ORDER BY data_date DESC, impressions DESC, query_text LIMIT ?
  `).all(pagePath, periodStart, periodEnd, limit);
}
