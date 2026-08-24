import { createHash } from "node:crypto";

export const PHASE18_ANALYTICS_EVENTS = Object.freeze([
  "ARTICLE_VIEW",
  "ARTICLE_50_SCROLL",
  "ARTICLE_90_SCROLL",
  "PRODUCT_CLICK_FROM_ARTICLE",
  "CATEGORY_CLICK_FROM_ARTICLE",
  "CALCULATOR_START",
  "CALCULATOR_COMPLETE",
  "SELECTOR_START",
  "SELECTOR_COMPLETE",
  "LEAD_FORM_OPEN",
  "LEAD_FORM_SUCCESS",
  "PHONE_CLICK",
  "EMAIL_CLICK",
]);

export const ANALYTICS_PAGE_METRICS = Object.freeze([
  ...PHASE18_ANALYTICS_EVENTS,
  "ORGANIC_PRODUCT_VIEWS",
]);

export const ANALYTICS_INTELLIGENCE_MODEL_VERSION = "analytics-intelligence-v1";

const EVENT_SET = new Set(PHASE18_ANALYTICS_EVENTS);
const PAGE_METRIC_SET = new Set(ANALYTICS_PAGE_METRICS);
const PAGE_TYPES = new Set(["ARTICLE", "TOOL", "PRODUCT", "CATEGORY", "LANDING", "OTHER"]);
const OUTCOME_TYPES = new Set(["QUALIFIED_LEAD", "QUOTE", "ORDER"]);
const FORBIDDEN_BUSINESS_FIELDS = [
  "name", "phone", "email", "company", "inn", "message", "address",
  "clientid", "sessionid", "cookie", "ipaddress", "useragent",
];

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
  const parsed = new Date(`${result}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== result) throw new Error(`${name} must be a real calendar date`);
  return result;
}

function integer(value, name, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) throw new Error(`${name} must be an integer from ${minimum} to ${maximum}`);
  return parsed;
}

function timestamp(value, name) {
  if (typeof value === "number") return integer(value, name, 1);
  const parsed = new Date(cleanText(value, 80)).getTime();
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} must be an ISO timestamp or positive epoch milliseconds`);
  return parsed;
}

function moneyMinor(value, name, unit, { optional = false, allowNegative = false } = {}) {
  if (optional && (value === undefined || value === null || String(value).trim() === "")) return null;
  const normalized = String(value ?? "").trim().replace(/\s/g, "").replace(",", ".");
  const pattern = unit === "KOPECKS" ? /^(-?)(\d+)$/ : /^(-?)(\d+)(?:\.(\d{1,2}))?$/;
  const match = normalized.match(pattern);
  if (!match || (!allowNegative && match[1] === "-")) throw new Error(`${name} must be a valid monetary amount`);
  const absolute = unit === "KOPECKS"
    ? BigInt(match[2])
    : (BigInt(match[2]) * 100n) + BigInt((match[3] || "").padEnd(2, "0") || "0");
  const signed = match[1] === "-" ? -absolute : absolute;
  if (signed > BigInt(Number.MAX_SAFE_INTEGER) || signed < BigInt(Number.MIN_SAFE_INTEGER)) throw new Error(`${name} must resolve to whole kopecks within the safe integer range`);
  return Number(signed);
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
  if (!Array.isArray(value) || !value.length) throw new Error("Analytics import must contain at least one row");
  return value;
}

function normalizeOutcomeRows(value) {
  if (!Array.isArray(value)) throw new Error("Business outcome import rows must be an array");
  return value;
}

function normalizeCounter(value) {
  return String(integer(value, "Metrica counter id", 1));
}

