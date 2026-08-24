import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { parseGscImport } from "../scripts/lib/gsc-import.mjs";
import {
  FACET_CLASSIFICATIONS,
  buildSearchAnalyticsRequest,
  classifyCoreWebVital,
  classifyFacet,
  evaluateGoogleQuickWins,
  importGoogleSearchConsole,
  listGooglePerformanceForUrl,
  materializeGoogleQuickWins,
  recordCoreWebVital,
  registerFacetPolicy,
  summarizeCoreWebVitals,
  validateGoogleSearchConsoleImport,
} from "../src/lib/google-seo.mjs";
import { auditImageSeo, buildImageSitemap, descriptiveImageFilename } from "../src/lib/image-seo.mjs";
import { mediaPublicUrl, storageKeyFromPublicMediaPath } from "../src/lib/media-storage.mjs";

const migrationPath = path.resolve(import.meta.dirname, "..", "scripts", "migrations", "013_google_seo.sql");
const migrationSql = fs.readFileSync(migrationPath, "utf8");
const migrationUp = migrationSql.slice(migrationSql.indexOf("-- migrate:up") + "-- migrate:up".length, migrationSql.indexOf("-- migrate:down"));
const migrationDown = migrationSql.slice(migrationSql.indexOf("-- migrate:down") + "-- migrate:down".length);

