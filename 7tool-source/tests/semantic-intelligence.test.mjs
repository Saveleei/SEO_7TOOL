import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import Database from "better-sqlite3";
import { parseKeywordImport } from "../scripts/lib/keyword-import.mjs";
import {
  classifySearchIntent,
  clusterKeywordRecords,
  detectCannibalizationCandidates,
  importKeywordBatch,
  normalizeKeyword,
  persistConservativeClusters,
  registerSiteUrl,
  reviewIntentWithPreferredUrl,
} from "../src/lib/semantic-intelligence.mjs";

function fixtureDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "7tool-semantic-"));
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
  return { dir, db: new Database(dbPath) };
}

test("Russian keyword normalization is deterministic", () => {
  assert.equal(normalizeKeyword("  Корончатые СВЁРЛА — Weldon-19! "), "корончатые сверла weldon 19");
  assert.equal(normalizeKeyword("как   выбрать\tстанок"), "как выбрать станок");
});

test("intent rules distinguish selection, comparison, problems and compatibility", () => {
  assert.equal(classifySearchIntent("как выбрать магнитный станок").intentClass, "SELECTION");
  assert.equal(classifySearchIntent("Weldon 19 или Weldon 32").intentClass, "COMPARISON");
  assert.equal(classifySearchIntent("почему ломаются зубья коронки").intentClass, "PROBLEM");
  assert.equal(classifySearchIntent("подходит ли коронка к станку").intentClass, "COMPATIBILITY");
});

test("clustering is conservative and never merges different intents", () => {
  const groups = clusterKeywordRecords([
    { id: "1", query: "купить магнитный станок", intentClass: "COMMERCIAL" },
    { id: "2", query: "купить станок магнитный цена", intentClass: "COMMERCIAL" },
    { id: "3", query: "как выбрать магнитный станок", intentClass: "SELECTION" },
  ]);
  assert.equal(groups.length, 2);
  assert.equal(groups.find((group) => group.intentClass === "COMMERCIAL").members.length, 2);
});

test("Wordstat-style CSV and JSON imports validate frequencies", () => {
  assert.deepEqual(parseKeywordImport("Фраза;Частотность;Точная частотность\nмагнитный станок;1 200;340"), [
    { query: "магнитный станок", frequency: 1200, exactFrequency: 340, existingUrl: undefined, categorySlug: undefined, sourceKeywordId: undefined },
  ]);
  assert.throws(() => parseKeywordImport('[{"query":"x","frequency":-1}]'), /Invalid frequency/);
});

test("one reviewed intent gets one approved primary URL and overlaps are reported", () => {
  const { dir, db } = fixtureDb();
  try {
    importKeywordBatch(db, {
      sourceType: "WORDSTAT", sourceId: "wordstat", region: "RU-MOW", categorySlug: "stanki-sverlilnye",
      rows: [
        { query: "купить магнитный станок", frequency: 1200, existingUrl: "/c/stanki-sverlilnye", pageType: "CATEGORY", indexStatus: "INDEX" },
        { query: "купить станок магнитный цена", frequency: 800, existingUrl: "/lp/stanki-sverlilnye/magnitnye", pageType: "SEO_LANDING", indexStatus: "INDEX" },
        { query: "как выбрать магнитный станок", frequency: 300 },
      ],
    });
    const groups = persistConservativeClusters(db, { categorySlug: "stanki-sverlilnye", sourceId: "wordstat" });
    assert.equal(groups.length, 2);
    const overlaps = detectCannibalizationCandidates(db, "stanki-sverlilnye");
    assert.equal(overlaps.length, 1);
    assert.equal(overlaps[0].url_count, 2);

    const intent = db.prepare("SELECT id FROM search_intents WHERE intent_class = 'SELECTION'").get();
    const categoryUrl = registerSiteUrl(db, { path: "/c/stanki-sverlilnye", pageType: "CATEGORY", indexStatus: "INDEX", httpStatus: 200 });
    reviewIntentWithPreferredUrl(db, { intentId: intent.id, siteUrlId: categoryUrl.id, reviewedBy: "seo-reviewer", evidence: "manual intent review" });
    assert.equal(db.prepare("SELECT preferred_url_id FROM search_intents WHERE id = ?").get(intent.id).preferred_url_id, categoryUrl.id);

    const secondUrl = registerSiteUrl(db, { path: "/c/stanki-sverlilnye/magnitnye", pageType: "SUBCATEGORY", indexStatus: "INDEX", httpStatus: 200 });
    assert.throws(() => reviewIntentWithPreferredUrl(db, { intentId: intent.id, siteUrlId: secondUrl.id, reviewedBy: "seo-reviewer" }), /UNIQUE/);
  } finally {
    db.close(); fs.rmSync(dir, { recursive: true, force: true });
  }
});
