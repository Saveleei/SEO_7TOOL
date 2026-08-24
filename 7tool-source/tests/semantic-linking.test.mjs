import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import Database from "better-sqlite3";
import {
  addKnowledgeRelation,
  addVerifiedProductFeature,
  createFactAssertion,
  setVerifiedCompatibility,
} from "../src/lib/knowledge-graph.mjs";
import {
  approveInteractiveTool,
  createInteractiveToolDraft,
  publishInteractiveTool,
} from "../src/lib/tool-platform.mjs";
import {
  approveSemanticLinkSet,
  createSemanticLinkDraft,
  discoverSemanticLinkItems,
  getPublicSemanticLinks,
  markStaleSemanticLinks,
  publishSemanticLinkSet,
  scanSemanticLinks,
} from "../src/lib/semantic-linking.mjs";

const human = { actorType: "HUMAN", actorId: "link-editor@example.test" };
const ai = { actorType: "AI_ASSISTED", actorId: "link-assistant" };
const system = { actorType: "SYSTEM", actorId: "link-stale-scan-v1" };

function fixtureDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "7tool-semantic-linking-"));
  const dbPath = path.join(dir, "data.db");
  const backupPath = path.join(dir, "backup.db");
  const seed = new Database(dbPath);
  const now = Date.now();
  seed.exec(`
    CREATE TABLE categories (
      slug TEXT PRIMARY KEY, title TEXT NOT NULL, h1 TEXT, published INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE products (
      id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, brand TEXT,
      category TEXT, images TEXT NOT NULL DEFAULT '[]', draft INTEGER NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL
    );
    CREATE TABLE variants (
      id TEXT PRIMARY KEY, product_id TEXT REFERENCES products(id), name TEXT,
      params TEXT NOT NULL DEFAULT '[]', images TEXT, available INTEGER NOT NULL DEFAULT 1,
      quantity INTEGER
    );
    INSERT INTO categories (slug, title, h1) VALUES
      ('stanki-sverlilnye', 'Магнитные сверлильные станки', 'Магнитные сверлильные станки'),
      ('magnitnaya-osnastka', 'Оснастка для магнитных станков', 'Оснастка для магнитных станков');
    INSERT INTO products (id, slug, title, brand, category, images, draft, stock, updated_at) VALUES
      ('p1', 'lenz-steyr-50', 'Магнитный станок LENZ STEYR-50', 'LENZ', 'stanki-sverlilnye', '["/p1.jpg"]', 0, 3, ${now}),
      ('p2', 'koronka-weldon-19', 'Корончатое сверло Weldon 19', 'LENZ', 'magnitnaya-osnastka', '["/p2.jpg"]', 0, 4, ${now});
    INSERT INTO variants (id, product_id, name, params, images, available, quantity) VALUES
      ('v1', 'p1', 'STEYR-50', '[]', '["/p1.jpg"]', 1, 3),
      ('v2', 'p2', 'Weldon 19', '[]', '["/p2.jpg"]', 1, 4);
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
  try {
    seedEvidence(db);
    seedContent(db);
    publishTool(db, "MAGNETIC_DRILL_SELECTOR");
    publishTool(db, "COMPATIBILITY_TABLE");
  } catch (error) {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
    throw new Error(`Semantic-link fixture failed: ${error.message}`, { cause: error });
  }
  return { dir, db };
}

function seedEvidence(db) {
  const now = Date.now();
  db.prepare(`
    INSERT INTO sources (id, source_type, name, rights_policy, active, created_at, updated_at)
    VALUES ('link-manuals', 'MANUAL', 'Проверенные паспорта', 'PUBLISHABLE_FACTS', 1, ?, ?)
  `).run(now, now);
  db.prepare(`
    INSERT INTO import_runs (
      id, source_id, started_at, completed_at, status, input_checksum,
      record_count, rejected_count, parser_version, schema_version
    ) VALUES ('link-fixture-run', 'link-manuals', ?, ?, 'SUCCEEDED',
      'link-fixture', 10, 0, 'fixture', 'fixture')
  `).run(now, now);
  const verified = ({ id, subjectId, predicate, value, unit = null }) => {
    const factId = `fact-${id}`;
    const numeric = typeof value === "number";
    db.prepare(`
      INSERT INTO source_facts (
        id, source_id, import_run_id, subject_type, subject_id, predicate,
        value_text, value_number, unit, observed_at, checksum, status
      ) VALUES (?, 'link-manuals', 'link-fixture-run', 'PRODUCT', ?, ?, ?, ?, ?, ?, ?, 'VALID')
    `).run(factId, subjectId, predicate, numeric ? null : String(value), numeric ? value : null, unit, now, `checksum-${factId}`);
    return createFactAssertion(db, {
      id, subjectType: "PRODUCT", subjectId, predicate, value, unit,
      verificationStatus: "VERIFIED", verifiedBy: "technical-reviewer@example.test",
      evidenceSourceFactIds: [factId],
    });
  };
  const diameter = verified({ id: "assert-link-diameter", subjectId: "p1", predicate: "MAX_DIAMETER", value: 50, unit: "mm" });
  addVerifiedProductFeature(db, { id: "feature-link-diameter", productId: "p1", featureKey: "max_diameter", assertionId: diameter });
  const compatibility = verified({ id: "assert-link-compatible", subjectId: "p1", predicate: "COMPATIBLE_WITH", value: "p2" });
  setVerifiedCompatibility(db, {
    id: "compatibility-link-p1-p2", productAId: "p1", productBId: "p2",
    compatibilityType: "оснастка Weldon 19", compatibilityStatus: "COMPATIBLE",
    assertionId: compatibility,
  });
  const direction = verified({ id: "assert-link-direction", subjectId: "p1", predicate: "USES_ACCESSORY", value: "p2" });
  addKnowledgeRelation(db, {
    id: "relation-link-p1-p2", subjectType: "PRODUCT", subjectId: "p1",
    predicate: "USES_ACCESSORY", objectType: "PRODUCT", objectId: "p2",
    assertionId: direction,
  });
}

function seedContent(db) {
  const now = Date.now();
  db.exec(`
    INSERT INTO keyword_clusters (
      id, name, category_slug, centroid_text, cluster_method, model_version, status, created_at, updated_at
    ) VALUES ('cluster-linking', 'Выбор магнитного станка', 'stanki-sverlilnye',
      'как выбрать магнитный станок', 'HUMAN_REVIEWED', 'fixture', 'REVIEWED', ${now}, ${now});
    INSERT INTO search_intents (
      id, intent_key, label, intent_class, dominant_serp_type, category_slug, status,
      reviewed_by, reviewed_at, created_at, updated_at
    ) VALUES ('intent-linking', 'intent-linking', 'Выбор магнитного станка', 'SELECTION',
      'ARTICLE', 'stanki-sverlilnye', 'REVIEWED', 'reviewer', ${now}, ${now}, ${now});
    INSERT INTO seo_keywords (
      id, query, normalized_query, source_id, region, language, category_slug,
      intent_id, cluster_id, intent_class, cannibalization_risk, status,
      first_seen_at, last_seen_at, created_at, updated_at
    ) VALUES ('keyword-linking', 'как выбрать магнитный станок', 'как выбрать магнитный станок',
      'link-manuals', 'RU', 'ru', 'stanki-sverlilnye', 'intent-linking', 'cluster-linking',
      'SELECTION', 'LOW', 'REVIEWED', ${now}, ${now}, ${now}, ${now});
  `);
  const assets = [
    { id: "article-choice", type: "ARTICLE", slug: "kak-vybrat-magnitnyy-stanok", title: "Как выбрать магнитный станок" },
    { id: "article-cutter", type: "ARTICLE", slug: "kak-podobrat-koronku", title: "Как подобрать коронку" },
    { id: "guide-weldon", type: "GUIDE", slug: "guide-weldon-19-ili-32", title: "Руководство по выбору Weldon 19 и 32" },
    { id: "comparison-weldon", type: "COMPARISON", slug: "weldon-19-vs-32", title: "Weldon 19 или 32" },
  ];
  for (const asset of assets) {
    const urlId = `url-${asset.id}`;
    const briefId = `brief-${asset.id}`;
    const revisionId = `revision-${asset.id}`;
    db.prepare(`
      INSERT INTO site_urls (
        id, path, page_type, entity_type, entity_id, index_status, http_status,
        content_fingerprint, published_at, created_at, updated_at
      ) VALUES (?, ?, 'ARTICLE', 'CONTENT_ASSET', ?, 'INDEX', 200, ?, ?, ?, ?)
    `).run(urlId, `/articles/${asset.slug}`, asset.id, `fingerprint-${asset.id}`, now, now, now);
    db.prepare(`
      INSERT INTO content_assets (
        id, content_type, site_url_id, slug, status, title, h1, meta_title,
        meta_description, excerpt, category_slug, primary_keyword_id, primary_keyword,
        intent_id, cluster_id, author, expert_reviewer, canonical, canonical_url_id,
        index_status, quality_score, evidence_score, differentiation_score, business_score,
        generated_by_ai, human_reviewed, current_brief_id, current_revision_id,
        published_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'PUBLISHED', ?, ?, ?, ?, ?, 'stanki-sverlilnye',
        'keyword-linking', 'как выбрать магнитный станок', 'intent-linking', 'cluster-linking',
        'Редакция 7TOOL', 'Технический эксперт', ?, ?, 'INDEX',
        92, 94, 90, 85, 0, 1, ?, ?, ?, ?, ?)
    `).run(asset.id, asset.type, urlId, asset.slug, asset.title, asset.title, asset.title,
      `Проверенный материал: ${asset.title}.`, `Краткое содержание: ${asset.title}.`,
      `/articles/${asset.slug}`, urlId, briefId, revisionId, now, now, now);
    db.prepare(`
      INSERT INTO article_briefs (
        id, content_asset_id, version, status, user_intent, problem, audience,
        short_answer, calculator_requirement, cta, brief_checksum, generated_by_ai,
        created_by_actor_type, created_by_actor_id, approved_by, approved_at, created_at, updated_at
      ) VALUES (?, ?, 1, 'APPROVED', 'Выбрать оборудование.', 'Сопоставить параметры.',
        'Инженер.', 'Проверьте задачу. Сверьте характеристики.', 'Не требуется.',
        'Перейти к следующему вопросу.', ?, 0, 'HUMAN', 'editor', 'editor', ?, ?, ?)
    `).run(briefId, asset.id, `brief-checksum-${asset.id}`, now, now, now);
    db.prepare(`
      INSERT INTO content_revisions (
        id, content_asset_id, revision_number, content_format, content_body,
        content_hash, template_hash, created_by_actor_type, created_by_actor_id, created_at
      ) VALUES (?, ?, 1, 'ARTICLE_BLOCKS_V1', '{}', ?, ?, 'HUMAN', 'editor', ?)
    `).run(revisionId, asset.id, `revision-hash-${asset.id}`, `template-hash-${asset.id}`, now);
  }
  db.exec(`
    INSERT INTO content_products (content_asset_id, product_id, relation_type, sort_order) VALUES
      ('article-choice', 'p1', 'TARGET', 0),
      ('comparison-weldon', 'p1', 'TARGET', 0);
    INSERT INTO content_related (content_asset_id, related_content_asset_id, sort_order)
    VALUES ('article-choice', 'article-cutter', 0);
  `);
}

function publishTool(db, toolType) {
  const draft = createInteractiveToolDraft(db, { toolType, indexStatus: "NOINDEX", ...ai }).set;
  approveInteractiveTool(db, { setId: draft.id, ...human });
  publishInteractiveTool(db, { setId: draft.id, ...human });
}

function publishLinks(db, input) {
  const draft = createSemanticLinkDraft(db, { ...input, ...ai }).set;
  approveSemanticLinkSet(db, { setId: draft.id, notes: "Question sequence and evidence reviewed", ...human });
  publishSemanticLinkSet(db, { setId: draft.id, notes: "Approved for public navigation", ...human });
  return draft;
}

test("all eight Phase 13 relations require normalized evidence and human publication", () => {
  const { dir, db } = fixtureDb();
  try {
    const discovered = discoverSemanticLinkItems(db, { sourceType: "ARTICLE", sourceId: "article-choice" });
    assert.deepEqual(discovered.items.map((item) => item.relationType), [
      "ARTICLE_TO_CATEGORY", "ARTICLE_TO_PRODUCT", "ARTICLE_TO_ARTICLE",
    ]);
    const articleDraft = createSemanticLinkDraft(db, { sourceType: "ARTICLE", sourceId: "article-choice", items: discovered.items, ...ai }).set;
    assert.throws(() => approveSemanticLinkSet(db, { setId: articleDraft.id, ...ai }), /HUMAN/);
    approveSemanticLinkSet(db, { setId: articleDraft.id, ...human });
    publishSemanticLinkSet(db, { setId: articleDraft.id, ...human });

    publishLinks(db, {
      sourceType: "PRODUCT", sourceId: "p1", items: [
        { relationType: "PRODUCT_TO_ARTICLE", targetType: "ARTICLE", targetId: "article-choice" },
        { relationType: "PRODUCT_TO_COMPATIBILITY", targetType: "COMPATIBILITY", targetId: "compatibility-table" },
      ],
    });
    publishLinks(db, {
      sourceType: "CATEGORY", sourceId: "stanki-sverlilnye",
      items: [{ relationType: "CATEGORY_TO_GUIDE", targetType: "GUIDE", targetId: "guide-weldon" }],
    });
    publishLinks(db, {
      sourceType: "CALCULATOR", sourceId: "magnetic-drill-selector",
      items: [{ relationType: "CALCULATOR_TO_PRODUCT", targetType: "PRODUCT", targetId: "p1" }],
    });
    publishLinks(db, {
      sourceType: "COMPARISON", sourceId: "comparison-weldon",
      items: [{ relationType: "COMPARISON_TO_PRODUCT", targetType: "PRODUCT", targetId: "p1" }],
    });

    assert.deepEqual(getPublicSemanticLinks(db, "ARTICLE", "article-choice").items.map((item) => item.relationType), [
      "ARTICLE_TO_CATEGORY", "ARTICLE_TO_PRODUCT", "ARTICLE_TO_ARTICLE",
    ]);
    assert.deepEqual(getPublicSemanticLinks(db, "PRODUCT", "p1").items.map((item) => item.relationType), [
      "PRODUCT_TO_ARTICLE", "PRODUCT_TO_COMPATIBILITY",
    ]);
    assert.equal(getPublicSemanticLinks(db, "CATEGORY", "stanki-sverlilnye").items[0].relationType, "CATEGORY_TO_GUIDE");
    assert.equal(getPublicSemanticLinks(db, "CALCULATOR", "magnetic-drill-selector").items[0].relationType, "CALCULATOR_TO_PRODUCT");
    assert.equal(getPublicSemanticLinks(db, "COMPARISON", "comparison-weldon").items[0].relationType, "COMPARISON_TO_PRODUCT");
    assert.throws(() => db.prepare("UPDATE semantic_link_items SET anchor_text = 'Новый текст'").run(), /immutable/);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM semantic_link_reviews").get().count, 10);
    assert.equal(db.prepare("PRAGMA foreign_key_check").all().length, 0);
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("changed public evidence hides a link set immediately and stale scan records it", () => {
  const { dir, db } = fixtureDb();
  try {
    const draft = publishLinks(db, {
      sourceType: "ARTICLE", sourceId: "article-choice",
      items: [{ relationType: "ARTICLE_TO_ARTICLE", targetType: "ARTICLE", targetId: "article-cutter" }],
    });
    assert.ok(getPublicSemanticLinks(db, "ARTICLE", "article-choice"));
    db.prepare("UPDATE content_assets SET status = 'ARCHIVED', updated_at = ? WHERE id = 'article-cutter'").run(Date.now());
    assert.equal(getPublicSemanticLinks(db, "ARTICLE", "article-choice"), null);
    assert.deepEqual(markStaleSemanticLinks(db, { sourceType: "ARTICLE", sourceId: "article-choice", ...system }), {
      checked: 1, staleSetIds: [draft.id],
    });
    assert.equal(db.prepare("SELECT status FROM semantic_link_sets WHERE id = ?").get(draft.id).status, "STALE");
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("semantic copy scanner rejects promotional text, markup and self-links", () => {
  const result = scanSemanticLinks([{
    relationType: "ARTICLE_TO_ARTICLE", targetId: "article-choice",
    sourcePath: "/articles/same", targetPath: "/articles/same",
    anchorText: "<b>Лучший товар</b>", nextQuestion: "Купите сейчас по https://example.test?",
  }]);
  assert.equal(result.hardFail, true);
  assert.deepEqual(new Set(result.issues.map((issue) => issue.code)), new Set([
    "UNSAFE_MARKUP_OR_URL", "PROMOTIONAL_OR_LEAD_COPY", "SELF_LINK",
  ]));
});

test("migration 011 indexes match public/history queries and rolls back cleanly", () => {
  const { dir, db } = fixtureDb();
  try {
    db.pragma("optimize");
    const publicPlan = db.prepare(`
      EXPLAIN QUERY PLAN SELECT id FROM semantic_link_sets
      WHERE source_type = 'ARTICLE' AND source_id = 'article-choice' AND status = 'PUBLISHED'
      ORDER BY version DESC LIMIT 1
    `).all().map((row) => row.detail).join("\n");
    const itemsPlan = db.prepare(`
      EXPLAIN QUERY PLAN SELECT id FROM semantic_link_items
      WHERE link_set_id = 'fixture' ORDER BY sort_order, id
    `).all().map((row) => row.detail).join("\n");
    assert.match(publicPlan, /idx_semantic_links_(?:one_published|public)/);
    assert.match(itemsPlan, /idx_semantic_link_items_set/);
    const migrationSql = fs.readFileSync(path.resolve(import.meta.dirname, "..", "scripts", "migrations", "011_semantic_internal_linking.sql"), "utf8");
    const downSql = migrationSql.slice(migrationSql.indexOf("-- migrate:down") + "-- migrate:down".length);
    db.exec(downSql);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sqlite_schema WHERE name = 'semantic_link_sets'").get().count, 0);
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