function fixtureDb({ migrate = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "7tool-google-seo-"));
  const db = new Database(path.join(dir, "data.db"));
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE site_urls (
      id TEXT PRIMARY KEY, path TEXT NOT NULL UNIQUE, page_type TEXT NOT NULL,
      index_status TEXT NOT NULL, http_status INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    INSERT INTO site_urls VALUES
      ('url-category', '/c/stanki', 'CATEGORY', 'INDEX', 200, 1, 1),
      ('url-page-2', '/c/stanki?page=2', 'CATEGORY', 'INDEX', 200, 1, 1),
      ('url-low', '/p/low', 'PRODUCT', 'INDEX', 200, 1, 1),
      ('url-position-5', '/p/position-5', 'PRODUCT', 'INDEX', 200, 1, 1),
      ('url-landing', '/lp/stanki/weldon-19', 'SEO_LANDING', 'INDEX', 200, 1, 1);
  `);
  if (migrate) db.exec(migrationUp);
  return { dir, db };
}

function cleanup({ dir, db }) {
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
}

const sourceSha256 = "a".repeat(64);
const dimensions = ["date", "page", "query", "country", "device"];
const row = (page, query, impressions, clicks, position, overrides = {}) => ({
  keys: ["2026-08-20", page, query, "rus", "DESKTOP"],
  impressions,
  clicks,
  ctr: impressions ? clicks / impressions : 0,
  position,
  ...overrides,
});

test("GSC request and CSV/JSON imports preserve all required dimensions and metrics", () => {
  assert.deepEqual(buildSearchAnalyticsRequest({ startDate: "2026-08-01", endDate: "2026-08-20", type: "web" }), {
    startDate: "2026-08-01", endDate: "2026-08-20", dimensions, type: "web", dataState: "final", rowLimit: 25_000, startRow: 0,
  });
  const csv = "Дата;Страница;Запрос;Страна;Устройство;Клики;Показы;CTR;Позиция\n2026-08-20;https://7tool.ru/c/stanki;магнитный станок;rus;MOBILE;5;100;5%;9,5";
  assert.deepEqual(parseGscImport(csv).rows[0], {
    keys: ["2026-08-20", "https://7tool.ru/c/stanki", "магнитный станок", "rus", "MOBILE"],
    clicks: "5", impressions: "100", ctr: "5%", position: "9,5",
  });
  const json = parseGscImport(JSON.stringify({ rows: [{ date: "2026-08-20", page: "https://7tool.ru/", query: "инструмент", country: "rus", device: "TABLET", clicks: 1, impressions: 10, ctr: 0.1, position: 8 }] }));
  assert.equal(json.rows[0].keys[4], "TABLET");
  assert.throws(() => validateGoogleSearchConsoleImport({
    propertyUri: "sc-domain:7tool.ru", periodStart: "2026-08-20", periodEnd: "2026-08-20",
    searchType: "web", dimensions, acquisitionMethod: "SEARCH_CONSOLE_EXPORT", sourceRef: "bad.csv",
    sourceSha256, rows: [row("https://7tool.ru/", "broken ctr", 100, 10, 9, { ctr: 0.9 })],
  }), /CTR does not match/);
  assert.throws(() => buildSearchAnalyticsRequest({ startDate: "2026-08-20", endDate: "2026-08-01" }), /must not precede/);
});

test("daily GSC import is immutable, idempotent, exact-URL aware and rejects unsafe properties", () => {
  const fixture = fixtureDb();
  try {
    const input = {
      propertyUri: "sc-domain:7tool.ru", periodStart: "2026-08-20", periodEnd: "2026-08-20",
      searchType: "web", dimensions, acquisitionMethod: "SEARCH_CONSOLE_EXPORT",
      sourceRef: "gsc-export.csv", sourceSha256,
      rows: [
        row("https://www.7tool.ru/c/stanki?utm_source=test", "магнитный станок", 140, 14, 9),
        row("https://7tool.ru/c/stanki?page=2", "станок страница 2", 120, 6, 12),
        row("https://7tool.ru/c/stanki?brand=Karnasch", "станок karnasch", 500, 25, 10),
        row("https://7tool.ru/p/unregistered", "неизвестный товар", 500, 25, 10),
        row("https://7tool.ru/p/low", "редкий товар", 20, 1, 15),
        row("https://7tool.ru/p/position-5", "топ товар", 500, 50, 5),
      ],
      importedAt: 1_777_000_000_000,
    };
    const first = importGoogleSearchConsole(fixture.db, input);
    assert.equal(first.importedRows, 6);
    assert.equal(importGoogleSearchConsole(fixture.db, input).duplicate, true);
    const stored = fixture.db.prepare("SELECT * FROM gsc_search_performance_daily WHERE page_path = '/c/stanki?page=2'").get();
    assert.equal(stored.route_path, "/c/stanki");
    assert.equal(stored.country, "rus");
    assert.equal(stored.device, "DESKTOP");
    assert.equal(stored.is_facet, 0);
    assert.equal(fixture.db.prepare("SELECT is_facet FROM gsc_search_performance_daily WHERE page_path LIKE '%brand%'").get().is_facet, 1);
    assert.throws(() => fixture.db.prepare("UPDATE gsc_import_runs SET row_count = 1").run(), /immutable/);
    assert.throws(() => importGoogleSearchConsole(fixture.db, { ...input, propertyUri: "https://7tool.ru/private" }), /without credentials or a path/);
    assert.throws(() => importGoogleSearchConsole(fixture.db, { ...input, propertyUri: "https://user:secret@7tool.ru/" }), /without credentials or a path/);
    assert.throws(() => importGoogleSearchConsole(fixture.db, { ...input, rows: [row("https://user:secret@7tool.ru/c/stanki", "unsafe", 100, 10, 9)] }), /must belong/);
    const performance = listGooglePerformanceForUrl(fixture.db, {
      propertyUri: "sc-domain:7tool.ru", pagePath: "/c/stanki?page=2&utm_source=ignored",
      periodStart: "2026-08-20", periodEnd: "2026-08-20",
    });
    assert.equal(performance.length, 1);
    assert.equal(performance[0].query, "станок страница 2");
  } finally { cleanup(fixture); }
});

test("Quick Wins mark only existing pages at positions 6-20 and never propose creation", () => {
  const fixture = fixtureDb();
  try {
    importGoogleSearchConsole(fixture.db, {
      propertyUri: "sc-domain:7tool.ru", periodStart: "2026-08-20", periodEnd: "2026-08-20",
      searchType: "web", dimensions, acquisitionMethod: "SEARCH_CONSOLE_API", sourceRef: "api://fixture",
      sourceSha256, importedAt: 1_777_000_000_000,
      rows: [
        row("https://7tool.ru/c/stanki", "магнитный станок", 140, 14, 9),
        row("https://7tool.ru/c/stanki?page=2", "станок страница 2", 120, 6, 12),
        row("https://7tool.ru/c/stanki?brand=Karnasch", "станок karnasch", 500, 25, 10),
        row("https://7tool.ru/p/unregistered", "неизвестный товар", 500, 25, 10),
        row("https://7tool.ru/p/low", "редкий товар", 20, 1, 15),
        row("https://7tool.ru/p/position-5", "топ товар", 500, 50, 5),
      ],
    });
    const input = { propertyUri: "sc-domain:7tool.ru", periodStart: "2026-08-20", periodEnd: "2026-08-20", minImpressions: 100 };
    const items = evaluateGoogleQuickWins(fixture.db, input);
    assert.deepEqual(items.map((item) => item.pagePath), ["/c/stanki", "/c/stanki?page=2"]);
    assert.ok(items.every((item) => item.status === "HIGH_PRIORITY_UPDATE" && item.decision === "UPDATE"));
    assert.ok(items.every((item) => item.averagePosition >= 6 && item.averagePosition <= 20));
    assert.equal(materializeGoogleQuickWins(fixture.db, { ...input, evaluatedAt: 1_777_000_000_100 }).saved, 2);
    assert.equal(materializeGoogleQuickWins(fixture.db, { ...input, evaluatedAt: 1_777_000_000_200 }).saved, 0);
    const decisions = fixture.db.prepare("SELECT DISTINCT decision FROM google_quick_wins").all().map((item) => item.decision);
    assert.deepEqual(decisions, ["UPDATE"]);
  } finally { cleanup(fixture); }
});

test("Core Web Vital thresholds, privacy-minimal storage and p75 aggregation are enforced", () => {
  assert.equal(classifyCoreWebVital("LCP", 2500).rating, "GOOD");
  assert.equal(classifyCoreWebVital("INP", 201).rating, "NEEDS_IMPROVEMENT");
  assert.equal(classifyCoreWebVital("CLS", 0.26).rating, "POOR");
  const before = fixtureDb({ migrate: false });
  try { assert.equal(recordCoreWebVital(before.db, {}).reason, "SCHEMA_NOT_APPLIED"); } finally { cleanup(before); }
  const fixture = fixtureDb();
  try {
    [100, 150, 220, 600].forEach((value, index) => recordCoreWebVital(fixture.db, {
      metricId: `metric-id-${index}`, name: "INP", value, pagePath: "/c/stanki?secret=ignored",
      navigationType: "navigate", capturedAt: 1_777_000_000_000 + index,
    }));
    const summary = summarizeCoreWebVitals(fixture.db, { pagePath: "/c/stanki" });
    assert.deepEqual(summary.find((item) => item.name === "INP"), { name: "INP", value: 220, rating: "NEEDS_IMPROVEMENT", samples: 4, p75: 220 });
    const columns = fixture.db.prepare("PRAGMA table_info(core_web_vital_samples)").all().map((item) => item.name);
    assert.equal(columns.some((name) => /ip|user_agent|session|cookie/i.test(name)), false);
  } finally { cleanup(fixture); }
});

test("facets default to NON_INDEXABLE_FACET and indexable landings require human review", () => {
  const fixture = fixtureDb();
  try {
    const fallback = classifyFacet(fixture.db, { scopePath: "/c/stanki", facetKey: "brand", facetValue: "Karnasch" });
    assert.equal(fallback.classification, FACET_CLASSIFICATIONS.NON_INDEXABLE);
    assert.equal(fallback.reviewed, false);
    assert.throws(() => registerFacetPolicy(fixture.db, {
      scopePath: "/c/stanki", facetKey: "brand", facetValue: "Karnasch", classification: FACET_CLASSIFICATIONS.INDEXABLE,
      landingUrlId: "url-landing", rationale: "Reviewed demand and stable inventory.", reviewedBy: "automation",
    }), /human reviewer/);
    registerFacetPolicy(fixture.db, {
      scopePath: "/c/stanki", facetKey: "brand", facetValue: "Karnasch", classification: FACET_CLASSIFICATIONS.INDEXABLE,
      landingUrlId: "url-landing", rationale: "Reviewed demand, distinct intent and stable inventory.", reviewedBy: "seo-editor",
      reviewedAt: 1_777_000_000_000,
    });
    const reviewed = classifyFacet(fixture.db, { scopePath: "/c/stanki", facetKey: "brand", facetValue: "Karnasch" });
    assert.equal(reviewed.classification, FACET_CLASSIFICATIONS.INDEXABLE);
    assert.equal(reviewed.landingPath, "/lp/stanki/weldon-19");
  } finally { cleanup(fixture); }
});

test("image SEO creates descriptive immutable routes and a rights-local image sitemap format", () => {
  assert.equal(descriptiveImageFilename("Магнитный сверлильный станок", 1280, "webp"), "1280-magnitnyy-sverlilnyy-stanok.webp");
  const key = "asset-image-123/1280.webp";
  const url = mediaPublicUrl(key, "Магнитный сверлильный станок");
  assert.equal(storageKeyFromPublicMediaPath(url.replace("/media/", "")), key);
  assert.deepEqual(auditImageSeo({ alt: "Станок", width: 1280, height: 960, mime: "image/webp", hasSurroundingText: true, priority: true, loading: "eager" }), { status: "PASS", issues: [] });
  assert.ok(auditImageSeo({ alt: "", width: 0, height: 0, mime: "image/jpeg", hasSurroundingText: false, priority: true, loading: "lazy" }).issues.includes("LCP_IMAGE_LAZY_LOADED"));
  const xml = buildImageSitemap([{ loc: "https://7tool.ru/articles/vybor", images: [`https://7tool.ru${url}`] }]);
  assert.match(xml, /xmlns:image=/);
  assert.match(xml, /1280-magnitnyy-sverlilnyy-stanok\.webp/);
  assert.throws(() => buildImageSitemap([{ loc: "https://example.com/x", images: [] }]), /must belong/);
});

