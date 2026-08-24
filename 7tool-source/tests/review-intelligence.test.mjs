import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import Database from "better-sqlite3";
import { parseReviewImport } from "../scripts/lib/review-import.mjs";
import {
  approveReviewSourceCandidate,
  extractReviewInsights,
  importReviewResearchBatch,
  listPriorityPainPoints,
  registerReviewSourceCandidate,
} from "../src/lib/review-intelligence.mjs";

function fixtureDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "7tool-review-"));
  const dbPath = path.join(dir, "data.db");
  const backupPath = path.join(dir, "backup.db");
  const seed = new Database(dbPath);
  seed.exec(`
    CREATE TABLE categories (slug TEXT PRIMARY KEY);
    CREATE TABLE products (id TEXT PRIMARY KEY);
    CREATE TABLE variants (id TEXT PRIMARY KEY, product_id TEXT REFERENCES products(id));
    INSERT INTO categories VALUES ('koronchatye-sverla');
    INSERT INTO products VALUES ('p1');
  `);
  seed.close(); fs.copyFileSync(dbPath, backupPath);
  const migration = spawnSync(process.execPath, ["scripts/migrate-seo.mjs", "--apply", `--backup=${backupPath}`], {
    cwd: path.resolve(import.meta.dirname, ".."), env: { ...process.env, SQLITE_PATH: dbPath }, encoding: "utf8",
  });
  assert.equal(migration.status, 0, migration.stderr || migration.stdout);
  return { dir, db: new Database(dbPath) };
}

test("ratings separate pain detection from positive use cases", () => {
  const negative = extractReviewInsights({ text: "Через день стали ломаться зубья, коронка быстро тупится.", rating: 2 });
  assert.ok(negative.some((item) => item.problemKey === "TEETH_BREAK"));
  assert.ok(negative.some((item) => item.problemKey === "DULLS_QUICKLY"));
  assert.ok(!negative.some((item) => item.type === "BENEFIT"));

  const positive = extractReviewInsights({ text: "Удобно и быстро сверлил конструкционную сталь на монтаже.", rating: 5 });
  assert.ok(positive.some((item) => item.type === "BENEFIT"));
  assert.ok(positive.some((item) => item.type === "USE_CASE"));
  assert.ok(positive.some((item) => item.type === "MATERIAL"));
  assert.ok(positive.some((item) => item.type === "APPLICATION"));
  assert.ok(!positive.some((item) => item.problemKey));
});

test("research extraction covers terminology, dimensions, accessories and questions", () => {
  const insights = extractReviewInsights({
    text: "Как поставить переходник 19 мм на магнитку для нержи?",
    rating: 4,
  });
  for (const type of ["QUESTION", "SLANG", "MATERIAL", "DIMENSION", "ACCESSORY"]) {
    assert.ok(insights.some((item) => item.type === type), `missing ${type}`);
  }
});

test("source discovery strips credentials/path and approval enforces policy", () => {
  const { dir, db } = fixtureDb();
  try {
    assert.throws(() => registerReviewSourceCandidate(db, {
      platform: "Example", baseUrl: "https://user:pass@example.test/private", discoverySource: "manual",
    }), /Credentials/);
    const candidate = registerReviewSourceCandidate(db, {
      platform: "Example", baseUrl: "https://example.test/catalog/item", discoverySource: "manual",
      accessMethod: "MANUAL_RESEARCH",
    });
    assert.equal(candidate.base_url, "https://example.test");
    assert.throws(() => approveReviewSourceCandidate(db, {
      id: candidate.id, accessMethod: "MANUAL_RESEARCH", robotsStatus: "DISALLOWED", reviewedBy: "legal-reviewer",
    }), /CHECK constraint/);
  } finally { db.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test("review import is idempotent, stores short research-only insights and aggregates negative pain", () => {
  const { dir, db } = fixtureDb();
  try {
    const batch = {
      sourceId: "market-example", platform: "Example Market", baseUrl: "https://market.example",
      accessMethod: "AUTHORIZED_EXPORT", termsStatus: "ALLOWED",
      rows: [
        { text: "На второй детали сломались зубья. Хотелось бы инструкцию по режимам.", rating: 2, sourceUrl: "https://market.example/item/1", categorySlug: "koronchatye-sverla", productId: "p1", productType: "TCT" },
        { text: "Удобно, быстро сверлил сталь на монтаже.", rating: 5, sourceUrl: "https://market.example/item/1", categorySlug: "koronchatye-sverla", productId: "p1", productType: "TCT" },
      ],
    };
    const candidate = registerReviewSourceCandidate(db, {
      platform: batch.platform, baseUrl: batch.baseUrl, discoverySource: "authorized-export-contract",
      accessMethod: batch.accessMethod, termsStatus: "ALLOWED", robotsStatus: "NOT_APPLICABLE",
    });
    assert.throws(() => importReviewResearchBatch(db, batch), /human approval/);
    approveReviewSourceCandidate(db, {
      id: candidate.id, accessMethod: batch.accessMethod, robotsStatus: "NOT_APPLICABLE", reviewedBy: "legal-reviewer",
    });
    const first = importReviewResearchBatch(db, batch);
    const second = importReviewResearchBatch(db, batch);
    assert.ok(first.insertedInsights >= 3);
    assert.equal(second.insertedInsights, 0);
    assert.equal(db.prepare("SELECT mentions FROM pain_points WHERE problem_key = 'TEETH_BREAK'").get().mentions, 1);
    const stored = db.prepare("SELECT rights_status, length(evidence_snippet) AS snippet_length FROM review_insights").all();
    assert.ok(stored.every((row) => row.rights_status === "RESEARCH_ONLY" && row.snippet_length <= 240));
    assert.equal(listPriorityPainPoints(db, "koronchatye-sverla")[0].problem_key, "TEETH_BREAK");
  } finally { db.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test("CSV/JSON review import validates required fields without publishing text", () => {
  const rows = parseReviewImport("Текст;Оценка;Ссылка;Категория\nЛомаются зубья;2;https://example.test/1;koronchatye-sverla");
  assert.equal(rows[0].rating, 2);
  assert.throws(() => parseReviewImport('[{"text":"x"}]'), /requires text/);
});
