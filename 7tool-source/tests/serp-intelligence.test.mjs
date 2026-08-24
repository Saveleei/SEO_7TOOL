import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import Database from "better-sqlite3";
import { parseSerpImport } from "../scripts/lib/serp-import.mjs";
import { importKeywordBatch, persistConservativeClusters } from "../src/lib/semantic-intelligence.mjs";
import {
  approveSerpSourceCandidate,
  classifySerpResult,
  createSerpAssessment,
  importSerpSnapshot,
  listCompetitorDomainCoverage,
  registerSerpSourceCandidate,
  reviewSerpAssessment,
  scoreDifferentiation,
} from "../src/lib/serp-intelligence.mjs";

function fixtureDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "7tool-serp-"));
  const dbPath = path.join(dir, "data.db");
  const backupPath = path.join(dir, "backup.db");
  const seed = new Database(dbPath);
  seed.exec(`
    CREATE TABLE categories (slug TEXT PRIMARY KEY);
    CREATE TABLE products (id TEXT PRIMARY KEY);
    CREATE TABLE variants (id TEXT PRIMARY KEY, product_id TEXT REFERENCES products(id));
    INSERT INTO categories VALUES ('stanki-sverlilnye');
    INSERT INTO products VALUES ('p1');
  `);
  seed.close(); fs.copyFileSync(dbPath, backupPath);
  const migration = spawnSync(process.execPath, ["scripts/migrate-seo.mjs", "--apply", `--backup=${backupPath}`], {
    cwd: path.resolve(import.meta.dirname, ".."), env: { ...process.env, SQLITE_PATH: dbPath }, encoding: "utf8",
  });
  assert.equal(migration.status, 0, migration.stderr || migration.stdout);
  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");
  importKeywordBatch(db, {
    sourceType: "WORDSTAT", sourceId: "wordstat-serp", region: "RU-MOW", categorySlug: "stanki-sverlilnye",
    rows: [{ query: "магнитный сверлильный станок", frequency: 1200 }],
  });
  persistConservativeClusters(db, { categorySlug: "stanki-sverlilnye", sourceId: "wordstat-serp" });
  const semantic = db.prepare("SELECT cluster_id AS clusterId, intent_id AS intentId FROM seo_keywords LIMIT 1").get();
  return { dir, db, ...semantic };
}

function registerSource(db, engine, approved = true) {
  const candidate = registerSerpSourceCandidate(db, {
    provider: `${engine} approved export`, engine,
    baseUrl: `https://${engine.toLocaleLowerCase("en-US")}.search-provider.test/export`,
    discoverySource: "provider-contract", acquisitionMethod: "AUTHORIZED_EXPORT",
    termsStatus: "ALLOWED", robotsStatus: "NOT_APPLICABLE",
  });
  if (approved) approveSerpSourceCandidate(db, {
    id: candidate.id, acquisitionMethod: "AUTHORIZED_EXPORT",
    robotsStatus: "NOT_APPLICABLE", reviewedBy: "legal-reviewer",
  });
  return candidate;
}

function snapshotInput(engine, candidate, semantic, capturedAt, results, insights = []) {
  return {
    sourceCandidateId: candidate.id, acquisitionMethod: "AUTHORIZED_EXPORT", engine,
    query: "магнитный сверлильный станок", region: "RU-MOW", language: "ru", device: "DESKTOP",
    clusterId: semantic.clusterId, intentId: semantic.intentId, capturedAt, topN: 5, results, insights,
  };
}

test("SERP classification is explicit-first, URL-safe and research oriented", () => {
  const marketplace = classifySerpResult({
    url: "https://market.example/item/1?utm_source=test#details", title: "Карточка товара",
    pageType: "MARKETPLACE", siteClass: "MARKETPLACE",
  });
  assert.equal(marketplace.pageType, "MARKETPLACE");
  assert.equal(marketplace.url, "https://market.example/item/1");
  assert.equal(classifySerpResult({ url: "https://tools.example/calc/diameter", title: "Калькулятор диаметра" }).pageType, "CALCULATOR");
  assert.equal(classifySerpResult({ url: "https://docs.example/manual.pdf", mimeType: "application/pdf" }).pageType, "PDF_MANUAL");
  assert.throws(() => classifySerpResult({ url: "https://user:secret@example.test/result" }), /Credentials/);
});

