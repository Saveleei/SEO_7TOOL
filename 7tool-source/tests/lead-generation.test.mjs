import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { buildLeadAttributionSnapshot, saveLeadAttributionSnapshot } from "../src/lib/lead-attribution.mjs";
import { deriveLeadSource, getLeadProfile, isKnownLeadFormType, normalizeLeadCtaKey } from "../src/lib/lead-generation.mjs";

function fixtureDb({ migrate = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "7tool-lead-generation-"));
  const db = new Database(path.join(dir, "data.db"));
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE leads (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at INTEGER NOT NULL, type TEXT NOT NULL);
    CREATE TABLE products (id TEXT PRIMARY KEY, category TEXT NOT NULL, draft INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE search_intents (id TEXT PRIMARY KEY, intent_key TEXT NOT NULL);
    CREATE TABLE content_assets (
      id TEXT PRIMARY KEY, slug TEXT NOT NULL, cluster_id TEXT, category_slug TEXT NOT NULL,
      intent_id TEXT, status TEXT NOT NULL, human_reviewed INTEGER NOT NULL
    );
    INSERT INTO products (id, category, draft) VALUES ('p1', 'stanki-sverlilnye', 0);
    INSERT INTO search_intents (id, intent_key) VALUES ('intent-1', 'stanki:selection:fixture');
    INSERT INTO content_assets (
      id, slug, cluster_id, category_slug, intent_id, status, human_reviewed
    ) VALUES (
      'article-1', 'kak-vybrat-magnitnyy-stanok', 'cluster-1', 'stanki-sverlilnye',
      'intent-1', 'PUBLISHED', 1
    );
  `);
  if (migrate) {
    const sql = fs.readFileSync(path.resolve(import.meta.dirname, "..", "scripts", "migrations", "012_lead_generation.sql"), "utf8");
    db.exec(sql.slice(sql.indexOf("-- migrate:up") + "-- migrate:up".length, sql.indexOf("-- migrate:down")));
  }
  return { dir, db };
}

test("intent profiles select specific, non-generic CTA copy", () => {
  assert.equal(getLeadProfile({ toolType: "MAGNETIC_DRILL_SELECTOR" }).cta, "Подобрать 3 подходящих станка");
  assert.equal(getLeadProfile({ categorySlug: "koronchatye-sverla", intentClass: "SELECTION" }).cta, "Подобрать корончатое сверло");
  assert.equal(getLeadProfile({ toolType: "ANNULAR_CUTTER_RPM" }).cta, "Получить расчёт комплекта");
  assert.equal(getLeadProfile({ intentClass: "COMPATIBILITY" }).cta, "Проверить совместимость");
  assert.equal(getLeadProfile({ intentClass: "COMMERCIAL" }).cta, "Получить коммерческое предложение");
  for (const context of [
    { toolType: "MAGNETIC_DRILL_SELECTOR" }, { categorySlug: "koronchatye-sverla", intentClass: "SELECTION" },
    { toolType: "ANNULAR_CUTTER_RPM" }, { intentClass: "COMPATIBILITY" }, { intentClass: "COMMERCIAL" },
  ]) assert.doesNotMatch(getLeadProfile(context).cta, /оставьте телефон/iu);
  assert.equal(normalizeLeadCtaKey("invented-cta", "product_quote"), "product_quote");
  assert.equal(isKnownLeadFormType("COMPATIBILITY_CHECK"), true);
  assert.equal(isKnownLeadFormType("LEAVE_PHONE"), false);
});

test("lead source is deterministic from Yandex click, UTM, organic referrer or direct visit", () => {
  assert.equal(deriveLeadSource({ yclid: "yclid123" }), "yandex_ads");
  assert.equal(deriveLeadSource({ utmSource: "Yandex Direct" }), "utm:yandex-direct");
  assert.equal(deriveLeadSource({ referrer: "https://yandex.ru/search/?text=станок" }), "organic:yandex.ru");
  assert.equal(deriveLeadSource({ referrer: "https://industry.example/catalog" }), "referral:industry.example");
  assert.equal(deriveLeadSource({}), "direct");
});

test("attribution snapshot resolves trusted article context and stores every Phase 14 field", () => {
  const { dir, db } = fixtureDb();
  try {
    const leadId = Number(db.prepare("INSERT INTO leads (created_at, type) VALUES (?, 'content_request')").run(1_700_000_000_000).lastInsertRowid);
    const input = {
      leadId,
      payload: {
        type: "content_request", articleId: "forged-article", productId: "p1",
        pageUrl: "https://7tool.ru/articles/kak-vybrat-magnitnyy-stanok?utm_source=Yandex",
        ctaKey: "select_3_magnetic_drills",
      },
      extra: { category: "forged-category", intent: "forged-intent" },
      attribution: { sessionId: "session-fixture-123", referrer: "https://yandex.ru/search/" },
      activeTouch: {
        utm_source: "Yandex Direct", utm_medium: "cpc", utm_campaign: "magnetic-drills",
        utm_content: "article-cta", utm_term: "магнитный станок", referrer: "https://yandex.ru/search/",
      },
      yclid: null,
      capturedAt: 1_700_000_000_000,
    };
    const built = buildLeadAttributionSnapshot(db, input);
    assert.deepEqual({
      articleId: built.articleId, pagePath: built.pagePath, cluster: built.keywordClusterId,
      category: built.categorySlug, product: built.productId, intent: built.intentKey,
      cta: built.ctaKey, session: built.sessionId, source: built.source, timestamp: built.capturedAt,
    }, {
      articleId: "article-1", pagePath: "/articles/kak-vybrat-magnitnyy-stanok", cluster: "cluster-1",
      category: "stanki-sverlilnye", product: "p1", intent: "stanki:selection:fixture",
      cta: "select_3_magnetic_drills", session: "session-fixture-123", source: "utm:yandex-direct",
      timestamp: 1_700_000_000_000,
    });
    saveLeadAttributionSnapshot(db, input);
    const row = db.prepare("SELECT * FROM lead_attribution_snapshots WHERE lead_id = ?").get(leadId);
    assert.equal(row.page_url, input.payload.pageUrl);
    assert.equal(row.referrer, "https://yandex.ru/search/");
    assert.equal(row.utm_medium, "cpc");
    assert.equal(row.utm_campaign, "magnetic-drills");
    assert.equal(row.utm_content, "article-cta");
    assert.equal(row.utm_term, "магнитный станок");
    assert.throws(() => db.prepare("UPDATE lead_attribution_snapshots SET source = 'direct' WHERE lead_id = ?").run(leadId), /immutable/);
    const forged = buildLeadAttributionSnapshot(db, {
      ...input,
      leadId: leadId + 1,
      payload: { ...input.payload, pageUrl: "https://7tool.ru/tools/compatibility-table", productId: undefined },
    });
    assert.equal(forged.articleId, null);
    assert.equal(forged.keywordClusterId, null);
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("lead delivery remains compatible before migration 012", () => {
  const { dir, db } = fixtureDb({ migrate: false });
  try {
    const result = saveLeadAttributionSnapshot(db, {
      leadId: 1, payload: { type: "contact_form" }, extra: {}, attribution: {}, activeTouch: {}, yclid: null, capturedAt: 1,
    });
    assert.equal(result, null);
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("migration 012 indexes attribution analysis and rolls back cleanly", () => {
  const { dir, db } = fixtureDb();
  try {
    db.pragma("optimize");
    const ctaPlan = db.prepare(`
      EXPLAIN QUERY PLAN SELECT lead_id FROM lead_attribution_snapshots
      WHERE cta_key = 'check_compatibility' ORDER BY captured_at DESC
    `).all().map((row) => row.detail).join("\n");
    const articlePlan = db.prepare(`
      EXPLAIN QUERY PLAN SELECT lead_id FROM lead_attribution_snapshots
      WHERE article_id = 'article-1' ORDER BY captured_at DESC
    `).all().map((row) => row.detail).join("\n");
    assert.match(ctaPlan, /idx_lead_attribution_cta/);
    assert.match(articlePlan, /idx_lead_attribution_article/);
    const sql = fs.readFileSync(path.resolve(import.meta.dirname, "..", "scripts", "migrations", "012_lead_generation.sql"), "utf8");
    db.exec(sql.slice(sql.indexOf("-- migrate:down") + "-- migrate:down".length));
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sqlite_schema WHERE name = 'lead_attribution_snapshots'").get().count, 0);
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
