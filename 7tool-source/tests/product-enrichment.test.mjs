import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import Database from "better-sqlite3";
import {
  addKnowledgeRelation,
  addVerifiedProductApplication,
  addVerifiedProductFeature,
  createFactAssertion,
  setVerifiedCompatibility,
} from "../src/lib/knowledge-graph.mjs";
import {
  approveProductEnrichment,
  createProductEnrichmentDraft,
  getPublicProductEnrichment,
  markStaleProductEnrichments,
  publishProductEnrichment,
  scanProductEnrichment,
} from "../src/lib/product-enrichment.mjs";

const human = { actorType: "HUMAN", actorId: "product-editor@example.test" };
const ai = { actorType: "AI_ASSISTED", actorId: "product-enrichment-assistant" };
const system = { actorType: "SYSTEM", actorId: "product-enrichment-stale-scan-v1" };

function fixtureDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "7tool-product-enrichment-"));
  const dbPath = path.join(dir, "data.db");
  const backupPath = path.join(dir, "backup.db");
  const seed = new Database(dbPath);
  seed.exec(`
    CREATE TABLE categories (slug TEXT PRIMARY KEY, title TEXT NOT NULL, published INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE products (
      id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, brand TEXT,
      category TEXT, images TEXT NOT NULL DEFAULT '[]', draft INTEGER NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE variants (
      id TEXT PRIMARY KEY, product_id TEXT REFERENCES products(id), name TEXT,
      params TEXT NOT NULL DEFAULT '[]', images TEXT, available INTEGER NOT NULL DEFAULT 1,
      quantity INTEGER
    );
    INSERT INTO categories (slug, title) VALUES ('magnitnye-stanki', 'Магнитные сверлильные станки');
    INSERT INTO products (id, slug, title, brand, category, images, draft, stock) VALUES
      ('p1', 'lenz-steyr-35', 'Магнитный станок LENZ STEYR-35', 'LENZ', 'magnitnye-stanki', '["https://supplier.example/p1.jpg"]', 0, 3),
      ('p2', 'koronka-weldon-19', 'Корончатое сверло Weldon 19', 'LENZ', 'magnitnye-stanki', '["https://supplier.example/p2.jpg"]', 0, 5),
      ('p3', 'lenz-steyr-30', 'Магнитный станок LENZ STEYR-30', 'LENZ', 'magnitnye-stanki', '["https://supplier.example/p3.jpg"]', 0, 2),
      ('p4', 'model-without-facts', 'Модель без проверенных фактов', 'LENZ', 'magnitnye-stanki', '["https://supplier.example/p4.jpg"]', 0, 1);
    INSERT INTO variants (id, product_id, name, params, images, available, quantity) VALUES
      ('v1', 'p1', 'STEYR-35', '[]', '["https://supplier.example/p1.jpg"]', 1, 3),
      ('v2', 'p2', 'Weldon 19', '[]', '["https://supplier.example/p2.jpg"]', 1, 5),
      ('v3', 'p3', 'STEYR-30', '[]', '["https://supplier.example/p3.jpg"]', 1, 2),
      ('v4', 'p4', 'Без фактов', '[]', '["https://supplier.example/p4.jpg"]', 1, 1);
  `);
  seed.close();
  fs.copyFileSync(dbPath, backupPath);
  const migration = spawnSync(process.execPath, ["scripts/migrate-seo.mjs", "--apply", `--backup=${backupPath}`], {
    cwd: path.resolve(import.meta.dirname, ".."),
    env: { ...process.env, SQLITE_PATH: dbPath },
    encoding: "utf8",
  });
  assert.equal(migration.status, 0, migration.stderr || migration.stdout);
  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");
  seedEvidenceSource(db);
  seedPublishedArticle(db);
  return { dir, db };
}

function seedEvidenceSource(db) {
  const now = Date.now();
  db.prepare(`
    INSERT INTO sources (id, source_type, name, rights_policy, active, created_at, updated_at)
    VALUES ('manual-product-source', 'MANUAL', 'Проверенные паспорта изделий', 'PUBLISHABLE_FACTS', 1, ?, ?)
  `).run(now, now);
  db.prepare(`
    INSERT INTO import_runs (
      id, source_id, started_at, completed_at, status, input_checksum,
      record_count, rejected_count, parser_version, schema_version
    ) VALUES ('product-enrichment-run', 'manual-product-source', ?, ?, 'SUCCEEDED',
      'product-enrichment-input', 20, 0, 'fixture', 'fixture')
  `).run(now, now);
}

