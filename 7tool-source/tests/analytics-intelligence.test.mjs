import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

import {
  ANALYTICS_PAGE_METRICS,
  PHASE18_ANALYTICS_EVENTS,
  buildMetricaAnalyticsReportRequests,
  importAnalyticsBusinessOutcomes,
  importAnalyticsPageMetrics,
  materializeAnalyticsIntelligence,
  validateAnalyticsBusinessOutcomeImport,
  validateAnalyticsPageMetricsImport,
} from "../src/lib/analytics-intelligence.mjs";
import { parseAnalyticsIntelligenceImport } from "../scripts/lib/analytics-intelligence-import.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationPath = path.join(root, "scripts", "migrations", "015_analytics_intelligence.sql");
const migrationSql = fs.readFileSync(migrationPath, "utf8");
const upSql = migrationSql.slice(migrationSql.indexOf("-- migrate:up") + 13, migrationSql.indexOf("-- migrate:down"));
const downSql = migrationSql.slice(migrationSql.indexOf("-- migrate:down") + 15);
const period = { periodStart: "2026-08-01", periodEnd: "2026-08-20" };
const digest = (character) => character.repeat(64);

function fixtureDb() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "7tool-analytics-"));
  const databasePath = path.join(directory, "fixture.db");
  const db = new Database(databasePath);
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE leads (
      id INTEGER PRIMARY KEY,
      request_id TEXT UNIQUE,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE lead_attribution_snapshots (
      lead_id INTEGER PRIMARY KEY REFERENCES leads(id),
      page_path TEXT
    );
    CREATE TABLE yandex_import_runs (
      id TEXT PRIMARY KEY,
      source_system TEXT NOT NULL,
      dataset_type TEXT NOT NULL,
      subject_ref TEXT NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      status TEXT NOT NULL,
      imported_at INTEGER NOT NULL
    );
    CREATE TABLE yandex_metrica_organic_daily (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES yandex_import_runs(id),
      data_date TEXT NOT NULL,
      page_path TEXT NOT NULL,
      visits INTEGER NOT NULL
    );
  `);
  db.exec(upSql);
  db.prepare(`INSERT INTO yandex_import_runs
    (id, source_system, dataset_type, subject_ref, period_start, period_end, status, imported_at)
    VALUES ('yandex-organic', 'YANDEX_METRIKA', 'METRIKA_ORGANIC_LANDINGS', '109097461', '2026-08-01', '2026-08-20', 'COMPLETE', 100)`).run();
  db.prepare("INSERT INTO yandex_metrica_organic_daily (id, run_id, data_date, page_path, visits) VALUES (?, 'yandex-organic', ?, ?, ?)")
    .run("organic-article", "2026-08-10", "/articles/magnitny-stanok", 30);
  db.prepare("INSERT INTO yandex_metrica_organic_daily (id, run_id, data_date, page_path, visits) VALUES (?, 'yandex-organic', ?, ?, ?)")
    .run("organic-product", "2026-08-10", "/p/magnitny-stanok", 7);
  db.prepare("INSERT INTO leads (id, request_id, created_at) VALUES (1, 'REQ-1', ?)")
    .run(Date.parse("2026-08-10T12:00:00.000Z"));
  db.prepare("INSERT INTO lead_attribution_snapshots (lead_id, page_path) VALUES (1, '/articles/magnitny-stanok')").run();
  return { db, directory };
}

function cleanup(fixture) {
  fixture.db.close();
  fs.rmSync(fixture.directory, { recursive: true, force: true });
}

function pageMetricsInput(rows = ANALYTICS_PAGE_METRICS.map((metricName, index) => ({
  date: "2026-08-10",
  page: metricName === "ORGANIC_PRODUCT_VIEWS" ? "https://7tool.ru/p/magnitny-stanok?utm_source=test" : "/articles/magnitny-stanok",
  metricName,
  metricValue: metricName === "PRODUCT_CLICK_FROM_ARTICLE" ? 5 : metricName === "ORGANIC_PRODUCT_VIEWS" ? 11 : index + 1,
}))) {
  return {
    ...period,
    counterId: 109097461,
    acquisitionMethod: "YANDEX_METRIKA_REPORTS_API",
    sourceRef: "https://api-metrika.yandex.net/stat/v1/data?oauth=removed",
    sourceSha256: digest("a"),
    importedAt: 1_000,
    rows,
  };
}

function outcomeInput(rows = [
  { externalOutcomeId: "crm-qualified-1", leadRequestId: "REQ-1", outcomeType: "QUALIFIED_LEAD", occurredAt: "2026-08-11T10:00:00Z" },
  { externalOutcomeId: "crm-quote-1", leadRequestId: "REQ-1", outcomeType: "QUOTE", occurredAt: "2026-08-12T10:00:00Z" },
  { externalOutcomeId: "crm-order-1", leadRequestId: "REQ-1", outcomeType: "ORDER", occurredAt: "2026-08-15T10:00:00Z", revenue: "100000.50", grossMargin: "25000.25" },
]) {
  return {
    ...period,
    subjectRef: "crm:7tool",
    acquisitionMethod: "CRM_EXPORT",
    sourceRef: "crm-outcomes.csv",
    sourceSha256: digest("b"),
    importedAt: 2_000,
    moneyUnit: "RUB",
    rows,
  };
}

test("Phase 18 defines exactly the required privacy-safe canonical goals", () => {
  assert.deepEqual(PHASE18_ANALYTICS_EVENTS, [
    "ARTICLE_VIEW", "ARTICLE_50_SCROLL", "ARTICLE_90_SCROLL",
    "PRODUCT_CLICK_FROM_ARTICLE", "CATEGORY_CLICK_FROM_ARTICLE",
    "CALCULATOR_START", "CALCULATOR_COMPLETE", "SELECTOR_START", "SELECTOR_COMPLETE",
    "LEAD_FORM_OPEN", "LEAD_FORM_SUCCESS", "PHONE_CLICK", "EMAIL_CLICK",
  ]);
  const analytics = fs.readFileSync(path.join(root, "src", "lib", "analytics.ts"), "utf8");
  const article = fs.readFileSync(path.join(root, "src", "components", "ArticleAnalytics.tsx"), "utf8");
  const tools = fs.readFileSync(path.join(root, "src", "components", "InteractiveToolWorkbench.tsx"), "utf8");
  const semanticLinks = fs.readFileSync(path.join(root, "src", "components", "SemanticNextSteps.tsx"), "utf8");
  for (const event of PHASE18_ANALYTICS_EVENTS) assert.match(`${analytics}\n${article}\n${tools}\n${semanticLinks}`, new RegExp(`"${event}"`));
  assert.match(semanticLinks, /ARTICLE_TO_PRODUCT/);
  assert.match(semanticLinks, /ARTICLE_TO_CATEGORY/);
  const params = analytics.slice(analytics.indexOf("export type AnalyticsParams"), analytics.indexOf("export type EcommerceProduct"));
  for (const forbidden of ["phone", "email", "name", "company", "inn", "message", "session_id", "client_id"]) {
    assert.doesNotMatch(params, new RegExp(`\\b${forbidden}\\??:`));
  }
});

test("Metrica request contracts use distinct configured goal IDs and contain no credentials", () => {
  const goalIds = Object.fromEntries(PHASE18_ANALYTICS_EVENTS.map((event, index) => [event, 10_000 + index]));
  const requests = buildMetricaAnalyticsReportRequests({ ...period, counterId: 109097461, goalIds, organicProductViewGoalId: 20_000 });
  assert.equal(requests.events.method, "GET");
  assert.equal(requests.events.params.dimensions, "ym:ep:date,ym:ep:eventURL");
  assert.match(requests.events.params.metrics, /ym:ev:goal10000reaches/);
  assert.match(requests.events.params.filters, /isRobot/);
  assert.match(requests.organicProductViews.params.filters, /trafficSource=='organic'/);
  assert.equal(Object.keys(requests.events.metricMap).length, 13);
  assert.doesNotMatch(JSON.stringify(requests), /authorization|oauth|token|cookie/i);
  assert.throws(() => buildMetricaAnalyticsReportRequests({ ...period, counterId: 1, goalIds: Object.fromEntries(PHASE18_ANALYTICS_EVENTS.map((event) => [event, 1])), organicProductViewGoalId: 2 }), /distinct/);
});

test("official Metrica JSON and normalized CRM CSV parse without user-level fields", () => {
  const metrica = parseAnalyticsIntelligenceImport(JSON.stringify({
    query: { dimensions: ["ym:ep:date", "ym:ep:eventURL"], metrics: ["ym:ev:goal10000reaches"] },
    data: [{ dimensions: [{ name: "2026-08-10" }, { name: "https://7tool.ru/articles/test" }], metrics: [4] }],
  }), "page-metrics", { metricMap: { "ym:ev:goal10000reaches": "ARTICLE_VIEW" } });
  assert.deepEqual(metrica.rows[0], { date: "2026-08-10", page: "https://7tool.ru/articles/test", metricName: "ARTICLE_VIEW", metricValue: 4 });
  const crm = parseAnalyticsIntelligenceImport("external_outcome_id;lead_request_id;outcome_type;occurred_at;revenue;gross_margin\nO-1;REQ-1;ORDER;2026-08-10T10:00:00Z;1000;250", "business-outcomes");
  assert.equal(crm.rows[0].leadRequestId, "REQ-1");
  assert.equal(crm.rows[0].grossMargin, "250");
});

test("aggregate page metrics and CRM outcomes are immutable, complete and idempotent", () => {
  const fixture = fixtureDb();
  try {
    const metricResult = importAnalyticsPageMetrics(fixture.db, pageMetricsInput());
    assert.equal(metricResult.importedRows, 14);
    assert.equal(importAnalyticsPageMetrics(fixture.db, pageMetricsInput()).duplicate, true);
    const storedProduct = fixture.db.prepare("SELECT * FROM analytics_page_metrics_daily WHERE metric_name = 'ORGANIC_PRODUCT_VIEWS'").get();
    assert.equal(storedProduct.page_path, "/p/magnitny-stanok");
    assert.equal(storedProduct.page_type, "PRODUCT");
    assert.throws(() => fixture.db.prepare("UPDATE analytics_page_metrics_daily SET metric_value = 1").run(), /immutable/);
    assert.throws(() => validateAnalyticsPageMetricsImport(pageMetricsInput(pageMetricsInput().rows.slice(0, -1))), /incomplete/);

    const outcomeResult = importAnalyticsBusinessOutcomes(fixture.db, outcomeInput());
    assert.equal(outcomeResult.importedRows, 3);
    assert.equal(importAnalyticsBusinessOutcomes(fixture.db, outcomeInput()).duplicate, true);
    const order = fixture.db.prepare("SELECT * FROM analytics_business_outcomes WHERE outcome_type = 'ORDER'").get();
    assert.equal(order.revenue_minor, 10_000_050);
    assert.equal(order.gross_margin_minor, 2_500_025);
    assert.throws(() => validateAnalyticsBusinessOutcomeImport(outcomeInput([{
      externalOutcomeId: "unsafe", leadRequestId: "REQ-1", outcomeType: "QUOTE",
      occurredAt: "2026-08-10T10:00:00Z", clientId: "private-client-id",
    }])), /personal field/);
    const fractional = validateAnalyticsBusinessOutcomeImport(outcomeInput([{
      externalOutcomeId: "fractional", leadRequestId: "REQ-1", outcomeType: "ORDER",
      occurredAt: "2026-08-10T10:00:00Z", revenue: "0.29", grossMargin: "0.01",
    }]));
    assert.deepEqual([fractional.rows[0].revenueMinor, fractional.rows[0].grossMarginMinor], [29, 1]);
  } finally { cleanup(fixture); }
});

test("an explicit empty CRM snapshot preserves truthful zero business outcomes", () => {
  const fixture = fixtureDb();
  try {
    importAnalyticsPageMetrics(fixture.db, pageMetricsInput());
    const imported = importAnalyticsBusinessOutcomes(fixture.db, outcomeInput([]));
    assert.equal(imported.importedRows, 0);
    assert.equal(imported.run.row_count, 0);
    const result = materializeAnalyticsIntelligence(fixture.db, { ...period, counterId: 109097461, crmSubjectRef: "crm:7tool", evaluatedAt: 3_000 });
    assert.deepEqual({
      qualifiedLeads: result.kpi.qualifiedLeads,
      quotes: result.kpi.quotes,
      orders: result.kpi.orders,
      revenueMinor: result.kpi.revenueMinor,
      grossMarginMinor: result.kpi.grossMarginMinor,
    }, { qualifiedLeads: 0, quotes: 0, orders: 0, revenueMinor: 0, grossMarginMinor: 0 });
  } finally { cleanup(fixture); }
});

test("Business KPI and Content ROI use aggregates and verified outcomes, never pageviews", () => {
  const fixture = fixtureDb();
  try {
    importAnalyticsPageMetrics(fixture.db, pageMetricsInput());
    importAnalyticsBusinessOutcomes(fixture.db, outcomeInput());
    const first = materializeAnalyticsIntelligence(fixture.db, { ...period, counterId: 109097461, crmSubjectRef: "crm:7tool", evaluatedAt: 3_000 });
    assert.deepEqual({
      organicProductViews: first.kpi.organicProductViews,
      qualifiedLeads: first.kpi.qualifiedLeads,
      quotes: first.kpi.quotes,
      orders: first.kpi.orders,
      revenueMinor: first.kpi.revenueMinor,
      grossMarginMinor: first.kpi.grossMarginMinor,
    }, { organicProductViews: 11, qualifiedLeads: 1, quotes: 1, orders: 1, revenueMinor: 10_000_050, grossMarginMinor: 2_500_025 });
    const article = first.roi.find((row) => row.pagePath === "/articles/magnitny-stanok");
    assert.deepEqual({
      organicSessions: article.organicSessions,
      productClicks: article.productClicks,
      leads: article.leads,
      quotes: article.quotes,
      orders: article.orders,
      revenueMinor: article.revenueMinor,
      grossMarginMinor: article.grossMarginMinor,
    }, { organicSessions: 30, productClicks: 5, leads: 1, quotes: 1, orders: 1, revenueMinor: 10_000_050, grossMarginMinor: 2_500_025 });
    assert.equal(first.savedKpi, 1);
    assert.equal(first.savedRoi, 2);
    const second = materializeAnalyticsIntelligence(fixture.db, { ...period, counterId: 109097461, crmSubjectRef: "crm:7tool", evaluatedAt: 4_000 });
    assert.equal(second.savedKpi, 0);
    assert.equal(second.savedRoi, 0);
    const kpiColumns = fixture.db.prepare("PRAGMA table_info(analytics_business_kpi_snapshots)").all().map((row) => row.name);
    assert.equal(kpiColumns.includes("pageviews"), false);
    assert.throws(() => fixture.db.prepare("UPDATE content_roi_snapshots SET leads = 0").run(), /immutable/);
  } finally { cleanup(fixture); }
});

test("migration 015 indexes match KPI/ROI queries and rollback cleanly", () => {
  const fixture = fixtureDb();
  try {
    fixture.db.pragma("optimize");
    const metricPlan = fixture.db.prepare("EXPLAIN QUERY PLAN SELECT SUM(metric_value) FROM analytics_page_metrics_daily WHERE run_id = ? AND metric_name = ?")
      .all("run", "ARTICLE_VIEW").map((row) => row.detail).join(" ");
    assert.match(metricPlan, /idx_analytics_page_metrics_kpi/);
    const outcomePlan = fixture.db.prepare("EXPLAIN QUERY PLAN SELECT lead_id FROM analytics_business_outcomes WHERE run_id = ? AND outcome_type = ? AND occurred_at >= ?")
      .all("run", "ORDER", 1).map((row) => row.detail).join(" ");
    assert.match(outcomePlan, /idx_analytics_business_outcomes_kpi/);
    const roiPlan = fixture.db.prepare("EXPLAIN QUERY PLAN SELECT * FROM content_roi_snapshots WHERE page_path = ? ORDER BY period_end DESC")
      .all("/articles/test").map((row) => row.detail).join(" ");
    assert.match(roiPlan, /idx_content_roi_page/);
    fixture.db.exec(downSql);
    const remaining = fixture.db.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name LIKE 'analytics_%' OR name = 'content_roi_snapshots'").all();
    assert.deepEqual(remaining, []);
  } finally { cleanup(fixture); }
});
