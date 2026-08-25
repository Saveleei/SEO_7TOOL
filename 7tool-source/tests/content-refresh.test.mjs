import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

import {
  CONTENT_REFRESH_DECISIONS,
  CONTENT_REFRESH_MODEL_VERSION,
  assessContentPublicationCollision,
  evaluateContentRefresh,
  getExpertProfileForContent,
  materializeContentRefresh,
  registerExpertProfile,
  requireContentPublicationClearance,
  requireVerifiedExpertReview,
  reviewContentByExpert,
  reviewContentRefreshAssessment,
  semanticSimilarity,
} from "../src/lib/content-refresh.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationPath = path.join(root, "scripts", "migrations", "018_content_refresh.sql");
const migrationSql = fs.readFileSync(migrationPath, "utf8");
const upSql = migrationSql.slice(migrationSql.indexOf("-- migrate:up") + "-- migrate:up".length, migrationSql.indexOf("-- migrate:down"));
const downSql = migrationSql.slice(migrationSql.indexOf("-- migrate:down") + "-- migrate:down".length);

function fixtureDb() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "7tool-refresh-"));
  const db = new Database(path.join(directory, "fixture.db"));
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE categories (
      slug TEXT PRIMARY KEY, title TEXT NOT NULL, intro TEXT, seo_text TEXT,
      meta_title TEXT, meta_description TEXT, published INTEGER NOT NULL
    );
    CREATE TABLE products (
      id TEXT PRIMARY KEY, slug TEXT NOT NULL, title TEXT NOT NULL, brand TEXT,
      description TEXT, seo_text TEXT, meta_title TEXT, meta_description TEXT,
      draft INTEGER NOT NULL
    );
    CREATE TABLE content_opportunities (
      id TEXT PRIMARY KEY, cannibalization_risk TEXT NOT NULL, duplicate_risk TEXT NOT NULL
    );
    CREATE TABLE site_urls (
      id TEXT PRIMARY KEY, path TEXT NOT NULL UNIQUE, page_type TEXT NOT NULL,
      entity_type TEXT, entity_id TEXT, index_status TEXT NOT NULL,
      http_status INTEGER, content_fingerprint TEXT
    );
    CREATE TABLE content_assets (
      id TEXT PRIMARY KEY, content_type TEXT NOT NULL, site_url_id TEXT REFERENCES site_urls(id),
      opportunity_id TEXT REFERENCES content_opportunities(id), slug TEXT NOT NULL,
      status TEXT NOT NULL, title TEXT NOT NULL, h1 TEXT NOT NULL, meta_title TEXT,
      meta_description TEXT, excerpt TEXT, category_slug TEXT NOT NULL REFERENCES categories(slug),
      intent_id TEXT NOT NULL, cluster_id TEXT NOT NULL, expert_reviewer TEXT,
      canonical TEXT NOT NULL, index_status TEXT NOT NULL, human_reviewed INTEGER NOT NULL,
      current_revision_id TEXT, published_at INTEGER, updated_at INTEGER NOT NULL
    );
    CREATE TABLE content_revisions (
      id TEXT PRIMARY KEY, content_asset_id TEXT NOT NULL REFERENCES content_assets(id),
      content_body TEXT NOT NULL, content_hash TEXT NOT NULL
    );
    CREATE TABLE content_products (
      content_asset_id TEXT NOT NULL REFERENCES content_assets(id),
      product_id TEXT NOT NULL REFERENCES products(id)
    );
    CREATE TABLE content_internal_links (
      content_asset_id TEXT NOT NULL REFERENCES content_assets(id),
      target_path TEXT NOT NULL, target_site_url_id TEXT REFERENCES site_urls(id)
    );
    CREATE TABLE intent_url_mappings (
      intent_id TEXT NOT NULL, site_url_id TEXT NOT NULL REFERENCES site_urls(id),
      mapping_role TEXT NOT NULL, status TEXT NOT NULL
    );
    CREATE TABLE gsc_import_runs (
      id TEXT PRIMARY KEY, property_uri TEXT NOT NULL, period_start TEXT NOT NULL,
      period_end TEXT NOT NULL, search_type TEXT NOT NULL, status TEXT NOT NULL,
      imported_at INTEGER NOT NULL
    );
    CREATE TABLE gsc_search_performance_daily (
      id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES gsc_import_runs(id),
      data_date TEXT NOT NULL, search_type TEXT NOT NULL, page_path TEXT NOT NULL,
      query_hash TEXT NOT NULL, impressions REAL NOT NULL, clicks REAL NOT NULL,
      average_position REAL, is_facet INTEGER NOT NULL
    );
    CREATE TABLE yandex_import_runs (
      id TEXT PRIMARY KEY, subject_ref TEXT NOT NULL, source_system TEXT NOT NULL,
      dataset_type TEXT NOT NULL, period_start TEXT NOT NULL, period_end TEXT NOT NULL,
      status TEXT NOT NULL, imported_at INTEGER NOT NULL
    );
    CREATE TABLE yandex_webmaster_performance_daily (
      id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES yandex_import_runs(id),
      data_date TEXT NOT NULL, page_path TEXT NOT NULL, query_hash TEXT NOT NULL,
      impressions REAL NOT NULL, clicks REAL NOT NULL, average_position REAL,
      is_facet INTEGER NOT NULL
    );
    CREATE TABLE content_roi_snapshots (
      id TEXT PRIMARY KEY, page_path TEXT NOT NULL, period_start TEXT NOT NULL,
      period_end TEXT NOT NULL, leads INTEGER NOT NULL, evaluated_at INTEGER NOT NULL
    );

    INSERT INTO categories VALUES (
      'stanki-sverlilnye', 'Сверлильные станки', 'Подбор станков',
      'Проверенные станки и рекомендации.', 'Станки', 'Подбор станков', 1
    );
    INSERT INTO products VALUES (
      'product-1', 'heden-dm-50', 'Магнитный станок HEDEN DM-50', 'HEDEN',
      'Промышленный магнитный сверлильный станок.', 'Параметры станка.',
      'HEDEN DM-50', 'Характеристики станка', 0
    );
    INSERT INTO content_opportunities VALUES ('opportunity-1', 'LOW', 'LOW'), ('opportunity-2', 'LOW', 'LOW');
    INSERT INTO site_urls VALUES
      ('url-1', '/articles/vybor-stanka', 'ARTICLE', 'CONTENT_ASSET', 'content-1', 'INDEX', 200, 'hash-1'),
      ('url-2', '/articles/redkaya-tema', 'ARTICLE', 'CONTENT_ASSET', 'content-2', 'INDEX', 200, 'hash-2'),
      ('url-target', '/c/stanki-sverlilnye', 'CATEGORY', 'CATEGORY', 'stanki-sverlilnye', 'INDEX', 200, 'category-hash');
  `);
  seedArticle(db, {
    id: "content-1", revisionId: "revision-1", opportunityId: "opportunity-1",
    siteUrlId: "url-1", slug: "vybor-stanka", clusterId: "cluster-1", intentId: "intent-1",
    body: "Как выбрать магнитный сверлильный станок по материалу, диаметру отверстия и проверенной совместимости оснастки.",
    hash: "hash-1", status: "PUBLISHED",
  });
  seedArticle(db, {
    id: "content-2", revisionId: "revision-2", opportunityId: "opportunity-2",
    siteUrlId: "url-2", slug: "redkaya-tema", clusterId: "cluster-2", intentId: "intent-2",
    body: "Редкая процедура обслуживания защитного кожуха промышленного оборудования с отдельным регламентом проверки.",
    hash: "hash-2", status: "PUBLISHED",
  });
  db.exec(`
    INSERT INTO content_products VALUES ('content-1', 'product-1');
    INSERT INTO gsc_import_runs VALUES
      ('gsc-current', 'sc-domain:7tool.ru', '2026-05-01', '2026-07-29', 'WEB', 'COMPLETE', 2000),
      ('gsc-previous', 'sc-domain:7tool.ru', '2026-02-01', '2026-04-30', 'WEB', 'COMPLETE', 1000);
    INSERT INTO yandex_import_runs VALUES
      ('yandex-current', 'https:7tool.ru:443', 'YANDEX_WEBMASTER', 'WEBMASTER_URL_QUERIES', '2026-05-01', '2026-07-29', 'COMPLETE', 2000),
      ('yandex-previous', 'https:7tool.ru:443', 'YANDEX_WEBMASTER', 'WEBMASTER_URL_QUERIES', '2026-02-01', '2026-04-30', 'COMPLETE', 1000);
    INSERT INTO gsc_search_performance_daily VALUES
      ('gsc-c-1', 'gsc-current', '2026-07-20', 'WEB', '/articles/vybor-stanka', 'query-a', 600, 6, 10, 0),
      ('gsc-c-2', 'gsc-current', '2026-07-20', 'WEB', '/articles/vybor-stanka', 'query-b', 200, 2, 10, 0),
      ('gsc-p-1', 'gsc-previous', '2026-04-20', 'WEB', '/articles/vybor-stanka', 'query-a', 100, 4, 9, 0);
    INSERT INTO yandex_webmaster_performance_daily VALUES
      ('y-c-1', 'yandex-current', '2026-07-20', '/articles/vybor-stanka', 'query-c', 200, 2, 10, 0),
      ('y-p-1', 'yandex-previous', '2026-04-20', '/articles/vybor-stanka', 'query-a', 50, 2, 9, 0);
    INSERT INTO content_roi_snapshots VALUES
      ('roi-1', '/articles/vybor-stanka', '2026-05-01', '2026-07-29', 2, 3000),
      ('roi-2', '/articles/redkaya-tema', '2026-05-01', '2026-07-29', 0, 3000);
  `);
  db.exec(upSql);
  return { db, directory };
}

function seedArticle(db, { id, revisionId, opportunityId, siteUrlId, slug, clusterId, intentId, body, hash, status }) {
  db.prepare(`
    INSERT INTO content_assets (
      id, content_type, site_url_id, opportunity_id, slug, status, title, h1,
      meta_title, meta_description, excerpt, category_slug, intent_id, cluster_id,
      expert_reviewer, canonical, index_status, human_reviewed, current_revision_id, updated_at
    ) VALUES (?, 'ARTICLE', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'stanki-sverlilnye', ?, ?,
      'Временный reviewer', ?, ?, 1, ?, 1000)
  `).run(
    id, siteUrlId, opportunityId, slug, status, `Статья ${slug}`, `Статья ${slug}`,
    `Статья ${slug}`, `Описание ${slug}`, `Анонс ${slug}`, intentId, clusterId,
    `/articles/${slug}`, status === "PUBLISHED" ? "INDEX" : "NOINDEX", revisionId,
  );
  db.prepare("INSERT INTO content_revisions VALUES (?, ?, ?, ?)").run(revisionId, id, JSON.stringify({ body }), hash);
}

function cleanup(fixture) {
  fixture.db.close();
  fs.rmSync(fixture.directory, { recursive: true, force: true });
}

function refreshInput() {
  return {
    periodStart: "2026-05-01",
    periodEnd: "2026-07-29",
    previousPeriodStart: "2026-02-01",
    previousPeriodEnd: "2026-04-30",
    googlePropertyUri: "sc-domain:7tool.ru",
    yandexSubjectRef: "https:7tool.ru:443",
    highImpressionsThreshold: 500,
    expectedCtrCurve: [
      { maxPosition: 5, expectedCtr: 0.1 },
      { maxPosition: 10, expectedCtr: 0.04 },
      { maxPosition: 20, expectedCtr: 0.02 },
      { maxPosition: 100, expectedCtr: 0.01 },
    ],
    expectedCtrSourceRef: "reviewed internal CTR benchmark 2026-Q2",
    minimumPruningDays: 90,
    semanticSimilarityThreshold: 0.82,
    evaluatedBy: "refresh-engine",
    evaluatedAt: 4000,
  };
}

function seedDuplicateReadyArticle(db) {
  db.prepare("INSERT INTO content_opportunities VALUES ('opportunity-3', 'LOW', 'LOW')").run();
  seedArticle(db, {
    id: "content-3", revisionId: "revision-3", opportunityId: "opportunity-3",
    siteUrlId: null, slug: "novyy-vybor-stanka", clusterId: "cluster-3", intentId: "intent-3",
    body: "Как выбрать магнитный сверлильный станок по материалу, диаметру отверстия и проверенной совместимости оснастки.",
    hash: "hash-3", status: "READY",
  });
  db.prepare("INSERT INTO content_products VALUES ('content-3', 'product-1')").run();
}

test("Phase 21 exposes the full review vocabulary and deterministic semantic similarity", () => {
  assert.equal(CONTENT_REFRESH_MODEL_VERSION, "phase21-content-refresh-v1");
  assert.deepEqual(CONTENT_REFRESH_DECISIONS, ["KEEP", "UPDATE", "MERGE", "REDIRECT", "NOINDEX", "DELETE"]);
  assert.ok(semanticSimilarity(
    "выбор магнитного сверлильного станка по материалу и диаметру отверстия",
    "как выбрать магнитный сверлильный станок по диаметру отверстия и материалу",
  ) > 0.65);
  assert.equal(semanticSimilarity("редкая процедура кожуха", "цены на борфрезы"), 0);
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  assert.equal(packageJson.scripts["seo:refresh"], "node scripts/content-refresh.mjs");
  const cli = fs.readFileSync(path.join(root, "scripts", "content-refresh.mjs"), "utf8");
  assert.match(cli, /never execute DELETE, REDIRECT, NOINDEX, MERGE or publication automatically/);
});

test("refresh engine finds quick wins, CTR decay, query expansion and zero-signal pruning candidates", () => {
  const fixture = fixtureDb();
  try {
    const preview = evaluateContentRefresh(fixture.db, refreshInput());
    assert.equal(preview.durationDays, 90);
    assert.equal(preview.assessments.length, 2);
    const quickWin = preview.assessments.find((item) => item.contentId === "content-1");
    assert.equal(quickWin.impressions, 1000);
    assert.equal(quickWin.clicks, 10);
    assert.equal(quickWin.averagePosition, 10);
    assert.equal(quickWin.updatePriority, "HIGH");
    assert.equal(quickWin.recommendedUpdate, "COMPREHENSIVE_UPDATE");
    assert.deepEqual(quickWin.reasonCodes.slice(0, 3), [
      "UPDATE_PRIORITY_HIGH", "CTR_BELOW_EXPECTED", "QUERY_CLUSTER_EXPANDED",
    ]);
    const decay = preview.assessments.find((item) => item.contentId === "content-2");
    assert.equal(decay.pruningEligible, true);
    assert.equal(decay.systemRecommendation, "UPDATE");
    assert.match(decay.reasonCodes.join(","), /LONG_ZERO_SIGNAL/);

    const saved = materializeContentRefresh(fixture.db, refreshInput());
    assert.equal(saved.duplicate, false);
    assert.equal(saved.assessments.length, 2);
    assert.equal(materializeContentRefresh(fixture.db, refreshInput()).duplicate, true);
    assert.equal(materializeContentRefresh(fixture.db, { ...refreshInput(), evaluatedAt: 4500 }).duplicate, true);
    assert.throws(
      () => fixture.db.prepare("UPDATE content_refresh_assessments SET impressions = 1").run(),
      /immutable/,
    );

    const decayRow = saved.assessments.find((item) => item.content_id === "content-2");
    assert.throws(() => reviewContentRefreshAssessment(fixture.db, {
      assessmentId: decayRow.id, decision: "DELETE", reviewedBy: "system-bot",
      rationale: "This rationale is deliberately long enough but must be rejected because the actor is automated and not human.",
    }), /real human/);
    const review = reviewContentRefreshAssessment(fixture.db, {
      assessmentId: decayRow.id,
      decision: "DELETE",
      reviewedBy: "seo-owner@example.test",
      rationale: "Страница не получает показов, кликов, внутренних ссылок и лидов весь проверенный период; решение требует отдельного исполнения и резервной копии.",
      reviewedAt: 5000,
    });
    assert.equal(review.decision, "DELETE");
    assert.equal(fixture.db.prepare("SELECT status FROM content_assets WHERE id = 'content-2'").get().status, "PUBLISHED");
    assert.equal(fixture.db.prepare("SELECT index_status FROM site_urls WHERE id = 'url-2'").get().index_status, "INDEX");
  } finally { cleanup(fixture); }
});

test("semantic duplicates become MERGE_REQUIRED and high cross-surface intent overlap blocks publication", () => {
  const fixture = fixtureDb();
  try {
    seedDuplicateReadyArticle(fixture.db);
    const duplicate = assessContentPublicationCollision(fixture.db, "content-3");
    assert.equal(duplicate.duplicate.risk, "HIGH");
    assert.equal(duplicate.duplicate.pagePath, "/articles/vybor-stanka");
    assert.throws(
      () => requireContentPublicationClearance(fixture.db, { id: "content-3" }),
      /MERGE_REQUIRED/,
    );

    fixture.db.prepare("INSERT INTO intent_url_mappings VALUES ('intent-3', 'url-target', 'PRIMARY', 'APPROVED')").run();
    const overlap = assessContentPublicationCollision(fixture.db, "content-3");
    assert.equal(overlap.cannibalization.risk, "HIGH");
    assert.ok(overlap.cannibalization.evidence.some((item) => item.code === "OTHER_PRIMARY_INTENT_URL"));
  } finally { cleanup(fixture); }
});

test("authorship accepts only human-verified real expert profiles with matching category and brand scope", () => {
  const fixture = fixtureDb();
  try {
    seedDuplicateReadyArticle(fixture.db);
    const article = fixture.db.prepare("SELECT * FROM content_assets WHERE id = 'content-3'").get();
    assert.equal(requireVerifiedExpertReview(fixture.db, article), null);
    assert.throws(() => registerExpertProfile(fixture.db, {
      name: "Иван Петров",
      photoPath: "/uploads/experts/ivan-petrov.webp",
      photoRightsRef: "owned photo release document 42",
      specialization: "Промышленное сверлильное оборудование и оснастка.",
      experienceText: "Десять лет практической работы с магнитными сверлильными станками.",
      identityEvidenceRef: "verified HR identity record 42",
      categories: ["stanki-sverlilnye"],
      brands: ["HEDEN"],
      reviewedBy: "automation-agent",
      reviewedAt: 6000,
    }), /real human/);
    const registered = registerExpertProfile(fixture.db, {
      name: "Иван Петров",
      photoPath: "/uploads/experts/ivan-petrov.webp",
      photoRightsRef: "owned photo release document 42",
      specialization: "Промышленное сверлильное оборудование и оснастка.",
      experienceText: "Десять лет практической работы с магнитными сверлильными станками.",
      identityEvidenceRef: "verified HR identity record 42",
      categories: ["stanki-sverlilnye"],
      brands: ["HEDEN"],
      reviewedBy: "chief-editor@example.test",
      reviewedAt: 6000,
    });
    assert.equal(registered.expert.status, "ACTIVE");
    assert.equal(registerExpertProfile(fixture.db, {
      name: "Иван Петров",
      photoPath: "/uploads/experts/ivan-petrov.webp",
      photoRightsRef: "owned photo release document 42",
      specialization: "Промышленное сверлильное оборудование и оснастка.",
      experienceText: "Десять лет практической работы с магнитными сверлильными станками.",
      identityEvidenceRef: "verified HR identity record 42",
      categories: ["stanki-sverlilnye"],
      brands: ["HEDEN"],
      reviewedBy: "chief-editor@example.test",
      reviewedAt: 6500,
    }).duplicate, true);
    const reviewed = reviewContentByExpert(fixture.db, {
      contentId: "content-3",
      expertId: registered.expert.id,
      decision: "APPROVED",
      reviewStatement: "Проверены технические формулировки, ограничения применения и совместимость упомянутой оснастки.",
      assignedBy: "chief-editor@example.test",
      reviewedAt: 7000,
    });
    assert.equal(reviewed.review.decision, "APPROVED");
    const current = fixture.db.prepare("SELECT * FROM content_assets WHERE id = 'content-3'").get();
    assert.equal(current.expert_reviewer, "Иван Петров");
    assert.equal(requireVerifiedExpertReview(fixture.db, current).name, "Иван Петров");
    const profile = getExpertProfileForContent(fixture.db, current.id, current.current_revision_id);
    assert.equal(profile.name, "Иван Петров");
    assert.deepEqual(profile.brands, ["HEDEN"]);
    assert.throws(() => fixture.db.prepare("UPDATE experts SET name = 'Другой эксперт'").run(), /immutable/);
  } finally { cleanup(fixture); }
});

test("migration 018 uses review queries indexes, rolls back cleanly and publication calls both Phase 21 gates", () => {
  const fixture = fixtureDb();
  try {
    const queuePlan = fixture.db.prepare(`
      EXPLAIN QUERY PLAN SELECT id FROM content_refresh_assessments
      WHERE status = 'REVIEW_REQUIRED' AND update_priority = 'HIGH'
      ORDER BY impressions DESC, evaluated_at DESC
    `).all().map((row) => row.detail).join("\n");
    assert.match(queuePlan, /idx_content_refresh_review_queue/);
    const historyPlan = fixture.db.prepare(`
      EXPLAIN QUERY PLAN SELECT * FROM content_refresh_assessments
      WHERE content_id = ? ORDER BY evaluated_at DESC
    `).all("content-1").map((row) => row.detail).join("\n");
    assert.match(historyPlan, /idx_content_refresh_content_history/);

    const platform = fs.readFileSync(path.join(root, "src", "lib", "content-platform.mjs"), "utf8");
    assert.match(platform, /requireVerifiedExpertReview\(db, article\)/);
    assert.match(platform, /requireContentPublicationClearance\(db, article\)/);

    fixture.db.exec(downSql);
    for (const table of [
      "content_refresh_runs", "content_refresh_assessments", "content_refresh_reviews",
      "experts", "expert_categories", "expert_brands", "content_expert_reviews",
    ]) {
      assert.equal(fixture.db.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = ?").get(table), undefined);
    }
  } finally { cleanup(fixture); }
});

test("SEO Intelligence is admin-only, exposes every required section and keeps credentials server-side", () => {
  const dashboard = fs.readFileSync(path.join(root, "src", "app", "admin", "seo", "page.tsx"), "utf8");
  const dashboardData = fs.readFileSync(path.join(root, "src", "lib", "seo-dashboard.ts"), "utf8");
  const adminLayout = fs.readFileSync(path.join(root, "src", "app", "admin", "layout.tsx"), "utf8");
  assert.match(dashboard, /await requireAdmin\(\)/);
  assert.match(adminLayout, /href="\/admin\/seo"/);
  for (const section of [
    "Dashboard", "Products", "Supplier Feed", "Keywords", "Clusters", "Pain Points",
    "Review Insights", "Competitors", "Opportunities", "Articles", "Comparisons",
    "Calculators", "Media", "Internal Links", "Leads", "Performance",
    "Publishing Queue", "Errors",
  ]) assert.match(dashboardData, new RegExp(`"${section}"`));
  for (const metric of [
    "Organic clicks", "Impressions", "Average position", "Indexed pages", "Organic leads",
    "Revenue", "Top categories", "Top articles", "Top products", "Quick wins",
    "Cannibalization", "Indexation issues", "Content decay",
  ]) assert.match(dashboard, new RegExp(metric));
  assert.doesNotMatch(`${dashboard}\n${dashboardData}`, /password|oauth|api[_ -]?secret|access[_ -]?token/i);

  for (const document of [
    "seo-platform.md", "wordstat-integration.md", "google-search-console-integration.md",
    "supplier-feed-intelligence.md", "marketplace-review-intelligence.md",
    "content-quality-system.md", "image-system.md", "product-knowledge-graph.md",
  ]) assert.equal(fs.existsSync(path.join(root, "docs", document)), true, document);
});