function evidenceFact(db, { id, productId, predicate, value }) {
  const now = Date.now();
  const numeric = typeof value === "number";
  db.prepare(`
    INSERT INTO source_facts (
      id, source_id, import_run_id, subject_type, subject_id, predicate,
      value_text, value_number, observed_at, checksum, status
    ) VALUES (?, 'manual-product-source', 'product-enrichment-run', 'PRODUCT', ?, ?, ?, ?, ?, ?, 'VALID')
  `).run(id, productId, predicate, numeric ? null : String(value), numeric ? value : null, now, `checksum-${id}`);
}

function verifiedAssertion(db, { id, productId, predicate, value, unit }) {
  const factId = `fact-${id}`;
  evidenceFact(db, { id: factId, productId, predicate, value });
  return createFactAssertion(db, {
    id,
    subjectType: "PRODUCT",
    subjectId: productId,
    predicate,
    value,
    unit,
    verificationStatus: "VERIFIED",
    verifiedBy: "technical-reviewer@example.test",
    evidenceSourceFactIds: [factId],
  });
}

function seedKnowledge(db) {
  const diameter35 = verifiedAssertion(db, { id: "assert-diameter-p1", productId: "p1", predicate: "HAS_DIAMETER", value: 35, unit: "mm" });
  addVerifiedProductFeature(db, {
    productId: "p1",
    featureKey: "Максимальный диаметр корончатого сверления",
    assertionId: diameter35,
    sortOrder: 0,
  });
  const diameter30 = verifiedAssertion(db, { id: "assert-diameter-p3", productId: "p3", predicate: "HAS_DIAMETER", value: 30, unit: "mm" });
  addVerifiedProductFeature(db, {
    productId: "p3",
    featureKey: "Максимальный диаметр корончатого сверления",
    assertionId: diameter30,
    sortOrder: 0,
  });
  const supported = verifiedAssertion(db, { id: "assert-support", productId: "p1", predicate: "SUPPORTS", value: "Сверление отверстий корончатым сверлом" });
  addVerifiedProductApplication(db, {
    productId: "p1",
    applicationKey: "сверление отверстий корончатым сверлом",
    suitability: "SUPPORTED",
    assertionId: supported,
  });
  const notRecommended = verifiedAssertion(db, { id: "assert-not", productId: "p1", predicate: "NOT_RECOMMENDED_FOR", value: "Сверление без фиксации основания" });
  addVerifiedProductApplication(db, {
    productId: "p1",
    applicationKey: "сверление без фиксации основания",
    suitability: "NOT_RECOMMENDED",
    assertionId: notRecommended,
  });
  const betterFor = verifiedAssertion(db, { id: "assert-better", productId: "p1", predicate: "BETTER_FOR", value: "Работа в ограниченном пространстве" });
  addVerifiedProductApplication(db, {
    productId: "p1",
    applicationKey: "работа в ограниченном пространстве",
    suitability: "BETTER_FOR",
    assertionId: betterFor,
  });
  const compatibility = verifiedAssertion(db, { id: "assert-compatible", productId: "p1", predicate: "COMPATIBLE_WITH", value: "p2" });
  setVerifiedCompatibility(db, {
    productAId: "p1",
    productBId: "p2",
    compatibilityType: "оснастка Weldon 19",
    compatibilityStatus: "COMPATIBLE",
    assertionId: compatibility,
  });
  const alternative = verifiedAssertion(db, { id: "assert-alternative", productId: "p1", predicate: "ALTERNATIVE_TO", value: "p3" });
  addKnowledgeRelation(db, {
    subjectType: "PRODUCT",
    subjectId: "p1",
    predicate: "ALTERNATIVE_TO",
    objectType: "PRODUCT",
    objectId: "p3",
    assertionId: alternative,
  });
}

