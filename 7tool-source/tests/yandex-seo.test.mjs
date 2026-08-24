import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { parseYandexSeoImport } from "../scripts/lib/yandex-seo-import.mjs";
import {
  buildMetricaOrganicReportRequest,
  buildWordstatTopRequestsRequest,
  discoverYandexQueryOpportunities,
  importYandexMetrica,
  importYandexWebmaster,
  importYandexWordstat,
  listYandexWebmasterPerformanceForUrl,
  materializeYandexQueryOpportunities,
  validateYandexMetricaImport,
  validateYandexWebmasterImport,
  webmasterEnhancedExportContract,
} from "../src/lib/yandex-seo.mjs";

const root = path.resolve(import.meta.dirname, "..");

function migrationPart(filename, direction = "up") {
  const sql = fs.readFileSync(path.join(root, "scripts", "migrations", filename), "utf8");
  const up = sql.indexOf("-- migrate:up");
  const down = sql.indexOf("-- migrate:down");
  return direction === "up" ? sql.slice(up + "-- migrate:up".length, down) : sql.slice(down + "-- migrate:down".length);
}

function fixtureDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "7tool-yandex-seo-"));
  const db = new Database(path.join(dir, "data.db"));
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE categories (slug TEXT PRIMARY KEY);
    CREATE TABLE products (id TEXT PRIMARY KEY);
    CREATE TABLE variants (id TEXT PRIMARY KEY, product_id TEXT REFERENCES products(id));
    INSERT INTO categories VALUES ('stanki-sverlilnye');
    INSERT INTO products VALUES ('p1');
  `);
  db.exec(migrationPart("001_supplier_feed_provenance.sql"));
  db.exec(migrationPart("003_semantic_intelligence.sql"));
  db.exec(migrationPart("014_yandex_seo.sql"));
  db.exec(`
    INSERT INTO site_urls (
      id, path, page_type, index_status, http_status, created_at, updated_at
    ) VALUES
      ('url-category', '/c/stanki-sverlilnye', 'CATEGORY', 'INDEX', 200, 1, 1),
      ('url-page-2', '/c/stanki-sverlilnye?page=2', 'CATEGORY', 'INDEX', 200, 1, 1),
      ('url-noindex', '/p/noindex', 'PRODUCT', 'NOINDEX', 200, 1, 1);
  `);
  return { dir, db };
}

function cleanup(fixture) {
  fixture.db.close();
  fs.rmSync(fixture.dir, { recursive: true, force: true });
}

const digest = "b".repeat(64);
const period = { periodStart: "2026-08-01", periodEnd: "2026-08-20" };

function webmasterInput(rows, overrides = {}) {
  return {
    ...period,
    subjectRef: "https://7tool.ru/",
    acquisitionMethod: "OFFICIAL_EXPORT",
    sourceRef: "webmaster-export.csv",
    sourceSha256: digest,
    importedAt: 1_777_100_000_000,
    device: "ALL",
    rows,
    ...overrides,
  };
}

function wordstatInput(rows, overrides = {}) {
  return {
    ...period,
    subjectRef: "wordstat:7tool.ru",
    acquisitionMethod: "YANDEX_WORDSTAT_API",
    sourceRef: "https://api.wordstat.yandex.net/v1/topRequests?token=removed",
    sourceSha256: "c".repeat(64),
    importedAt: 1_777_100_000_100,
    seedPhrase: "магнитный станок",
    regionIds: [213],
    regionKey: "RU-MOW",
    device: "ALL",
    categorySlug: "stanki-sverlilnye",
    rows,
    ...overrides,
  };
}

function metricaInput(rows, overrides = {}) {
  return {
    ...period,
    counterId: 109097461,
    acquisitionMethod: "YANDEX_METRIKA_REPORTS_API",
    sourceRef: "https://api-metrika.yandex.net/stat/v1/data?oauth=removed",
    sourceSha256: "d".repeat(64),
    importedAt: 1_777_100_000_200,
    rows,
    ...overrides,
  };
}

test("official-style Webmaster, Wordstat and Metrica JSON/CSV exports normalize without credentials", () => {
  const webmasterCsv = "Дата;URL;Запрос;Регион;Клики;Показы;CTR;Позиция\n2026-08-20;https://7tool.ru/c/stanki-sverlilnye;магнитный станок;213;10;200;5%;9,5";
  const webmaster = parseYandexSeoImport(webmasterCsv, "webmaster");
  assert.equal(webmaster.rows[0].position, "9,5");
  assert.equal(webmaster.rows[0].impressions, "200");

  const wordstat = parseYandexSeoImport(JSON.stringify({ topRequests: [
    { phrase: "магнитный станок", count: 1200 },
    { phrase: "станок на магните", count: 340 },
  ] }), "wordstat");
  assert.deepEqual(wordstat.rows[0], { query: "магнитный станок", demandCount: 1200, sourceKeywordId: undefined });

  const metrica = parseYandexSeoImport(JSON.stringify({
    query: {
      dimensions: ["ym:s:date", "ym:s:startURL", "ym:s:lastsignSearchEngineRoot", "ym:s:lastsignSearchPhrase"],
      metrics: ["ym:s:visits", "ym:s:users", "ym:s:pageviews", "ym:s:bounceRate"],
    },
    data: [{
      dimensions: [{ name: "2026-08-20" }, { name: "https://7tool.ru/c/stanki-sverlilnye" }, { name: "Yandex" }, { name: "магнитный станок" }],
      metrics: [20, 18, 30, 12.5],
    }],
  }), "metrica");
  assert.equal(metrica.rows[0].searchEngine, "Yandex");
  assert.equal(metrica.rows[0].bounceRate, 12.5);
});

test("request builders follow official aggregate APIs but never include authorization", () => {
  const wordstat = buildWordstatTopRequestsRequest({ phrase: "магнитный станок", regionIds: [213, 2], devices: ["phone"] });
  assert.equal(wordstat.url, "https://api.wordstat.yandex.net/v1/topRequests");
  assert.deepEqual(wordstat.body, { phrase: "магнитный станок", regions: [2, 213], devices: ["phone"] });
  assert.equal("Authorization" in wordstat.headers, false);

  const metrica = buildMetricaOrganicReportRequest({ counterId: 109097461, startDate: "2026-08-01", endDate: "2026-08-20" });
  assert.match(metrica.params.filters, /organic/);
  assert.match(metrica.params.dimensions, /startURL/);
  assert.match(metrica.params.dimensions, /SearchPhrase/);
  assert.equal(JSON.stringify(metrica).includes("token"), false);

  const webmaster = webmasterEnhancedExportContract();
  assert.equal(webmaster.requiresUrlGrain, true);
  assert.equal(webmaster.standardPopularQueriesEndpointIsInsufficient, true);
});

test("Wordstat demand is immutable, idempotent and mirrored into the semantic layer", () => {
  const fixture = fixtureDb();
  try {
    const input = wordstatInput([
      { query: "магнитный станок", demandCount: 1200, sourceKeywordId: "ws-1" },
      { query: "как выбрать магнитный станок", demandCount: 480, sourceKeywordId: "ws-2" },
    ]);
    const first = importYandexWordstat(fixture.db, input);
    assert.equal(first.importedRows, 2);
    assert.ok(first.semantic.runId);
    assert.deepEqual(first.clusters.map((item) => item.categorySlug), ["stanki-sverlilnye"]);
    assert.equal(importYandexWordstat(fixture.db, input).duplicate, true);
    const keyword = fixture.db.prepare(`
      SELECT k.frequency, s.source_type FROM seo_keywords k JOIN sources s ON s.id = k.source_id
      WHERE k.normalized_query = 'магнитный станок'
    `).get();
    assert.deepEqual(keyword, { frequency: 1200, source_type: "WORDSTAT" });
    assert.equal(fixture.db.prepare("SELECT semantic_import_run_id FROM yandex_import_runs WHERE source_system = 'WORDSTAT'").get().semantic_import_run_id, first.semantic.runId);
    assert.throws(() => fixture.db.prepare("UPDATE yandex_wordstat_demand SET demand_count = 1").run(), /immutable/);
  } finally { cleanup(fixture); }
});

test("Webmaster keeps exact URL query performance, nullable positions and rejects unsafe rows", () => {
  const fixture = fixtureDb();
  try {
    const input = webmasterInput([
      { date: "2026-08-20", page: "https://www.7tool.ru/c/stanki-sverlilnye?utm_source=x", query: "магнитный станок", region: 213, clicks: 10, impressions: 200, ctr: 0.05, position: 9 },
      { date: "2026-08-20", page: "https://7tool.ru/c/stanki-sverlilnye?page=2", query: "станки страница 2", region: 213, clicks: 3, impressions: 100, ctr: 0.03, position: "—" },
      { date: "2026-08-20", page: "https://7tool.ru/c/stanki-sverlilnye?brand=Karnasch", query: "станок karnasch", region: 213, clicks: 20, impressions: 400, ctr: 0.05, position: 8 },
      { date: "2026-08-20", page: "https://7tool.ru/p/unregistered", query: "неизвестный станок", region: 213, clicks: 10, impressions: 300, ctr: 1 / 30, position: 10 },
    ]);
    const first = importYandexWebmaster(fixture.db, input);
    assert.equal(first.importedRows, 4);
    assert.equal(importYandexWebmaster(fixture.db, input).duplicate, true);
    const page2 = fixture.db.prepare("SELECT * FROM yandex_webmaster_performance_daily WHERE page_path LIKE '%page=2'").get();
    assert.equal(page2.route_path, "/c/stanki-sverlilnye");
    assert.equal(page2.average_position, null);
    assert.equal(page2.is_facet, 0);
    assert.equal(fixture.db.prepare("SELECT is_facet FROM yandex_webmaster_performance_daily WHERE page_path LIKE '%brand%'").get().is_facet, 1);
    const listed = listYandexWebmasterPerformanceForUrl(fixture.db, { ...period, pagePath: "/c/stanki-sverlilnye?page=2&utm_campaign=x" });
    assert.equal(listed.length, 1);
    assert.equal(listed[0].query, "станки страница 2");
    assert.throws(() => validateYandexWebmasterImport(webmasterInput([
      { date: "2026-08-20", page: "https://user:secret@7tool.ru/", query: "unsafe", region: 213, clicks: 1, impressions: 10, position: 5 },
    ])), /without credentials/);
    assert.throws(() => validateYandexWebmasterImport(webmasterInput([
      { date: "2026-08-20", page: "https://7tool.ru/", query: "bad ctr", region: 213, clicks: 1, impressions: 10, ctr: 0.9, position: 5 },
    ])), /CTR does not match/);
  } finally { cleanup(fixture); }
});

test("Metrica stores only aggregate organic behavior and normalizes percent bounce rate", () => {
  const fixture = fixtureDb();
  try {
    const input = metricaInput([
      { date: "2026-08-20", page: "https://7tool.ru/c/stanki-sverlilnye", searchEngine: "Yandex", query: "магнитный станок", visits: 20, users: 18, pageviews: 30, bounceRate: 12.5 },
      { date: "2026-08-20", page: "https://7tool.ru/c/stanki-sverlilnye", searchEngine: "Google", query: "магнитный станок", visits: 5, users: 5, pageviews: 7, bounceRate: "20%" },
    ]);
    assert.equal(validateYandexMetricaImport(input).rows[0].bounceRate, 0.125);
    const first = importYandexMetrica(fixture.db, input);
    assert.equal(first.importedRows, 2);
    assert.equal(importYandexMetrica(fixture.db, input).duplicate, true);
    const columns = fixture.db.prepare("PRAGMA table_info(yandex_metrica_organic_daily)").all().map((row) => row.name);
    assert.equal(columns.some((name) => /ip|client_id|session|cookie|user_agent/i.test(name)), false);
    assert.throws(() => fixture.db.prepare("UPDATE yandex_metrica_organic_daily SET visits = 1").run(), /immutable/);
  } finally { cleanup(fixture); }
});

test("Yandex opportunities separate demand discovery from existing-performance updates", () => {
  const fixture = fixtureDb();
  try {
    importYandexWordstat(fixture.db, wordstatInput([
      { query: "магнитный станок", demandCount: 1200 },
      { query: "как выбрать магнитный станок", demandCount: 480 },
    ]));
    importYandexWebmaster(fixture.db, webmasterInput([
      { date: "2026-08-20", page: "https://7tool.ru/c/stanki-sverlilnye", query: "магнитный станок", region: 213, clicks: 10, impressions: 200, ctr: 0.05, position: 9 },
      { date: "2026-08-20", page: "https://7tool.ru/c/stanki-sverlilnye?brand=Karnasch", query: "станок karnasch", region: 213, clicks: 20, impressions: 400, ctr: 0.05, position: 8 },
      { date: "2026-08-20", page: "https://7tool.ru/p/unregistered", query: "неизвестный станок", region: 213, clicks: 10, impressions: 300, ctr: 1 / 30, position: 10 },
    ]));
    importYandexMetrica(fixture.db, metricaInput([
      { date: "2026-08-20", page: "https://7tool.ru/c/stanki-sverlilnye", searchEngine: "Yandex", query: "магнитный станок", visits: 20, users: 18, pageviews: 30, bounceRate: 10 },
    ]));
    const input = { ...period, regionKey: "RU-MOW", wordstatDevice: "ALL", minWordstatDemand: 100, minWebmasterImpressions: 100 };
    const items = discoverYandexQueryOpportunities(fixture.db, input);
    assert.equal(items.length, 2);
    const existing = items.find((item) => item.discoveryBasis === "WEBMASTER_EXISTING_PERFORMANCE");
    assert.equal(existing.recommendedAction, "UPDATE_EXISTING");
    assert.equal(existing.existingUrlId, "url-category");
    assert.equal(existing.wordstatDemand, 1200);
    assert.equal(existing.metricaOrganicVisits, 20);
    const demand = items.find((item) => item.discoveryBasis === "WORDSTAT_DEMAND");
    assert.equal(demand.recommendedAction, "DEMAND_REVIEW");
    assert.equal(demand.existingUrlId, null);
    assert.ok(items.every((item) => !JSON.stringify(item).includes("CREATE")));
    assert.equal(materializeYandexQueryOpportunities(fixture.db, { ...input, evaluatedAt: 1_777_100_001_000 }).saved, 2);
    assert.equal(materializeYandexQueryOpportunities(fixture.db, { ...input, evaluatedAt: 1_777_100_002_000 }).saved, 0);
    assert.deepEqual(fixture.db.prepare("SELECT DISTINCT recommended_action FROM yandex_query_opportunity_snapshots ORDER BY recommended_action").all().map((row) => row.recommended_action), ["DEMAND_REVIEW", "UPDATE_EXISTING"]);
  } finally { cleanup(fixture); }
});

test("migration 014 indexes match real discovery queries and rollback cleanly", () => {
  const fixture = fixtureDb();
  try {
    fixture.db.pragma("optimize");
    const webmasterPlan = fixture.db.prepare(`EXPLAIN QUERY PLAN SELECT page_path FROM yandex_webmaster_performance_daily
      WHERE is_facet = 0 AND data_date BETWEEN '2026-08-01' AND '2026-08-20'`).all().map((row) => row.detail).join("\n");
    const wordstatPlan = fixture.db.prepare(`EXPLAIN QUERY PLAN SELECT query_hash FROM yandex_wordstat_demand
      WHERE region_key = 'RU-MOW' AND device = 'ALL' ORDER BY demand_count DESC`).all().map((row) => row.detail).join("\n");
    assert.match(webmasterPlan, /idx_yandex_webmaster_existing_performance/);
    assert.match(wordstatPlan, /idx_yandex_wordstat_demand_discovery/);
    fixture.db.exec(migrationPart("014_yandex_seo.sql", "down"));
    for (const table of [
      "yandex_import_runs", "yandex_webmaster_performance_daily", "yandex_wordstat_demand",
      "yandex_metrica_organic_daily", "yandex_query_opportunity_snapshots",
    ]) assert.equal(fixture.db.prepare("SELECT COUNT(*) AS count FROM sqlite_schema WHERE type = 'table' AND name = ?").get(table).count, 0);
  } finally { cleanup(fixture); }
});