test("Phase 16 routes and components keep facets, LCP images and RUM guardrails explicit", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const productImage = fs.readFileSync(path.join(root, "src", "components", "ProductImage.tsx"), "utf8");
  const hero = fs.readFileSync(path.join(root, "src", "components", "Hero.tsx"), "utf8");
  const chips = fs.readFileSync(path.join(root, "src", "components", "QuickChips.tsx"), "utf8");
  const webVitals = fs.readFileSync(path.join(root, "src", "components", "WebVitals.tsx"), "utf8");
  const endpoint = fs.readFileSync(path.join(root, "src", "app", "api", "analytics", "web-vitals", "route.ts"), "utf8");
  assert.match(productImage, /<Image/);
  assert.match(productImage, /priority=\{priority\}/);
  assert.match(productImage, /loading=\{priority \? undefined : "lazy"\}/);
  assert.match(hero, /<ProductImage p=\{p\} priority/);
  assert.match(chips, /rel="nofollow"/);
  assert.match(chips, /NON_INDEXABLE_FACET/);
  assert.match(webVitals, /LCP.*INP.*CLS/);
  assert.doesNotMatch(endpoint, /userAgent|user_agent|cookie|ipAddress/);
});

test("migration 013 query indexes are usable and rollback is clean", () => {
  const fixture = fixtureDb();
  try {
    fixture.db.pragma("optimize");
    const quickPlan = fixture.db.prepare(`EXPLAIN QUERY PLAN SELECT page_path FROM gsc_search_performance_daily
      WHERE search_type = 'WEB' AND data_date = '2026-08-20' AND is_facet = 0`).all().map((item) => item.detail).join("\n");
    const cwvPlan = fixture.db.prepare(`EXPLAIN QUERY PLAN SELECT metric_value FROM core_web_vital_samples
      WHERE page_path = '/c/stanki' AND metric_name = 'LCP' ORDER BY captured_at DESC`).all().map((item) => item.detail).join("\n");
    assert.match(quickPlan, /idx_gsc_performance_quick_wins/);
    assert.match(cwvPlan, /idx_core_web_vitals_page_metric/);
    fixture.db.exec(migrationDown);
    for (const table of ["gsc_import_runs", "gsc_search_performance_daily", "google_quick_wins", "core_web_vital_samples", "facet_indexing_policies"]) {
      assert.equal(fixture.db.prepare("SELECT COUNT(*) AS count FROM sqlite_schema WHERE type = 'table' AND name = ?").get(table).count, 0);
    }
  } finally { cleanup(fixture); }
});