function seedPublishedArticle(db) {
  const now = Date.now();
  db.exec(`
    INSERT INTO keyword_clusters (
      id, name, category_slug, centroid_text, cluster_method, model_version, status, created_at, updated_at
    ) VALUES ('cluster-product-article', 'Выбор магнитного станка', 'magnitnye-stanki',
      'как выбрать магнитный станок', 'HUMAN_REVIEWED', 'fixture', 'REVIEWED', ${now}, ${now});
    INSERT INTO search_intents (
      id, intent_key, label, intent_class, dominant_serp_type, category_slug, status,
      reviewed_by, reviewed_at, created_at, updated_at
    ) VALUES ('intent-product-article', 'intent-product-article', 'Выбор магнитного станка',
      'SELECTION', 'ARTICLE', 'magnitnye-stanki', 'REVIEWED', 'reviewer', ${now}, ${now}, ${now});
    INSERT INTO seo_keywords (
      id, query, normalized_query, source_id, region, language, category_slug,
      intent_id, cluster_id, intent_class, cannibalization_risk, status,
      first_seen_at, last_seen_at, created_at, updated_at
    ) VALUES ('keyword-product-article', 'как выбрать магнитный станок', 'как выбрать магнитный станок',
      'manual-product-source', 'RU', 'ru', 'magnitnye-stanki', 'intent-product-article',
      'cluster-product-article', 'SELECTION', 'LOW', 'REVIEWED', ${now}, ${now}, ${now}, ${now});
    INSERT INTO site_urls (
      id, path, page_type, entity_type, entity_id, index_status, http_status,
      content_fingerprint, published_at, created_at, updated_at
    ) VALUES ('url-product-article', '/articles/vybor-magnitnogo-stanka', 'ARTICLE',
      'CONTENT_ASSET', 'content-product-article', 'INDEX', 200, 'article-fingerprint', ${now}, ${now}, ${now});
    INSERT INTO content_assets (
      id, content_type, site_url_id, slug, status, title, h1, meta_title,
      meta_description, excerpt, category_slug, primary_keyword_id, primary_keyword,
      intent_id, cluster_id, author, expert_reviewer, canonical, canonical_url_id,
      index_status, quality_score, evidence_score, differentiation_score, business_score,
      generated_by_ai, human_reviewed, current_brief_id, current_revision_id,
      published_at, created_at, updated_at
    ) VALUES ('content-product-article', 'ARTICLE', 'url-product-article', 'vybor-magnitnogo-stanka',
      'PUBLISHED', 'Как выбрать магнитный станок', 'Как выбрать магнитный станок',
      'Как выбрать магнитный станок', 'Проверенные параметры выбора оборудования.',
      'Краткое руководство по сопоставлению задачи и характеристик.', 'magnitnye-stanki',
      'keyword-product-article', 'как выбрать магнитный станок', 'intent-product-article',
      'cluster-product-article', 'Редакция 7TOOL', 'Технический эксперт',
      '/articles/vybor-magnitnogo-stanka', 'url-product-article', 'INDEX',
      92, 94, 90, 85, 0, 1, 'brief-product-article', 'revision-product-article',
      ${now}, ${now}, ${now});
    INSERT INTO article_briefs (
      id, content_asset_id, version, status, user_intent, problem, audience,
      short_answer, calculator_requirement, cta, brief_checksum, generated_by_ai,
      created_by_actor_type, created_by_actor_id, approved_by, approved_at, created_at, updated_at
    ) VALUES ('brief-product-article', 'content-product-article', 1, 'APPROVED',
      'Выбрать оборудование.', 'Сопоставить параметры.', 'Инженер.',
      'Проверьте задачу. Сверьте характеристики.', 'Не требуется.', 'Запросить подбор.',
      'brief-product-article-checksum', 0, 'HUMAN', 'editor', 'editor', ${now}, ${now}, ${now});
    INSERT INTO content_revisions (
      id, content_asset_id, revision_number, content_format, content_body,
      content_hash, template_hash, created_by_actor_type, created_by_actor_id, created_at
    ) VALUES ('revision-product-article', 'content-product-article', 1, 'ARTICLE_BLOCKS_V1',
      '{}', 'revision-product-article-hash', 'revision-product-article-template', 'HUMAN', 'editor', ${now});
    INSERT INTO content_products (content_asset_id, product_id, relation_type, sort_order)
    VALUES ('content-product-article', 'p1', 'TARGET', 0);
  `);
}