test("differentiation scoring uses a versioned allowlist and zero means reject", () => {
  const useful = scoreDifferentiation(["COMPATIBILITY_DATA", "VERIFIED_SPECIFICATIONS", "EXPERT_COMMENTARY"]);
  assert.ok(useful.score > 0 && useful.score < 100);
  assert.equal(scoreDifferentiation([]).score, 0);
  assert.throws(() => scoreDifferentiation(["AI_TEXT_VOLUME"]), /Unsupported differentiation signal/);
  assert.throws(() => scoreDifferentiation(["BETTER_TABLE"], { UNKNOWN_WEIGHT: 50 }), /Unsupported differentiation weight/);
});

test("SERP import requires approved acquisition and is idempotent", () => {
  const { dir, db, clusterId, intentId } = fixtureDb();
  try {
    const candidate = registerSource(db, "GOOGLE", false);
    const input = snapshotInput("GOOGLE", candidate, { clusterId, intentId }, new Date().toISOString(), [
      { position: 1, url: "https://shop.example/catalog/magnetic", title: "Каталог", pageType: "CATEGORY", siteClass: "COMPETITOR" },
      { position: 2, url: "https://market.example/item/2", title: "Товар", pageType: "MARKETPLACE", siteClass: "MARKETPLACE" },
    ]);
    input.topN = 2;
    assert.throws(() => importSerpSnapshot(db, input), /human approval/);
    approveSerpSourceCandidate(db, {
      id: candidate.id, acquisitionMethod: "AUTHORIZED_EXPORT", robotsStatus: "NOT_APPLICABLE", reviewedBy: "legal-reviewer",
    });
    const first = importSerpSnapshot(db, input);
    const second = importSerpSnapshot(db, input);
    assert.equal(first.duplicate, false);
    assert.equal(second.duplicate, true);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM serp_results").get().count, 2);
    const stored = db.prepare("SELECT rights_status, title FROM serp_results").all();
    assert.ok(stored.every((row) => row.rights_status === "RESEARCH_ONLY" && row.title.length <= 300));
    const changed = registerSerpSourceCandidate(db, {
      provider: "GOOGLE approved export", engine: "GOOGLE",
      baseUrl: "https://google.search-provider.test/changed", discoverySource: "new-policy",
      acquisitionMethod: "OFFICIAL_API", termsStatus: "ALLOWED", robotsStatus: "NOT_APPLICABLE",
    });
    assert.equal(changed.status, "DISCOVERED");
    assert.equal(changed.reviewed_by, null);
    assert.throws(() => importSerpSnapshot(db, input), /human approval/);
  } finally { db.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test("balanced Google/Yandex evidence produces a review-only dominant SERP assessment", () => {
  const { dir, db, clusterId, intentId } = fixtureDb();
  try {
    const capturedAt = new Date().toISOString();
    const google = registerSource(db, "GOOGLE");
    const yandex = registerSource(db, "YANDEX");
    const googleSnapshot = importSerpSnapshot(db, snapshotInput("GOOGLE", google, { clusterId, intentId }, capturedAt, [
      { position: 1, url: "https://shop.example/catalog/magnetic", title: "Каталог", pageType: "CATEGORY", siteClass: "COMPETITOR", hasTable: true },
      { position: 2, url: "https://catalog-a.example/magnetic", title: "Категория", pageType: "CATEGORY", siteClass: "COMPETITOR" },
      { position: 3, url: "https://market.example/magnetic", title: "Маркетплейс", pageType: "CATEGORY", siteClass: "MARKETPLACE" },
      { position: 4, url: "https://blog.example/articles/select", title: "Как выбрать", pageType: "ARTICLE", siteClass: "COMPETITOR" },
      { position: 5, url: "https://video.example/watch/1", title: "Видео", pageType: "VIDEO", siteClass: "VIDEO_PLATFORM" },
    ], [
      { insightType: "MISSING_TABLE", summary: "Нет единой таблицы совместимости", severity: 80, resultPosition: 1 },
    ]));
    const yandexSnapshot = importSerpSnapshot(db, snapshotInput("YANDEX", yandex, { clusterId, intentId }, capturedAt, [
      { position: 1, url: "https://shop.example/catalog/magnetic", title: "Каталог", pageType: "CATEGORY", siteClass: "COMPETITOR" },
      { position: 2, url: "https://catalog-b.example/magnetic", title: "Категория", pageType: "CATEGORY", siteClass: "COMPETITOR" },
      { position: 3, url: "https://store.example/product/1", title: "Станок 1", pageType: "PRODUCT", siteClass: "COMPETITOR" },
      { position: 4, url: "https://store.example/product/2", title: "Станок 2", pageType: "PRODUCT", siteClass: "COMPETITOR" },
      { position: 5, url: "https://guide.example/article", title: "Обзор", pageType: "ARTICLE", siteClass: "COMPETITOR" },
    ], [
      { insightType: "WEAK_EXPLANATION", summary: "Не объяснены ограничения выбора", severity: 60, resultPosition: 5 },
    ]));

    assert.throws(() => createSerpAssessment(db, {
      snapshotIds: [googleSnapshot.snapshotId], differentiationSignals: ["BETTER_TABLE"],
    }), /exactly one current Google/);
    const assessment = createSerpAssessment(db, {
      snapshotIds: [googleSnapshot.snapshotId, yandexSnapshot.snapshotId],
      differentiationSignals: ["BETTER_TABLE", "COMPATIBILITY_DATA", "VERIFIED_SPECIFICATIONS"],
    });
    assert.equal(assessment.dominant_serp_type, "CATEGORY");
    assert.equal(assessment.recommended_page_type, "CATEGORY_ENRICHMENT");
    assert.equal(assessment.recommendation, "KEEP_FOR_OPPORTUNITY_REVIEW");
    assert.ok(assessment.content_gap_score > 0);
    const repeated = createSerpAssessment(db, {
      snapshotIds: [googleSnapshot.snapshotId, yandexSnapshot.snapshotId],
      differentiationSignals: ["BETTER_TABLE", "COMPATIBILITY_DATA", "VERIFIED_SPECIFICATIONS"],
    });
    assert.equal(repeated.id, assessment.id);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM serp_assessments").get().count, 1);
    assert.equal(db.prepare("SELECT dominant_serp_type FROM search_intents WHERE id = ?").get(intentId).dominant_serp_type, null);
    reviewSerpAssessment(db, { assessmentId: assessment.id, decision: "APPROVE", reviewedBy: "seo-reviewer" });
    assert.equal(db.prepare("SELECT dominant_serp_type FROM search_intents WHERE id = ?").get(intentId).dominant_serp_type, "CATEGORY");
    const coverage = listCompetitorDomainCoverage(db, intentId);
    assert.equal(coverage.find((row) => row.domain === "shop.example").engines, 2);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM content_opportunities").get().count, 0);
  } finally { db.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test("SERP CSV/JSON parser ignores copied snippets and validates result URLs", () => {
  const json = parseSerpImport(JSON.stringify({
    engine: "GOOGLE", query: "станок", capturedAt: "2026-08-24T00:00:00Z",
    items: [{ link: "https://example.test/catalog", title: "Каталог", snippet: "Чужой длинный текст" }],
  }));
  assert.equal(json.results[0].position, 1);
  assert.ok(!("snippet" in json.results[0]));
  const csv = parseSerpImport("Позиция;Ссылка;Тип страницы\n1;https://example.test/p/1;PRODUCT", {
    engine: "YANDEX", query: "станок", capturedAt: "2026-08-24T00:00:00Z",
  });
  assert.equal(csv.results[0].pageType, "PRODUCT");
  assert.throws(() => parseSerpImport('[{"title":"missing link"}]'), /requires url/);
});