function normalizeCrmSubject(value) {
  const subject = cleanText(value || "crm:7tool", 300);
  if (!subject || /(?:oauth|token|password|secret|cookie)/i.test(subject)) throw new Error("CRM subject reference is invalid");
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

function normalizeDigest(value) {
  const digest = cleanText(value, 64).toLocaleLowerCase("en");
  if (!/^[a-f0-9]{64}$/.test(digest)) throw new Error("sourceSha256 must be a SHA-256 hex digest");
  return digest;
}

function normalizePage(value) {
  const raw = cleanText(value, 1_000);
  if (!raw) throw new Error("Analytics page is required");
  let parsed;
  try { parsed = new URL(raw, "https://7tool.ru"); } catch { throw new Error("Analytics page must be a 7tool.ru URL or path"); }
  if (!/^(?:http|https):$/.test(parsed.protocol) || !/^(?:www\.)?7tool\.ru$/i.test(parsed.hostname)
    || parsed.username || parsed.password) throw new Error("Analytics page must belong to 7tool.ru without credentials");
  return parsed.pathname || "/";
}

function inferPageType(pagePath) {
  if (pagePath.startsWith("/articles/")) return "ARTICLE";
  if (pagePath.startsWith("/tools/")) return "TOOL";
  if (pagePath.startsWith("/p/")) return "PRODUCT";
  if (pagePath.startsWith("/c/") || pagePath === "/catalog") return "CATEGORY";
  if (pagePath.startsWith("/lp/")) return "LANDING";
  return "OTHER";
}

function normalizePageType(value, pagePath) {
  const pageType = cleanText(value || inferPageType(pagePath), 20).toLocaleUpperCase("en");
  if (!PAGE_TYPES.has(pageType)) throw new Error("Unsupported analytics page type");
  return pageType;
}

function assertRowsInsidePeriod(rows, periodStart, periodEnd, selector) {
  for (const row of rows) {
    const rowDate = selector(row);
    if (rowDate < periodStart || rowDate > periodEnd) throw new Error("Analytics row is outside the import period");
  }
}

function assertUniqueGrain(rows, selector, label) {
  if (new Set(rows.map(selector)).size !== rows.length) throw new Error(`${label} import contains duplicate dimension grain`);
}

function runIdentity(input, rows) {
  return hash(canonical({
    sourceSystem: input.sourceSystem,
    datasetType: input.datasetType,
    subjectRef: input.subjectRef,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    dimensions: input.dimensions,
    metrics: input.metrics,
    acquisitionMethod: input.acquisitionMethod,
    sourceRef: input.sourceRef,
    sourceSha256: input.sourceSha256,
    rows: rows.map((row) => row.rowChecksum).sort(),
  }));
}

function requireTables(db, names) {
  const present = new Set(db.prepare("SELECT name FROM sqlite_schema WHERE type = 'table'").all().map((row) => row.name));
  const missing = names.filter((name) => !present.has(name));
  if (missing.length) throw new Error(`Analytics intelligence schema is not applied: ${missing.join(", ")}`);
}

function duplicateRun(db, checksum) {
  return db.prepare("SELECT * FROM analytics_import_runs WHERE run_checksum = ?").get(checksum);
}

function insertRun(db, input) {
  const id = `analytics-${input.runChecksum.slice(0, 28)}`;
  db.prepare(`
    INSERT INTO analytics_import_runs (
      id, source_system, dataset_type, subject_ref, period_start, period_end,
      dimensions_json, metrics_json, acquisition_method, source_ref, source_sha256,
      run_checksum, row_count, status, imported_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETE', ?)
  `).run(
    id, input.sourceSystem, input.datasetType, input.subjectRef, input.periodStart, input.periodEnd,
    JSON.stringify(input.dimensions), JSON.stringify(input.metrics), input.acquisitionMethod,
    input.sourceRef, input.sourceSha256, input.runChecksum, input.rows.length, input.importedAt,
  );
  return db.prepare("SELECT * FROM analytics_import_runs WHERE id = ?").get(id);
}

export function validateAnalyticsPageMetricsImport(rawInput) {
  const sourceSystem = "YANDEX_METRIKA";
  const datasetType = "METRIKA_PAGE_METRICS";
  const { periodStart, periodEnd } = normalizePeriod(rawInput);
  const subjectRef = normalizeCounter(rawInput.counterId ?? rawInput.subjectRef);
  const acquisitionMethod = cleanText(rawInput.acquisitionMethod || "OFFICIAL_EXPORT", 50).toLocaleUpperCase("en");
  if (!new Set(["YANDEX_METRIKA_REPORTS_API", "OFFICIAL_EXPORT"]).has(acquisitionMethod)) throw new Error("Unsupported page metrics acquisition method");
  const sourceRef = cleanSourceRef(rawInput.sourceRef);
  const sourceSha256 = normalizeDigest(rawInput.sourceSha256);
  const importedAt = normalizeImportedAt(rawInput.importedAt);
  const rows = normalizeRows(rawInput.rows).map((row) => {
    const dataDate = dateOnly(row.date, "Analytics metric date");
    const pagePath = normalizePage(row.page ?? row.pagePath ?? row.url);
    const pageType = normalizePageType(row.pageType, pagePath);
    const metricName = cleanText(row.metricName ?? row.metric, 80).toLocaleUpperCase("en").replace(/[ -]+/g, "_");
    if (!PAGE_METRIC_SET.has(metricName)) throw new Error(`Unsupported analytics page metric: ${metricName}`);
    const metricValue = integer(row.metricValue ?? row.value ?? row.count, "Analytics metric value", 0);
    const normalized = { dataDate, pagePath, pageType, metricName, metricValue };
    return { ...normalized, rowChecksum: hash(canonical(normalized)) };
  });
  assertRowsInsidePeriod(rows, periodStart, periodEnd, (row) => row.dataDate);
  assertUniqueGrain(rows, (row) => canonical([row.dataDate, row.pagePath, row.metricName]), "Page metrics");
  const observedMetrics = new Set(rows.map((row) => row.metricName));
  const missingMetrics = ANALYTICS_PAGE_METRICS.filter((metric) => !observedMetrics.has(metric));
  if (missingMetrics.length) throw new Error(`Page metrics import is incomplete: ${missingMetrics.join(", ")}`);
  const input = {
    sourceSystem, datasetType, subjectRef, periodStart, periodEnd,
    dimensions: ["date", "page"],
    metrics: [...new Set(rows.map((row) => row.metricName))].sort(),
    acquisitionMethod, sourceRef, sourceSha256, importedAt, rows,
  };
  return { ...input, runChecksum: runIdentity(input, rows) };
}

export function importAnalyticsPageMetrics(db, rawInput) {
  requireTables(db, ["analytics_import_runs", "analytics_page_metrics_daily"]);
  const input = validateAnalyticsPageMetricsImport(rawInput);
  const duplicate = duplicateRun(db, input.runChecksum);
  if (duplicate) return { run: duplicate, importedRows: 0, duplicate: true };
  return db.transaction(() => {
    const run = insertRun(db, input);
    const insert = db.prepare(`
      INSERT INTO analytics_page_metrics_daily (
        id, run_id, data_date, page_path, page_type, metric_name,
        metric_value, row_checksum, imported_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const row of input.rows) {
      insert.run(
        `metric-${hash(`${run.id}:${row.rowChecksum}`).slice(0, 28)}`,
        run.id, row.dataDate, row.pagePath, row.pageType, row.metricName,
        row.metricValue, row.rowChecksum, input.importedAt,
      );
    }
    return { run, importedRows: input.rows.length, duplicate: false };
  })();
}

export function validateAnalyticsBusinessOutcomeImport(rawInput) {
  const sourceSystem = "CRM";
  const datasetType = "CRM_BUSINESS_OUTCOMES";
  const { periodStart, periodEnd } = normalizePeriod(rawInput);
  const subjectRef = normalizeCrmSubject(rawInput.subjectRef);
  const acquisitionMethod = cleanText(rawInput.acquisitionMethod || "CRM_EXPORT", 50).toLocaleUpperCase("en");
  if (acquisitionMethod !== "CRM_EXPORT") throw new Error("Business outcomes require CRM_EXPORT acquisition");
  const sourceRef = cleanSourceRef(rawInput.sourceRef);
  const sourceSha256 = normalizeDigest(rawInput.sourceSha256);
  const importedAt = normalizeImportedAt(rawInput.importedAt);
  const moneyUnit = cleanText(rawInput.moneyUnit || "RUB", 20).toLocaleUpperCase("en");
  if (!new Set(["RUB", "KOPECKS"]).has(moneyUnit)) throw new Error("moneyUnit must be RUB or KOPECKS");
  const rows = normalizeOutcomeRows(rawInput.rows).map((row) => {
    const forbidden = Object.keys(row).filter((key) => {
      const normalizedKey = key.replace(/[^a-z]/gi, "").toLocaleLowerCase("en");
      return FORBIDDEN_BUSINESS_FIELDS.some((fragment) => normalizedKey.includes(fragment));
    });
    if (forbidden.length) throw new Error(`Business outcome import must not contain personal field: ${forbidden[0]}`);
    const externalOutcomeId = cleanText(row.externalOutcomeId ?? row.outcomeId, 200);
    if (!externalOutcomeId) throw new Error("Business outcome externalOutcomeId is required");
    const leadId = row.leadId == null || String(row.leadId).trim() === "" ? null : integer(row.leadId, "Business outcome lead id", 1);
    const leadRequestId = cleanText(row.leadRequestId ?? row.requestId, 200) || null;
    if ((leadId == null) === (leadRequestId == null)) throw new Error("Business outcome must identify a lead by exactly one of leadId or leadRequestId");
    const outcomeType = cleanText(row.outcomeType ?? row.type, 40).toLocaleUpperCase("en").replace(/[ -]+/g, "_");
    if (!OUTCOME_TYPES.has(outcomeType)) throw new Error("Unsupported business outcome type");
    const occurredAt = timestamp(row.occurredAt ?? row.date, "Business outcome occurredAt");
    const occurredDate = new Date(occurredAt).toISOString().slice(0, 10);
    const revenueMinor = moneyMinor(row.revenue, "Business outcome revenue", moneyUnit, { optional: outcomeType !== "ORDER" });
    const grossMarginMinor = moneyMinor(row.grossMargin ?? row.margin, "Business outcome gross margin", moneyUnit, { optional: outcomeType !== "ORDER", allowNegative: true });
    if (outcomeType !== "ORDER" && (revenueMinor != null || grossMarginMinor != null)) throw new Error("Only ORDER outcomes may contain revenue or gross margin");
    if (outcomeType === "ORDER" && grossMarginMinor > revenueMinor) throw new Error("Gross margin must not exceed revenue");
    const currency = outcomeType === "ORDER" ? "RUB" : null;
    const normalized = { externalOutcomeId, leadId, leadRequestId, outcomeType, occurredAt, occurredDate, revenueMinor, grossMarginMinor, currency };
    return { ...normalized, rowChecksum: hash(canonical(normalized)) };
  });
  assertRowsInsidePeriod(rows, periodStart, periodEnd, (row) => row.occurredDate);
  assertUniqueGrain(rows, (row) => canonical([row.leadId, row.leadRequestId, row.outcomeType]), "Business outcomes");
  const input = {
    sourceSystem, datasetType, subjectRef, periodStart, periodEnd,
    dimensions: ["lead", "outcome_type", "occurred_at"],
    metrics: ["revenue_minor", "gross_margin_minor"],
    acquisitionMethod, sourceRef, sourceSha256, importedAt, rows,
  };
  return { ...input, runChecksum: runIdentity(input, rows) };
}

function resolveLead(db, row) {
  const lead = row.leadId != null
    ? db.prepare("SELECT id FROM leads WHERE id = ?").get(row.leadId)
    : db.prepare("SELECT id FROM leads WHERE request_id = ?").get(row.leadRequestId);
  if (!lead) throw new Error(`Business outcome cannot resolve local lead for ${row.externalOutcomeId}`);
  return lead.id;
}

export function importAnalyticsBusinessOutcomes(db, rawInput) {
  requireTables(db, ["leads", "analytics_import_runs", "analytics_business_outcomes"]);
  const input = validateAnalyticsBusinessOutcomeImport(rawInput);
  const duplicate = duplicateRun(db, input.runChecksum);
  if (duplicate) return { run: duplicate, importedRows: 0, duplicate: true };
  return db.transaction(() => {
    const resolved = input.rows.map((row) => ({ ...row, resolvedLeadId: resolveLead(db, row) }));
    assertUniqueGrain(resolved, (row) => canonical([row.resolvedLeadId, row.outcomeType]), "Resolved business outcomes");
    const run = insertRun(db, input);
    const insert = db.prepare(`
      INSERT INTO analytics_business_outcomes (
        id, run_id, external_outcome_id, lead_id, outcome_type, occurred_at,
        revenue_minor, gross_margin_minor, currency, row_checksum, imported_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const row of resolved) {
      insert.run(
        `outcome-${hash(`${run.id}:${row.rowChecksum}`).slice(0, 28)}`,
        run.id, row.externalOutcomeId, row.resolvedLeadId, row.outcomeType,
        row.occurredAt, row.revenueMinor, row.grossMarginMinor, row.currency,
        row.rowChecksum, input.importedAt,
      );
    }
    return { run, importedRows: resolved.length, duplicate: false };
  })();
}

function goalId(value, name) {
  return integer(value, `${name} goal id`, 1);
}

export function buildMetricaAnalyticsReportRequests(input) {
  const { periodStart, periodEnd } = normalizePeriod(input);
  const counterId = normalizeCounter(input.counterId);
  if (!input.goalIds || typeof input.goalIds !== "object") throw new Error("goalIds mapping is required");
  const goalIds = Object.fromEntries(PHASE18_ANALYTICS_EVENTS.map((event) => [event, goalId(input.goalIds[event], event)]));
  if (new Set(Object.values(goalIds)).size !== PHASE18_ANALYTICS_EVENTS.length) throw new Error("Each Phase 18 event must use a distinct Metrica goal id");
  const organicProductViewGoalId = goalId(input.organicProductViewGoalId, "ORGANIC_PRODUCT_VIEWS");
  if (new Set([...Object.values(goalIds), organicProductViewGoalId]).size !== PHASE18_ANALYTICS_EVENTS.length + 1) {
    throw new Error("The organic product-view goal must be distinct from every Phase 18 goal id");
  }
  const common = {
    ids: counterId,
    date1: periodStart,
    date2: periodEnd,
    dimensions: "ym:ep:date,ym:ep:eventURL",
    accuracy: "full",
    limit: 100000,
  };
  return {
    events: {
      method: "GET",
      url: "https://api-metrika.yandex.net/stat/v1/data",
      params: {
        ...common,
        metrics: PHASE18_ANALYTICS_EVENTS.map((event) => `ym:ev:goal${goalIds[event]}reaches`).join(","),
        filters: "ym:s:isRobot=='No'",
      },
      metricMap: Object.fromEntries(PHASE18_ANALYTICS_EVENTS.map((event) => [`ym:ev:goal${goalIds[event]}reaches`, event])),
    },
    organicProductViews: {
      method: "GET",
      url: "https://api-metrika.yandex.net/stat/v1/data",
      params: {
        ...common,
        metrics: `ym:ev:goal${organicProductViewGoalId}reaches`,
        filters: "ym:s:trafficSource=='organic' AND ym:s:isRobot=='No'",
      },
      metricMap: { [`ym:ev:goal${organicProductViewGoalId}reaches`]: "ORGANIC_PRODUCT_VIEWS" },
    },
  };
}

function latestRun(db, datasetType, subjectRef, periodStart, periodEnd) {
  return db.prepare(`
    SELECT * FROM analytics_import_runs
    WHERE dataset_type = ? AND subject_ref = ? AND status = 'COMPLETE'
      AND period_start <= ? AND period_end >= ?
    ORDER BY imported_at DESC, id DESC LIMIT 1
  `).get(datasetType, subjectRef, periodStart, periodEnd);
}

function latestYandexOrganicRun(db, counterId, periodStart, periodEnd) {
  return db.prepare(`
    SELECT * FROM yandex_import_runs
    WHERE source_system = 'YANDEX_METRIKA' AND dataset_type = 'METRIKA_ORGANIC_LANDINGS'
      AND subject_ref = ? AND status = 'COMPLETE' AND period_start <= ? AND period_end >= ?
    ORDER BY imported_at DESC, id DESC LIMIT 1
  `).get(counterId, periodStart, periodEnd);
}

function periodEpoch(periodStart, periodEnd) {
  return {
    from: Date.parse(`${periodStart}T00:00:00.000Z`),
    until: Date.parse(`${periodEnd}T00:00:00.000Z`) + 86_400_000,
  };
}

export function evaluateAnalyticsIntelligence(db, rawInput) {
  requireTables(db, [
    "analytics_import_runs", "analytics_page_metrics_daily", "analytics_business_outcomes",
    "yandex_import_runs", "yandex_metrica_organic_daily", "lead_attribution_snapshots", "leads",
  ]);
  const { periodStart, periodEnd } = normalizePeriod(rawInput);
  const counterId = normalizeCounter(rawInput.counterId ?? 109097461);
  const crmSubjectRef = normalizeCrmSubject(rawInput.crmSubjectRef);
  const pageMetricRun = latestRun(db, "METRIKA_PAGE_METRICS", counterId, periodStart, periodEnd);
  const businessOutcomeRun = latestRun(db, "CRM_BUSINESS_OUTCOMES", crmSubjectRef, periodStart, periodEnd);
  const yandexOrganicRun = latestYandexOrganicRun(db, counterId, periodStart, periodEnd);
  if (!pageMetricRun) throw new Error("No complete Metrica page metrics run covers the requested period");
  if (!businessOutcomeRun) throw new Error("No complete CRM business outcome run covers the requested period");
  if (!yandexOrganicRun) throw new Error("No complete Yandex organic landing run covers the requested period");

  const pages = new Map();
  const ensurePage = (pagePath, pageType = inferPageType(pagePath)) => {
    const current = pages.get(pagePath) ?? {
      pagePath, pageType, organicSessions: 0, productClicks: 0, leads: 0,
      qualifiedLeads: 0, quotes: 0, orders: 0, revenueMinor: 0, grossMarginMinor: 0,
    };
    pages.set(pagePath, current);
    return current;
  };

  const metricRows = db.prepare(`
    SELECT page_path, page_type,
      SUM(CASE WHEN metric_name = 'PRODUCT_CLICK_FROM_ARTICLE' THEN metric_value ELSE 0 END) AS product_clicks,
      SUM(CASE WHEN metric_name = 'ORGANIC_PRODUCT_VIEWS' THEN metric_value ELSE 0 END) AS organic_product_views
    FROM analytics_page_metrics_daily
    WHERE run_id = ? AND data_date BETWEEN ? AND ?
    GROUP BY page_path, page_type
  `).all(pageMetricRun.id, periodStart, periodEnd);
  let organicProductViews = 0;
  for (const row of metricRows) {
    const page = ensurePage(row.page_path, row.page_type);
    page.productClicks = row.product_clicks;
    organicProductViews += row.organic_product_views;
  }

  const organicRows = db.prepare(`
    SELECT page_path, SUM(visits) AS organic_sessions
    FROM yandex_metrica_organic_daily
    WHERE run_id = ? AND data_date BETWEEN ? AND ?
    GROUP BY page_path
  `).all(yandexOrganicRun.id, periodStart, periodEnd);
  for (const row of organicRows) ensurePage(row.page_path).organicSessions = row.organic_sessions;

  const { from, until } = periodEpoch(periodStart, periodEnd);
  const leadRows = db.prepare(`
    SELECT a.page_path, COUNT(DISTINCT a.lead_id) AS leads
    FROM lead_attribution_snapshots a JOIN leads l ON l.id = a.lead_id
    WHERE a.page_path IS NOT NULL AND l.created_at >= ? AND l.created_at < ?
    GROUP BY a.page_path
  `).all(from, until);
  for (const row of leadRows) ensurePage(row.page_path).leads = row.leads;

  const outcomeRows = db.prepare(`
    SELECT a.page_path,
      COUNT(DISTINCT CASE WHEN o.outcome_type = 'QUALIFIED_LEAD' THEN o.lead_id END) AS qualified_leads,
      COUNT(DISTINCT CASE WHEN o.outcome_type = 'QUOTE' THEN o.lead_id END) AS quotes,
      COUNT(DISTINCT CASE WHEN o.outcome_type = 'ORDER' THEN o.lead_id END) AS orders,
      SUM(CASE WHEN o.outcome_type = 'ORDER' THEN o.revenue_minor ELSE 0 END) AS revenue_minor,
      SUM(CASE WHEN o.outcome_type = 'ORDER' THEN o.gross_margin_minor ELSE 0 END) AS gross_margin_minor
    FROM analytics_business_outcomes o
    JOIN lead_attribution_snapshots a ON a.lead_id = o.lead_id
    WHERE o.run_id = ? AND o.occurred_at >= ? AND o.occurred_at < ? AND a.page_path IS NOT NULL
    GROUP BY a.page_path
  `).all(businessOutcomeRun.id, from, until);
  for (const row of outcomeRows) {
    const page = ensurePage(row.page_path);
    page.qualifiedLeads = row.qualified_leads;
    page.quotes = row.quotes;
    page.orders = row.orders;
    page.revenueMinor = row.revenue_minor;
    page.grossMarginMinor = row.gross_margin_minor;
  }

  const totals = db.prepare(`
    SELECT
      COUNT(DISTINCT CASE WHEN outcome_type = 'QUALIFIED_LEAD' THEN lead_id END) AS qualified_leads,
      COUNT(DISTINCT CASE WHEN outcome_type = 'QUOTE' THEN lead_id END) AS quotes,
      COUNT(DISTINCT CASE WHEN outcome_type = 'ORDER' THEN lead_id END) AS orders,
      COALESCE(SUM(CASE WHEN outcome_type = 'ORDER' THEN revenue_minor ELSE 0 END), 0) AS revenue_minor,
      COALESCE(SUM(CASE WHEN outcome_type = 'ORDER' THEN gross_margin_minor ELSE 0 END), 0) AS gross_margin_minor
    FROM analytics_business_outcomes
    WHERE run_id = ? AND occurred_at >= ? AND occurred_at < ?
  `).get(businessOutcomeRun.id, from, until);

  const sourceRuns = {
    yandexOrganicRunId: yandexOrganicRun.id,
    pageMetricRunId: pageMetricRun.id,
    businessOutcomeRunId: businessOutcomeRun.id,
  };
  const kpi = {
    periodStart, periodEnd, organicProductViews,
    qualifiedLeads: totals.qualified_leads, quotes: totals.quotes, orders: totals.orders,
    revenueMinor: totals.revenue_minor, grossMarginMinor: totals.gross_margin_minor,
    currency: "RUB", ...sourceRuns,
  };
  const roi = [...pages.values()].sort((left, right) => left.pagePath.localeCompare(right.pagePath, "en"));
  return { kpi, roi, sourceRuns, modelVersion: ANALYTICS_INTELLIGENCE_MODEL_VERSION };
}

export function materializeAnalyticsIntelligence(db, rawInput) {
  requireTables(db, ["analytics_business_kpi_snapshots", "content_roi_snapshots"]);
  const evaluation = evaluateAnalyticsIntelligence(db, rawInput);
  const evaluatedAt = rawInput.evaluatedAt == null ? Date.now() : integer(rawInput.evaluatedAt, "evaluatedAt", 1);
  return db.transaction(() => {
    const kpiEvidence = hash(canonical({ ...evaluation.kpi, modelVersion: evaluation.modelVersion }));
    const kpiResult = db.prepare(`
      INSERT OR IGNORE INTO analytics_business_kpi_snapshots (
        id, period_start, period_end, organic_product_views, qualified_leads,
        quotes, orders, revenue_minor, gross_margin_minor, currency,
        page_metric_run_id, business_outcome_run_id, evidence_checksum,
        model_version, status, evaluated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'REVIEW_REQUIRED', ?)
    `).run(
      `kpi-${kpiEvidence.slice(0, 28)}`, evaluation.kpi.periodStart, evaluation.kpi.periodEnd,
      evaluation.kpi.organicProductViews, evaluation.kpi.qualifiedLeads, evaluation.kpi.quotes,
      evaluation.kpi.orders, evaluation.kpi.revenueMinor, evaluation.kpi.grossMarginMinor,
      evaluation.kpi.currency, evaluation.kpi.pageMetricRunId, evaluation.kpi.businessOutcomeRunId,
      kpiEvidence, evaluation.modelVersion, evaluatedAt,
    );
    const insertRoi = db.prepare(`
      INSERT OR IGNORE INTO content_roi_snapshots (
        id, page_path, page_type, period_start, period_end, organic_sessions,
        product_clicks, leads, qualified_leads, quotes, orders, revenue_minor,
        gross_margin_minor, currency, yandex_organic_run_id, page_metric_run_id,
        business_outcome_run_id, evidence_checksum, model_version, status, evaluated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'RUB', ?, ?, ?, ?, ?, 'REVIEW_REQUIRED', ?)
    `);
    let savedRoi = 0;
    for (const page of evaluation.roi) {
      const evidence = hash(canonical({ page, periodStart: evaluation.kpi.periodStart, periodEnd: evaluation.kpi.periodEnd, ...evaluation.sourceRuns, modelVersion: evaluation.modelVersion }));
      savedRoi += insertRoi.run(
        `roi-${evidence.slice(0, 28)}`, page.pagePath, page.pageType,
        evaluation.kpi.periodStart, evaluation.kpi.periodEnd, page.organicSessions,
        page.productClicks, page.leads, page.qualifiedLeads, page.quotes, page.orders,
        page.revenueMinor, page.grossMarginMinor, evaluation.sourceRuns.yandexOrganicRunId,
        evaluation.sourceRuns.pageMetricRunId, evaluation.sourceRuns.businessOutcomeRunId,
        evidence, evaluation.modelVersion, evaluatedAt,
      ).changes;
    }
    return { ...evaluation, savedKpi: kpiResult.changes, savedRoi };
  })();
}

export function isPhase18AnalyticsEvent(value) {
  return EVENT_SET.has(String(value));
}