test("Product Enrichment builds and publishes every available section from verified facts only", () => {
  const { dir, db } = fixtureDb();
  try {
    seedKnowledge(db);
    const draft = createProductEnrichmentDraft(db, { productId: "p1", ...ai });
    assert.equal(draft.set.status, "DRAFT");
    assert.equal(draft.set.generated_by_ai, 1);
    const sectionTypes = new Set(draft.items.map((item) => item.section_type));
    for (const required of [
      "SUITABLE_TASK", "NOT_SUITABLE_TASK", "ADVANTAGE", "BEFORE_BUYING",
      "COMPATIBLE_ACCESSORY", "ANALOG", "DIFFERENCE", "FAQ",
    ]) assert.ok(sectionTypes.has(required), required);
    const diameter = draft.items.find((item) => item.template_key === "DECLARED_FEATURE");
    assert.match(diameter.body, /Заявленная характеристика/u);
    assert.match(diameter.body, /35 mm/u);
    assert.match(diameter.body, /проверенному источнику/u);
    assert.doesNotMatch(diameter.body, /идеал|любых условиях/iu);
    assert.throws(() => db.prepare("UPDATE product_enrichment_items SET body = 'Лучший в любых условиях' WHERE id = ?").run(diameter.id), /immutable/);
    assert.throws(() => approveProductEnrichment(db, { setId: draft.set.id, notes: "AI approval", ...ai }), /human actor/);
    approveProductEnrichment(db, { setId: draft.set.id, notes: "Every conclusion matches the reviewed evidence", ...human });
    assert.throws(() => publishProductEnrichment(db, { setId: draft.set.id, notes: "AI publication", ...ai }), /human actor/);
    publishProductEnrichment(db, { setId: draft.set.id, notes: "Approved for the public product page", ...human });

    const publicView = getPublicProductEnrichment(db, "p1");
    assert.ok(publicView);
    assert.ok(publicView.sections.some((section) => section.type === "DIFFERENCE"));
    assert.ok(publicView.faq.length > 0);
    assert.deepEqual(publicView.articles.map((article) => article.href), ["/articles/vybor-magnitnogo-stanka"]);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM product_enrichment_reviews WHERE enrichment_set_id = ?").get(draft.set.id).count, 2);
    assert.equal(db.prepare("PRAGMA foreign_key_check").all().length, 0);
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("Changed evidence rights hides public enrichment immediately and the deterministic scan marks it stale", () => {
  const { dir, db } = fixtureDb();
  try {
    seedKnowledge(db);
    const draft = createProductEnrichmentDraft(db, { productId: "p1", ...system });
    approveProductEnrichment(db, { setId: draft.set.id, notes: "Evidence reviewed", ...human });
    publishProductEnrichment(db, { setId: draft.set.id, notes: "Publication reviewed", ...human });
    assert.ok(getPublicProductEnrichment(db, "p1"));
    db.prepare("UPDATE sources SET rights_policy = 'RESEARCH_ONLY' WHERE id = 'manual-product-source'").run();
    assert.equal(getPublicProductEnrichment(db, "p1"), null);
    const result = markStaleProductEnrichments(db, { productId: "p1", notes: "Rights policy changed", ...system });
    assert.deepEqual(result.staleSetIds, [draft.set.id]);
    assert.equal(db.prepare("SELECT status FROM product_enrichment_sets WHERE id = ?").get(draft.set.id).status, "STALE");
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("Safety scanner blocks invented promotion and products without verified evidence remain unchanged", () => {
  const scan = scanProductEnrichment([{
    sectionType: "ADVANTAGE",
    templateKey: "DECLARED_FEATURE",
    label: "Диаметр",
    body: "Идеален для отверстий 35 мм в любых условиях.",
    question: null,
    answer: null,
    primaryAssertionId: "assertion",
    secondaryAssertionId: null,
    relatedProductId: null,
    sourcePredicate: "HAS_DIAMETER",
    evidenceChecksum: "fixture-checksum",
  }]);
  assert.equal(scan.hardFail, true);
  assert.ok(scan.issues.some((issue) => issue.code === "UNSUPPORTED_PROMOTION"));
  assert.ok(scan.issues.some((issue) => issue.code === "ADVANTAGE_WITHOUT_FACT"));
  assert.ok(scan.issues.some((issue) => issue.code === "UNQUALIFIED_SPECIFICATION"));

  const { dir, db } = fixtureDb();
  try {
    assert.throws(() => createProductEnrichmentDraft(db, { productId: "p4", ...ai }), /No publishable verified facts/);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM product_enrichment_sets WHERE product_id = 'p4'").get().count, 0);
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("migration 009 indexes match public/history queries and rolls back cleanly", () => {
  const { dir, db } = fixtureDb();
  try {
    db.pragma("optimize");
    const publicPlan = db.prepare(`
      EXPLAIN QUERY PLAN SELECT id FROM product_enrichment_sets
      WHERE product_id = 'p1' AND status = 'PUBLISHED' ORDER BY version DESC LIMIT 1
    `).all().map((row) => row.detail).join("\n");
    const itemsPlan = db.prepare(`
      EXPLAIN QUERY PLAN SELECT id FROM product_enrichment_items
      WHERE enrichment_set_id = 'fixture' ORDER BY section_type, sort_order, id
    `).all().map((row) => row.detail).join("\n");
    assert.match(publicPlan, /idx_product_enrichment_(?:one_published|product_history)/);
    assert.match(itemsPlan, /idx_product_enrichment_items_set/);
    const migrationSql = fs.readFileSync(path.resolve(import.meta.dirname, "..", "scripts", "migrations", "009_product_enrichment.sql"), "utf8");
    const downSql = migrationSql.slice(migrationSql.indexOf("-- migrate:down") + "-- migrate:down".length);
    db.exec(downSql);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sqlite_schema WHERE name = 'product_enrichment_sets'").get().count, 0);
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
