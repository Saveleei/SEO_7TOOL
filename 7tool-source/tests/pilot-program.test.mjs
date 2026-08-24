import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

import {
  PILOT_CANDIDATE_LIMIT,
  PILOT_CATEGORIES,
  PILOT_CONTENT_MIX,
  PILOT_TOP_LIMIT,
  evaluatePilotKpis,
  evaluatePilotPlan,
  getPilotStatus,
  materializePilotKpis,
  materializePilotPlan,
  reviewPilotContentWorkItem,
  reviewPilotProgram,
} from "../src/lib/pilot-program.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationPath = path.join(root, "scripts", "migrations", "016_pilot_program.sql");
const migrationSql = fs.readFileSync(migrationPath, "utf8");
const upSql = migrationSql.slice(migrationSql.indexOf("-- migrate:up") + 13, migrationSql.indexOf("-- migrate:down"));
const downSql = migrationSql.slice(migrationSql.indexOf("-- migrate:down") + 15);

function fixtureDb({ opportunitiesPerCategory = 501 } = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "7tool-pilot-"));
  const databasePath = path.join(directory, "fixture.db");
  const db = new Database(databasePath);
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE categories (slug TEXT PRIMARY KEY, title TEXT NOT NULL);
    CREATE TABLE site_urls (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL UNIQUE,
      index_status TEXT NOT NULL
    );
    CREATE TABLE content_opportunities (
      id TEXT PRIMARY KEY,
      topic TEXT NOT NULL,
      category_slug TEXT NOT NULL REFERENCES categories(slug),
      recommended_page_type TEXT NOT NULL,
      recommended_url_id TEXT REFERENCES site_urls(id),
      decision TEXT NOT NULL,
      opportunity_score INTEGER NOT NULL,
      status TEXT NOT NULL,
      evaluation_checksum TEXT NOT NULL
    );
    CREATE TABLE content_assets (
      id TEXT PRIMARY KEY,
      opportunity_id TEXT UNIQUE REFERENCES content_opportunities(id),
      canonical TEXT NOT NULL UNIQUE
    );
    CREATE TABLE gsc_import_runs (
      id TEXT PRIMARY KEY,
      property_uri TEXT NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      search_type TEXT NOT NULL,
      status TEXT NOT NULL,
      imported_at INTEGER NOT NULL
    );
    CREATE TABLE gsc_search_performance_daily (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES gsc_import_runs(id),
      data_date TEXT NOT NULL,
      page_path TEXT NOT NULL,
      query_hash TEXT NOT NULL,
      impressions REAL NOT NULL,
      clicks REAL NOT NULL,
      average_position REAL NOT NULL
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
    CREATE TABLE yandex_webmaster_performance_daily (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES yandex_import_runs(id),
      data_date TEXT NOT NULL,
      page_path TEXT NOT NULL,
      query_hash TEXT NOT NULL,
      impressions REAL NOT NULL,
      clicks REAL NOT NULL,
      average_position REAL
    );
    CREATE TABLE content_roi_snapshots (
      id TEXT PRIMARY KEY,
      page_path TEXT NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      organic_sessions INTEGER NOT NULL,
      product_clicks INTEGER NOT NULL,
      leads INTEGER NOT NULL,
      revenue_minor INTEGER NOT NULL,
      evaluated_at INTEGER NOT NULL
    );
  `);
  for (const category of PILOT_CATEGORIES) {
    db.prepare("INSERT INTO categories (slug, title) VALUES (?, ?)").run(category.slug, category.title);
    db.prepare("INSERT INTO site_urls (id, path, index_status) VALUES (?, ?, 'INDEX')")
      .run(`url-${category.slug}`, `/c/${category.slug}`);
  }
  const insertOpportunity = db.prepare(`
    INSERT INTO content_opportunities (
      id, topic, category_slug, recommended_page_type, recommended_url_id,
      decision, opportunity_score, status, evaluation_checksum
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PROPOSED', ?)
  `);
  db.transaction(() => {
    for (const category of PILOT_CATEGORIES) {
      for (let index = 1; index <= opportunitiesPerCategory; index++) {
        let pageType = "FAQ";
        let decision = "CREATE";
        let targetUrlId = null;
        let score = Math.max(1, 96 - (index % 95));
        if (index === 1) {
          pageType = "CATEGORY_ENRICHMENT";
          decision = "UPDATE";
          targetUrlId = `url-${category.slug}`;
          score = 100;
        }
        if (index === 2) { pageType = "TROUBLESHOOTING"; score = 99; }
        if (index === 3) { pageType = "COMPARISON"; score = 98; }
        if (index === 4) { pageType = "PILLAR_GUIDE"; score = 97; }
        if (index === 5) { pageType = "HOW_TO"; score = 96; }
        const id = `opp-${category.slug}-${String(index).padStart(3, "0")}`;
        insertOpportunity.run(
          id, `Тема ${category.slug} ${String(index).padStart(3, "0")}`,
          category.slug, pageType, targetUrlId, decision, score, `evaluation-${id}`,
        );
      }
    }
  })();
  db.exec(upSql);
  return { db, directory };
}

function cleanup(fixture) {
  fixture.db.close();
  fs.rmSync(fixture.directory, { recursive: true, force: true });
}

function materializedFixture() {
  const fixture = fixtureDb();
  const result = materializePilotPlan(fixture.db, { createdBy: "pilot-planner", evaluatedAt: 1_000 });
  return { ...fixture, result };
}

test("Phase 19 scope is fixed to five catalog categories, 500 candidates, Top 20 and the 2+1+1+1 mix", () => {
  assert.deepEqual(PILOT_CATEGORIES.map((category) => category.slug), [
    "stanki-sverlilnye", "koronchatye-sverla", "kromkorezy-po-listu", "truborezy", "borfrezy",
  ]);
  assert.equal(PILOT_CANDIDATE_LIMIT, 500);
  assert.equal(PILOT_TOP_LIMIT, 20);
  assert.deepEqual(PILOT_CONTENT_MIX.map((slot) => slot.slotType), [
    "ARTICLE", "ARTICLE", "TROUBLESHOOTING", "COMPARISON_TABLE", "PRODUCT_CATEGORY_ENHANCEMENT",
  ]);
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  assert.equal(packageJson.scripts["seo:pilot"], "node scripts/pilot-program.mjs");
});

test("planner caps every category at 500, selects exactly Top 20 and creates 25 review-only work items", () => {
  const fixture = fixtureDb();
  try {
    const preview = evaluatePilotPlan(fixture.db);
    assert.equal(preview.ready, true);
    assert.equal(preview.sourceOpportunityCount, 2_505);
    assert.equal(preview.selectedCandidateCount, 2_500);
    assert.equal(preview.selectedTopCount, 100);
    assert.equal(preview.plannedContentCount, 25);
    for (const category of preview.categories) {
      assert.equal(category.candidates.length, 500);
      assert.equal(category.topOpportunities.length, 20);
      assert.deepEqual(category.workItems.map((item) => item.slotType), [
        "ARTICLE", "ARTICLE", "TROUBLESHOOTING", "COMPARISON_TABLE", "PRODUCT_CATEGORY_ENHANCEMENT",
      ]);
      assert.equal(new Set(category.workItems.map((item) => item.opportunityId)).size, 5);
      assert.ok(category.workItems.every((item) => item.topRank <= 20));
    }

    const saved = materializePilotPlan(fixture.db, { createdBy: "pilot-planner", evaluatedAt: 1_000 });
    assert.equal(saved.savedCandidates, 2_500);
    assert.equal(saved.savedWorkItems, 25);
    assert.equal(fixture.db.prepare("SELECT COUNT(*) AS count FROM pilot_categories").get().count, 5);
    assert.equal(fixture.db.prepare("SELECT COUNT(*) AS count FROM pilot_opportunity_selections WHERE top_rank IS NOT NULL").get().count, 100);
    assert.equal(fixture.db.prepare("SELECT COUNT(*) AS count FROM pilot_content_work_items WHERE status = 'REVIEW_REQUIRED'").get().count, 25);
    assert.equal(fixture.db.prepare("SELECT COUNT(*) AS count FROM content_assets").get().count, 0);
    const repeated = materializePilotPlan(fixture.db, { createdBy: "pilot-planner", evaluatedAt: 2_000 });
    assert.equal(repeated.duplicate, true);
    assert.equal(repeated.savedCandidates, 0);
    assert.equal(repeated.savedWorkItems, 0);
    assert.throws(() => fixture.db.prepare("UPDATE pilot_selection_runs SET evaluated_at = 9").run(), /immutable/);
  } finally { cleanup(fixture); }
});

test("an incomplete Top 20 or missing content type blocks materialization instead of inventing a pilot", () => {
  const fixture = fixtureDb({ opportunitiesPerCategory: 19 });
  try {
    const preview = evaluatePilotPlan(fixture.db);
    assert.equal(preview.ready, false);
    assert.match(preview.blockers.join("\n"), /expected Top 20, found 19/);
    assert.throws(
      () => materializePilotPlan(fixture.db, { createdBy: "pilot-planner" }),
      /not ready/,
    );
    assert.equal(fixture.db.prepare("SELECT COUNT(*) AS count FROM pilot_programs").get().count, 0);

    fixture.db.prepare("DELETE FROM content_opportunities WHERE recommended_page_type = 'TROUBLESHOOTING'").run();
    const missingMix = evaluatePilotPlan(fixture.db);
    assert.match(missingMix.blockers.join("\n"), /TROUBLESHOOTING/);
  } finally { cleanup(fixture); }
});

test("human review rejects stale or unreviewed opportunities and program approval requires all 25 items", () => {
  const fixture = materializedFixture();
  try {
    const items = fixture.db.prepare("SELECT * FROM pilot_content_work_items ORDER BY category_slug, slot_ordinal").all();
    assert.throws(() => reviewPilotContentWorkItem(fixture.db, {
      itemId: items[0].id, decision: "APPROVE", reviewedBy: "editor",
    }), /human-reviewed content opportunity/);

    fixture.db.prepare("UPDATE content_opportunities SET status = 'REVIEWED' WHERE id = ?").run(items[0].opportunity_id);
    const approved = reviewPilotContentWorkItem(fixture.db, {
      itemId: items[0].id, decision: "APPROVE", reviewedBy: "editor", reviewedAt: 2_000,
    });
    assert.equal(approved.status, "APPROVED");
    assert.equal(reviewPilotContentWorkItem(fixture.db, {
      itemId: items[0].id, decision: "APPROVE", reviewedBy: "editor", reviewedAt: 2_100,
    }).duplicate, true);

    fixture.db.prepare("UPDATE content_opportunities SET evaluation_checksum = 'changed' WHERE id = ?").run(items[1].opportunity_id);
    assert.throws(() => reviewPilotContentWorkItem(fixture.db, {
      itemId: items[1].id, decision: "REJECT", reviewedBy: "editor",
    }), /stale/);
    assert.throws(() => reviewPilotProgram(fixture.db, {
      decision: "APPROVE", reviewedBy: "pilot-owner",
    }), /all 25/);

    fixture.db.prepare("UPDATE content_opportunities SET evaluation_checksum = ? WHERE id = ?")
      .run(items[1].source_evaluation_checksum ?? `evaluation-${items[1].opportunity_id}`, items[1].opportunity_id);
    fixture.db.prepare("UPDATE content_opportunities SET status = 'REVIEWED'").run();
    for (const item of items.slice(1)) {
      reviewPilotContentWorkItem(fixture.db, {
        itemId: item.id, decision: "APPROVE", reviewedBy: "editor", reviewedAt: 3_000 + item.slot_ordinal,
      });
    }
    const program = reviewPilotProgram(fixture.db, {
      decision: "APPROVE", reviewedBy: "pilot-owner", reviewedAt: 4_000,
    });
    assert.equal(program.status, "APPROVED");
    assert.equal(fixture.db.prepare("SELECT COUNT(*) AS count FROM content_assets").get().count, 0);
  } finally { cleanup(fixture); }
});

function seedKpiEvidence(fixture) {
  const { db } = fixture;
  db.prepare(`
    INSERT INTO gsc_import_runs (
      id, property_uri, period_start, period_end, search_type, status, imported_at
    ) VALUES ('gsc-pilot', 'sc-domain:7tool.ru', '2026-08-01', '2026-08-20', 'WEB', 'COMPLETE', 10)
  `).run();
  db.prepare(`
    INSERT INTO yandex_import_runs (
      id, source_system, dataset_type, subject_ref, period_start, period_end, status, imported_at
    ) VALUES ('yandex-pilot', 'YANDEX_WEBMASTER', 'WEBMASTER_URL_QUERIES', 'https:7tool.ru:443',
      '2026-08-01', '2026-08-20', 'COMPLETE', 20)
  `).run();
  const gsc = db.prepare(`
    INSERT INTO gsc_search_performance_daily (
      id, run_id, data_date, page_path, query_hash, impressions, clicks, average_position
    ) VALUES (?, 'gsc-pilot', '2026-08-10', ?, ?, 100, 10, 8)
  `);
  const yandex = db.prepare(`
    INSERT INTO yandex_webmaster_performance_daily (
      id, run_id, data_date, page_path, query_hash, impressions, clicks, average_position
    ) VALUES (?, 'yandex-pilot', '2026-08-10', ?, ?, 50, 5, 6)
  `);
  const roi = db.prepare(`
    INSERT INTO content_roi_snapshots (
      id, page_path, period_start, period_end, organic_sessions,
      product_clicks, leads, revenue_minor, evaluated_at
    ) VALUES (?, ?, '2026-08-01', '2026-08-20', ?, ?, ?, ?, ?)
  `);
  for (const [index, category] of PILOT_CATEGORIES.entries()) {
    const baselinePath = `/c/${category.slug}`;
    gsc.run(`gsc-${index}`, baselinePath, `g-${category.slug}`);
    yandex.run(`yandex-${index}`, baselinePath, `y-${category.slug}`);
    roi.run(`roi-category-${index}`, baselinePath, 20, 5, 2, 100_000, 100);

    const articleItem = db.prepare(`
      SELECT * FROM pilot_content_work_items
      WHERE selection_run_id = ? AND category_slug = ? AND slot_type = 'ARTICLE'
      ORDER BY slot_ordinal LIMIT 1
    `).get(fixture.result.selectionRunId, category.slug);
    const articlePath = `/articles/${category.slug}-pilot-guide`;
    db.prepare("INSERT INTO content_assets (id, opportunity_id, canonical) VALUES (?, ?, ?)")
      .run(`asset-${index}`, articleItem.opportunity_id, articlePath);
    db.prepare("INSERT INTO site_urls (id, path, index_status) VALUES (?, ?, 'NOINDEX')")
      .run(`article-url-${index}`, articlePath);
    roi.run(`roi-article-${index}`, articlePath, 10, 3, 1, 50_000, 100);
  }
}

test("pilot KPI reports indexation, search demand, product clicks, lead rate, organic leads and revenue", () => {
  const fixture = materializedFixture();
  try {
    seedKpiEvidence(fixture);
    const input = {
      periodStart: "2026-08-01",
      periodEnd: "2026-08-20",
      gscPropertyUri: "sc-domain:7tool.ru",
      yandexHostId: "https:7tool.ru:443",
    };
    const evaluation = evaluatePilotKpis(fixture.db, input);
    assert.equal(evaluation.scopes.length, 6);
    const category = evaluation.scopes.find((scope) => scope.categorySlug === "stanki-sverlilnye");
    assert.equal(category.trackedUrlCount, 2);
    assert.equal(category.indexedUrlCount, 1);
    assert.equal(category.indexationRate, 0.5);
    assert.equal(category.impressions, 150);
    assert.equal(category.queryCount, 2);
    assert.equal(category.clicks, 15);
    assert.equal(category.ctr, 0.1);
    assert.ok(Math.abs(category.averagePosition - (1_100 / 150)) < 1e-10);
    assert.equal(category.organicSessions, 30);
    assert.equal(category.productClicks, 8);
    assert.equal(category.organicLeads, 3);
    assert.equal(category.leadRate, 0.1);
    assert.equal(category.revenueMinor, 150_000);

    const total = evaluation.scopes.find((scope) => scope.scopeType === "PILOT");
    assert.equal(total.trackedUrlCount, 10);
    assert.equal(total.indexedUrlCount, 5);
    assert.equal(total.impressions, 750);
    assert.equal(total.queryCount, 10);
    assert.equal(total.clicks, 75);
    assert.equal(total.productClicks, 40);
    assert.equal(total.organicLeads, 15);
    assert.equal(total.revenueMinor, 750_000);

    const first = materializePilotKpis(fixture.db, { ...input, evaluatedAt: 5_000 });
    assert.equal(first.savedSnapshots, 6);
    const repeated = materializePilotKpis(fixture.db, { ...input, evaluatedAt: 6_000 });
    assert.equal(repeated.savedSnapshots, 0);
    assert.equal(fixture.db.prepare("SELECT COUNT(*) AS count FROM pilot_kpi_snapshots").get().count, 6);
    assert.throws(() => fixture.db.prepare("UPDATE pilot_kpi_snapshots SET impressions = 0").run(), /immutable/);

    const status = getPilotStatus(fixture.db);
    assert.equal(status.categories.length, 5);
    assert.equal(status.latestKpis.length, 6);
    const selectionPlan = fixture.db.prepare(`
      EXPLAIN QUERY PLAN SELECT * FROM pilot_opportunity_selections
      WHERE selection_run_id = ? AND category_slug = ? ORDER BY candidate_rank
    `).all(fixture.result.selectionRunId, "stanki-sverlilnye");
    assert.match(selectionPlan.map((row) => row.detail).join("\n"), /idx_pilot_selections_category_rank/);
  } finally { cleanup(fixture); }
});

test("migration 016 has a reversible isolated schema and immutable audit projections", () => {
  const fixture = fixtureDb({ opportunitiesPerCategory: 20 });
  try {
    const tables = fixture.db.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name LIKE 'pilot_%' ORDER BY name")
      .all().map((row) => row.name);
    assert.deepEqual(tables, [
      "pilot_categories", "pilot_content_work_items", "pilot_kpi_snapshots",
      "pilot_opportunity_selections", "pilot_programs", "pilot_selection_runs",
    ]);
    fixture.db.exec(downSql);
    assert.equal(fixture.db.prepare("SELECT COUNT(*) AS count FROM sqlite_schema WHERE type = 'table' AND name LIKE 'pilot_%'").get().count, 0);
  } finally { cleanup(fixture); }
});
