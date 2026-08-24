import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import Database from "better-sqlite3";
import {
  approveArticleBrief,
  createArticleBrief,
  createArticleCandidate,
  reviewContentSource,
  saveArticleRevision,
  scanProhibitedAiContent,
  transitionArticle,
} from "../src/lib/content-platform.mjs";
import {
  createMediaSelectionRequests,
  rankMediaSelection,
  reviewMediaNoMatch,
} from "../src/lib/image-intelligence.mjs";

function fixtureDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "7tool-content-"));
  const dbPath = path.join(dir, "data.db");
  const backupPath = path.join(dir, "backup.db");
  const seed = new Database(dbPath);
  seed.exec(`
    CREATE TABLE categories (slug TEXT PRIMARY KEY, title TEXT NOT NULL, published INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE products (
      id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, brand TEXT,
      category TEXT, draft INTEGER NOT NULL DEFAULT 0, stock INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE variants (
      id TEXT PRIMARY KEY, product_id TEXT REFERENCES products(id), available INTEGER NOT NULL DEFAULT 1,
      quantity INTEGER
    );
    INSERT INTO categories (slug, title) VALUES ('stanki-sverlilnye', 'Сверлильные станки');
    INSERT INTO products (id, slug, title, brand, category, draft, stock)
    VALUES ('p1', 'heden-dm-50', 'Магнитный станок HEDEN DM-50', 'HEDEN', 'stanki-sverlilnye', 0, 5);
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
  const now = Date.now();
  db.exec(`
    INSERT INTO sources (id, source_type, name, rights_policy, active, created_at, updated_at)
    VALUES ('manual-source', 'MANUAL', 'Проверенный паспорт изделия', 'PUBLISHABLE_FACTS', 1, ${now}, ${now});
    INSERT INTO keyword_clusters (
      id, name, category_slug, centroid_text, cluster_method, model_version, status, created_at, updated_at
    ) VALUES (
      'cluster-1', 'Выбор магнитного станка', 'stanki-sverlilnye', 'как выбрать магнитный станок',
      'HUMAN_REVIEWED', 'test-v1', 'REVIEWED', ${now}, ${now}
    );
    INSERT INTO search_intents (
      id, intent_key, label, intent_class, dominant_serp_type, category_slug, status,
      reviewed_by, reviewed_at, created_at, updated_at
    ) VALUES (
      'intent-1', 'intent-magnetic-selection', 'Как выбрать магнитный сверлильный станок',
      'SELECTION', 'ARTICLE', 'stanki-sverlilnye', 'REVIEWED', 'semantic-reviewer', ${now}, ${now}, ${now}
    );
    INSERT INTO seo_keywords (
      id, query, normalized_query, source_id, region, language, frequency, exact_frequency,
      category_slug, intent_id, cluster_id, intent_class, cannibalization_risk, status,
      first_seen_at, last_seen_at, created_at, updated_at
    ) VALUES (
      'keyword-1', 'как выбрать магнитный станок', 'как выбрать магнитный станок', 'manual-source',
      'RU-MOW', 'ru', 800, 300, 'stanki-sverlilnye', 'intent-1', 'cluster-1', 'SELECTION',
      'LOW', 'REVIEWED', ${now}, ${now}, ${now}, ${now}
    );
    INSERT INTO score_models (
      id, score_type, version, weights_json, thresholds_json, model_checksum, status,
      approved_by, approved_at, created_at
    ) VALUES (
      'score-1', 'CONTENT_OPPORTUNITY', 'test-v1', '{}', '{}', 'score-checksum',
      'APPROVED', 'strategy-reviewer', ${now}, ${now}
    );
    INSERT INTO opportunity_business_inputs (
      id, category_slug, cluster_id, business_priority, margin_business_score, source_ref,
      input_checksum, valid_from, status, reviewed_by, reviewed_at, created_at
    ) VALUES (
      'business-1', 'stanki-sverlilnye', 'cluster-1', 90, 85, 'approved-plan',
      'business-checksum', ${now - 1000}, 'ACTIVE', 'commercial-reviewer', ${now}, ${now}
    );
    INSERT INTO serp_assessments (
      id, cluster_id, intent_id, dominant_serp_type, dominant_share, sample_size,
      distribution_json, commercial_density, marketplace_share, content_gap_score,
      differentiation_score, differentiation_signals_json, score_model_version,
      assessment_checksum, recommended_page_type, recommendation, rationale, status,
      reviewed_by, reviewed_at, created_at, updated_at
    ) VALUES (
      'serp-assessment-1', 'cluster-1', 'intent-1', 'ARTICLE', 0.8, 10, '{}', 0.2, 0.1,
      90, 90, '["VERIFIED_SPECIFICATIONS"]', 'test-v1', 'serp-checksum',
      'ARTICLE_CANDIDATE', 'KEEP_FOR_OPPORTUNITY_REVIEW', 'Есть проверяемый пробел.',
      'REVIEWED', 'seo-reviewer', ${now}, ${now}, ${now}
    );
    INSERT INTO content_opportunities (
      id, topic, category_slug, cluster_id, intent_id, primary_keyword_id, serp_assessment_id,
      score_model_id, business_input_id, wordstat_demand, google_demand, search_demand_score,
      intent_value, business_priority, product_relevance, content_gap_score, pain_point_strength,
      product_availability, margin_business_score, differentiation_score, competition_score,
      cannibalization_risk, duplicate_risk, cannibalization_penalty, duplicate_penalty,
      existing_url_count, recommended_page_type, decision, opportunity_score,
      score_breakdown_json, decision_reason_code, decision_reason, evaluation_checksum,
      status, reviewed_by, reviewed_at, created_at, updated_at
    ) VALUES (
      'opportunity-1', 'Как выбрать магнитный сверлильный станок', 'stanki-sverlilnye',
      'cluster-1', 'intent-1', 'keyword-1', 'serp-assessment-1', 'score-1', 'business-1',
      800, 300, 80, 90, 90, 95, 90, 70, 90, 85, 90, 40, 'LOW', 'LOW', 0, 0, 0,
      'PILLAR_GUIDE', 'CREATE', 91, '{}', 'NEW_INTENT', 'Новый проверенный intent.',
      'opportunity-checksum', 'REVIEWED', 'editorial-reviewer', ${now}, ${now}, ${now}
    );
  `);
  return { dir, db };
}

const aiActor = { actorType: "AI_ASSISTED", actorId: "content-assistant" };
const humanActor = { actorType: "HUMAN", actorId: "editor@example.test" };

function reviewedBrief(articleId) {
  return {
    articleId,
    ...aiActor,
    generatedByAi: true,
    userIntent: "Подобрать магнитный станок под задачу сверления.",
    problem: "Параметры станка и оснастки легко перепутать без сверки с паспортом.",
    audience: "Инженер, снабженец или мастер производственного участка.",
    shortAnswer: "Сначала определите материал, диаметр и глубину отверстия. Затем сверьте рабочий диапазон станка и оснастки по паспорту изделия.",
    keyQuestions: ["Какой диаметр требуется?", "Какая оснастка совместима?"],
    verifiedFacts: [{
      text: "Рабочий диапазон конкретной модели подтверждается паспортом изделия.",
      sourceRef: "manual:heden-dm-50",
      sourceId: "manual-source",
    }],
    relevantProducts: ["p1"],
    relevantSupplierImages: [{
      description: "Общий вид магнитного станка HEDEN DM-50",
      sourceRef: "supplier-feed:heden-dm-50",
    }],
    requiredDiagrams: ["Схема проверки рабочей зоны"],
    requiredTables: ["Параметр задачи → характеристика станка"],
    calculatorRequirement: "Не требуется; формулы и допустимые диапазоны требуют отдельной фазы.",
    faqInsights: ["Как проверить совместимость оснастки?"],
    competitorGaps: ["Нет явного раздела с ограничениями"],
    internalLinks: ["/c/stanki-sverlilnye"],
    cta: "Передать параметры задачи менеджеру для проверки.",
    evidenceRequirements: ["Каждая числовая характеристика должна иметь sourceRef"],
  };
}

function validContent() {
  return {
    shortAnswer: [
      { text: "Сначала определите материал, диаметр и глубину отверстия.", sourceRefs: ["manual:heden-dm-50"] },
      { text: "Затем сверьте рабочий диапазон станка и оснастки по паспорту изделия.", sourceRefs: ["manual:heden-dm-50"] },
    ],
    sections: [
      {
        heading: "Как проверить параметры задачи",
        blocks: [{
          type: "paragraph",
          text: "Зафиксируйте материал заготовки и требования к отверстию, затем сопоставьте их с паспортом выбранной модели.",
          sourceRefs: ["manual:heden-dm-50"],
        }],
      },
      {
        heading: "Ограничения применения",
        blocks: [{
          type: "note",
          text: "Не переносите характеристики одной модификации на другую без проверки паспорта.",
          sourceRefs: ["manual:heden-dm-50"],
        }],
      },
      {
        heading: "Типовые ошибки и проверки",
        blocks: [{
          type: "list",
          items: ["Выбор только по названию модели", "Проверка станка без проверки оснастки"],
          sourceRefs: ["manual:heden-dm-50"],
        }],
      },
    ],
    faq: [{
      question: "Что проверить перед заказом?",
      answer: "Параметры задачи, модификацию станка и совместимость оснастки.",
      sourceRef: "manual:heden-dm-50",
    }],
    internalLinks: [{
      targetPath: "/c/stanki-sverlilnye",
      anchorText: "Магнитные сверлильные станки",
      role: "PRODUCT",
    }],
  };
}

test("Content Platform enforces brief-first, evidence-first and human-only publication", () => {
  const { dir, db } = fixtureDb();
  try {
    const candidate = createArticleCandidate(db, {
      opportunityId: "opportunity-1",
      slug: "kak-vybrat-magnitnyy-stanok",
      ...aiActor,
    });
    assert.equal(candidate.article.status, "DISCOVERED");
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM site_urls WHERE entity_id = ?").get(candidate.article.id).count, 0);
    transitionArticle(db, {
      articleId: candidate.article.id,
      toStatus: "SEMANTIC_REVIEW",
      reason: "Prepare reviewed semantic input",
      ...aiActor,
    });
    const brief = createArticleBrief(db, reviewedBrief(candidate.article.id));
    assert.equal(brief.brief.status, "READY");
    assert.throws(() => approveArticleBrief(db, { articleId: candidate.article.id, ...aiActor }), /human actor/);
    approveArticleBrief(db, { articleId: candidate.article.id, notes: "Brief is complete", ...humanActor });
    const mediaRequests = createMediaSelectionRequests(db, { articleId: candidate.article.id, ...aiActor });
    const supplierBriefItem = db.prepare(`
      SELECT id FROM article_brief_items WHERE brief_id = ? AND item_type = 'SUPPLIER_IMAGE'
    `).get(db.prepare("SELECT current_brief_id FROM content_assets WHERE id = ?").get(candidate.article.id).current_brief_id);
    const supplierMediaRequest = mediaRequests.find((request) => request.brief_item_id === supplierBriefItem.id);
    assert.ok(supplierMediaRequest);
    assert.equal(rankMediaSelection(db, { requestId: supplierMediaRequest.id, ...aiActor }).length, 0);

    const prohibited = saveArticleRevision(db, {
      articleId: candidate.article.id,
      ...aiActor,
      generatedByAi: true,
      excerpt: "Черновик для проверки автоматических запретов.",
      content: {
        ...validContent(),
        shortAnswer: [
          "В современном мире правильный выбор очень важен.",
          "Мы протестировали станок и получили результат без указания источника.",
        ],
      },
    });
    assert.equal(prohibited.qualityCheck.hard_fail, 1);
    assert.match(prohibited.qualityCheck.issues_json, /AI_CLICHE_MODERN_WORLD/);
    assert.throws(() => transitionArticle(db, {
      articleId: candidate.article.id, toStatus: "FACT_CHECK", reason: "Submit bad draft", ...aiActor,
    }), /hard fail/);
    assert.throws(() => transitionArticle(db, {
      articleId: candidate.article.id, toStatus: "PUBLISHED", reason: "Skip reviews", ...humanActor,
    }), /Invalid article transition/);

    const revision = saveArticleRevision(db, {
      articleId: candidate.article.id,
      ...aiActor,
      generatedByAi: true,
      title: "Как выбрать магнитный сверлильный станок",
      h1: "Как выбрать магнитный сверлильный станок под задачу",
      metaTitle: "Как выбрать магнитный сверлильный станок",
      metaDescription: "Проверяем параметры задачи, ограничения станка и совместимость оснастки по подтверждённым данным.",
      excerpt: "Практический порядок проверки параметров задачи, оборудования и оснастки до заказа.",
      leadFormType: "EQUIPMENT_SELECTION",
      content: validContent(),
    });
    assert.equal(revision.qualityCheck.hard_fail, 0, revision.qualityCheck.issues_json);
    assert.throws(() => db.prepare("UPDATE content_revisions SET content_body = '{}' WHERE id = ?").run(revision.revision.id), /immutable/);

    const source = db.prepare("SELECT id FROM content_sources WHERE content_asset_id = ?").get(candidate.article.id);
    db.prepare("UPDATE sources SET rights_policy = 'RESEARCH_ONLY' WHERE id = 'manual-source'").run();
    assert.throws(() => reviewContentSource(db, {
      articleId: candidate.article.id, sourceId: source.id, decision: "VERIFY", ...humanActor,
    }), /RESEARCH_ONLY/);
    db.prepare("UPDATE sources SET rights_policy = 'PUBLISHABLE_FACTS' WHERE id = 'manual-source'").run();
    reviewContentSource(db, {
      articleId: candidate.article.id, sourceId: source.id, decision: "VERIFY", ...humanActor,
    });
    transitionArticle(db, {
      articleId: candidate.article.id, toStatus: "FACT_CHECK", reason: "Draft passed automated hard gates", ...aiActor,
    });
    transitionArticle(db, {
      articleId: candidate.article.id, toStatus: "SEO_REVIEW", reason: "Every claim checked against the source", ...humanActor,
    });
    transitionArticle(db, {
      articleId: candidate.article.id, toStatus: "EXPERT_REVIEW", reason: "Metadata and intent reviewed", ...humanActor,
    });
    transitionArticle(db, {
      articleId: candidate.article.id,
      toStatus: "READY",
      reason: "Technical limitations and product references verified",
      author: "Редакция 7TOOL",
      expertReviewer: "Иван Петров",
      qualityScore: 92,
      evidenceScore: 94,
      differentiationScore: 90,
      businessScore: 88,
      ...humanActor,
    });
    assert.throws(() => transitionArticle(db, {
      articleId: candidate.article.id, toStatus: "PUBLISHED", reason: "AI publish attempt", ...aiActor,
    }), /human actor/);
    assert.throws(() => transitionArticle(db, {
      articleId: candidate.article.id, toStatus: "PUBLISHED", reason: "Unreviewed image no-match", ...humanActor,
    }), /Supplier Image/);
    reviewMediaNoMatch(db, {
      requestId: supplierMediaRequest.id,
      reason: "Supplier feed has no rights-approved image for this exact need",
      ...humanActor,
    });
    const published = transitionArticle(db, {
      articleId: candidate.article.id, toStatus: "PUBLISHED", reason: "Final editorial approval", ...humanActor,
    });
    assert.equal(published.status, "PUBLISHED");
    assert.equal(published.index_status, "INDEX");
    assert.equal(published.human_reviewed, 1);
    assert.equal(db.prepare("SELECT path FROM site_urls WHERE id = ?").get(published.site_url_id).path, "/articles/kak-vybrat-magnitnyy-stanok");
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM content_approvals WHERE content_asset_id = ?").get(published.id).count, 5);
    assert.equal(db.prepare("PRAGMA foreign_key_check").all().length, 0);
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("prohibited-content scanner identifies unsupported specifications, repetition and keyword stuffing", () => {
  const repetitive = "Магнитный станок выбирают только после проверки технического задания и паспорта изделия.";
  const scan = scanProhibitedAiContent({
    shortAnswer: [
      "Сначала проверьте условия задачи и ограничения оборудования.",
      "После этого сопоставьте их с документами на конкретную модель.",
    ],
    sections: [
      { heading: "Проверка", blocks: [
        { type: "paragraph", text: repetitive },
        { type: "paragraph", text: repetitive },
        { type: "paragraph", text: "Наши эксперты испытали модель мощностью 1200 Вт и доказали её превосходство." },
        { type: "paragraph", text: "магнитный станок магнитный станок магнитный станок магнитный станок магнитный станок магнитный станок" },
      ] },
    ],
    faq: [],
    internalLinks: [],
  }, { primaryKeyword: "магнитный станок" });
  const codes = new Set(scan.issues.map((item) => item.code));
  assert.equal(scan.hardFail, true);
  assert.ok(codes.has("REPETITION"));
  assert.ok(codes.has("INVENTED_EXPERTISE"));
  assert.ok(codes.has("INVENTED_TEST_RESULT"));
  assert.ok(codes.has("INVENTED_SPECIFICATION"));
  assert.ok(codes.has("KEYWORD_STUFFING"));
});

test("migration 007 indexes match public and workflow query plans", () => {
  const { dir, db } = fixtureDb();
  try {
    db.pragma("optimize");
    const publicPlan = db.prepare(`
      EXPLAIN QUERY PLAN SELECT id FROM content_assets
      WHERE status = 'PUBLISHED' AND index_status = 'INDEX' AND human_reviewed = 1
      ORDER BY published_at DESC LIMIT 100
    `).all().map((row) => row.detail).join("\n");
    const workflowPlan = db.prepare(`
      EXPLAIN QUERY PLAN SELECT id FROM content_assets
      WHERE status = 'CONTENT_DRAFT' ORDER BY content_type, updated_at DESC LIMIT 100
    `).all().map((row) => row.detail).join("\n");
    assert.match(publicPlan, /idx_content_assets_public/);
    assert.match(workflowPlan, /idx_content_assets_workflow/);
    for (const filename of ["012_lead_generation.sql", "011_semantic_internal_linking.sql", "010_interactive_tools.sql", "009_product_enrichment.sql", "008_image_intelligence.sql", "007_content_platform.sql"]) {
      const migrationSql = fs.readFileSync(path.resolve(import.meta.dirname, "..", "scripts", "migrations", filename), "utf8");
      const downSql = migrationSql.slice(migrationSql.indexOf("-- migrate:down") + "-- migrate:down".length);
      db.exec(downSql);
    }
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sqlite_schema WHERE name = 'content_assets'").get().count, 0);
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
