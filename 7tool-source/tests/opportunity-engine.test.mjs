import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import Database from "better-sqlite3";
import {
  approveOpportunityScoreModel,
  createOpportunityScoreModel,
  defaultOpportunityScoreModel,
  evaluateContentOpportunity,
  persistContentOpportunity,
  registerOpportunityBusinessInput,
  reviewContentOpportunity,
} from "../src/lib/opportunity-engine.mjs";
import { importKeywordBatch, persistConservativeClusters, registerSiteUrl } from "../src/lib/semantic-intelligence.mjs";
import {
  approveSerpSourceCandidate,
  createSerpAssessment,
  importSerpSnapshot,
  registerSerpSourceCandidate,
  reviewSerpAssessment,
} from "../src/lib/serp-intelligence.mjs";

const DIFFERENTIATION_SIGNALS = [
  "BETTER_TABLE", "COMPATIBILITY_DATA", "OWN_SUPPLIER_DATA", "CLEARER_EXPLANATION",
  "CALCULATOR", "BETTER_COMPARISON", "REVIEW_FAQ", "PRODUCT_SELECTION",
  "VERIFIED_SPECIFICATIONS", "LICENSED_PHOTOGRAPHY", "EXPERT_COMMENTARY",
];

function fixtureDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "7tool-opportunity-"));
  const dbPath = path.join(dir, "data.db");
  const backupPath = path.join(dir, "backup.db");
  const seed = new Database(dbPath);
  seed.exec(`
    CREATE TABLE categories (slug TEXT PRIMARY KEY, title TEXT, published INTEGER DEFAULT 1);
    CREATE TABLE products (
      id TEXT PRIMARY KEY, category TEXT, draft INTEGER NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE variants (
      id TEXT PRIMARY KEY, product_id TEXT REFERENCES products(id),
      available INTEGER NOT NULL DEFAULT 1, quantity INTEGER
    );
    INSERT INTO categories (slug, title) VALUES ('stanki-sverlilnye', 'Сверлильные станки');
  `);
  const insertProduct = seed.prepare("INSERT INTO products (id, category, draft, stock) VALUES (?, 'stanki-sverlilnye', 0, 5)");
  const insertVariant = seed.prepare("INSERT INTO variants (id, product_id, available, quantity) VALUES (?, ?, 1, 5)");
  for (let index = 1; index <= 10; index++) {
    insertProduct.run(`p${index}`);
    insertVariant.run(`v${index}`, `p${index}`);
  }
  seed.close(); fs.copyFileSync(dbPath, backupPath);
  const migration = spawnSync(process.execPath, ["scripts/migrate-seo.mjs", "--apply", `--backup=${backupPath}`], {
    cwd: path.resolve(import.meta.dirname, ".."), env: { ...process.env, SQLITE_PATH: dbPath }, encoding: "utf8",
  });
  assert.equal(migration.status, 0, migration.stderr || migration.stdout);
  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");
  return { dir, db };
}

function approveDefaultModel(db, version = "test-opportunity-v1") {
  const config = defaultOpportunityScoreModel();
  config.version = version;
  const model = createOpportunityScoreModel(db, config);
  return approveOpportunityScoreModel(db, { modelId: model.id, reviewedBy: "strategy-reviewer" });
}

function approvedSerpSource(db, engine) {
  const candidate = registerSerpSourceCandidate(db, {
    provider: `${engine} test export`, engine,
    baseUrl: `https://${engine.toLocaleLowerCase("en-US")}.opportunity-serp.test/export`,
    discoverySource: "test-contract", acquisitionMethod: "AUTHORIZED_EXPORT",
    termsStatus: "ALLOWED", robotsStatus: "NOT_APPLICABLE",
  });
  if (candidate.status !== "APPROVED") {
    approveSerpSourceCandidate(db, {
      id: candidate.id, acquisitionMethod: "AUTHORIZED_EXPORT",
      robotsStatus: "NOT_APPLICABLE", reviewedBy: "legal-reviewer",
    });
  }
  return db.prepare("SELECT * FROM serp_source_candidates WHERE id = ?").get(candidate.id);
}

function buildEvidence(db, { query, key, existingUrl, differentiationSignals = DIFFERENTIATION_SIGNALS }) {
  const wordstatSourceId = `wordstat-${key}`;
  importKeywordBatch(db, {
    sourceType: "WORDSTAT", sourceId: wordstatSourceId, region: "RU-MOW", categorySlug: "stanki-sverlilnye",
    rows: [{ query, frequency: 2500, exactFrequency: 900, existingUrl, pageType: "CATEGORY", indexStatus: "INDEX" }],
  });
  persistConservativeClusters(db, { categorySlug: "stanki-sverlilnye", sourceId: wordstatSourceId });
  const semantic = db.prepare(`
    SELECT cluster_id AS clusterId, intent_id AS intentId FROM seo_keywords WHERE source_id = ?
  `).get(wordstatSourceId);
  const gscSourceId = `gsc-${key}`;
  importKeywordBatch(db, {
    sourceType: "GSC", sourceId: gscSourceId, region: "RU-MOW", categorySlug: "stanki-sverlilnye",
    rows: [{ query, frequency: 700 }],
  });
  db.prepare("UPDATE seo_keywords SET cluster_id = ?, intent_id = ?, status = 'CLUSTERED' WHERE source_id = ?")
    .run(semantic.clusterId, semantic.intentId, gscSourceId);

  const capturedAt = Date.now();
  const snapshotIds = [];
  for (const engine of ["GOOGLE", "YANDEX"]) {
    const source = approvedSerpSource(db, engine);
    const results = [1, 2, 3, 4, 5].map((position) => ({
      position,
      url: `https://${engine.toLocaleLowerCase("en-US")}-${position}.results.test/${key}`,
      title: position <= 4 ? "Экспертная статья" : "Каталог станков",
      pageType: position <= 4 ? "ARTICLE" : "CATEGORY",
      siteClass: "COMPETITOR",
    }));
    const imported = importSerpSnapshot(db, {
      sourceCandidateId: source.id, acquisitionMethod: "AUTHORIZED_EXPORT", engine,
      query, region: "RU-MOW", language: "ru", device: "DESKTOP",
      clusterId: semantic.clusterId, intentId: semantic.intentId,
      capturedAt, topN: 5, results,
      insights: [
        { insightType: "MISSING_TABLE", summary: "Нет единой таблицы подбора", severity: 85, resultPosition: 1 },
        { insightType: "MISSING_COMPARISON", summary: "Нет проверенного сравнения", severity: 75, resultPosition: 2 },
      ],
    });
    snapshotIds.push(imported.snapshotId);
  }
  const assessment = createSerpAssessment(db, { snapshotIds, differentiationSignals });
  reviewSerpAssessment(db, { assessmentId: assessment.id, decision: "APPROVE", reviewedBy: "seo-reviewer" });
  registerOpportunityBusinessInput(db, {
    categorySlug: "stanki-sverlilnye", clusterId: semantic.clusterId,
    businessPriority: 95, marginBusinessScore: 90,
    sourceRef: `approved-planning-sheet:${key}`, validFrom: Date.now() - 1000,
    reviewedBy: "commercial-reviewer",
  });
  const now = Date.now();
  const painId = `pain-${key}`;
  db.prepare(`
    INSERT INTO pain_points (
      id, category_slug, product_type, problem_key, problem, mentions, sources_count,
      severity, commercial_relevance, suggested_content_type, priority, status, created_at, updated_at
    ) VALUES (?, 'stanki-sverlilnye', 'MAGNETIC_DRILL', ?, ?, 120, 2, 90, 95, 'TROUBLESHOOTING', 92, 'REVIEWED', ?, ?)
  `).run(painId, `problem-${key}`, `Проблема ${key}`, now, now);
  return { ...semantic, painId, assessmentId: assessment.id };
}

test("score models are configurable, immutable and have one human-approved active version", () => {
  const { dir, db } = fixtureDb();
  try {
    const config = defaultOpportunityScoreModel();
    config.version = "model-v1";
    const first = createOpportunityScoreModel(db, config);
    assert.equal(createOpportunityScoreModel(db, config).id, first.id);
    const mutated = defaultOpportunityScoreModel();
    mutated.version = "model-v1";
    mutated.thresholds.createMinScore = 61;
    assert.throws(() => createOpportunityScoreModel(db, mutated), /immutable/);
    assert.throws(() => approveOpportunityScoreModel(db, { modelId: first.id }), /reviewer/);
    approveOpportunityScoreModel(db, { modelId: first.id, reviewedBy: "strategy-reviewer" });
    const secondConfig = defaultOpportunityScoreModel();
    secondConfig.version = "model-v2";
    secondConfig.weights.factors.differentiation = 2;
    const second = createOpportunityScoreModel(db, secondConfig);
    approveOpportunityScoreModel(db, { modelId: second.id, reviewedBy: "strategy-reviewer" });
    assert.equal(db.prepare("SELECT status FROM score_models WHERE id = ?").get(first.id).status, "RETIRED");
    assert.equal(db.prepare("SELECT status FROM score_models WHERE id = ?").get(second.id).status, "APPROVED");
  } finally { db.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test("a differentiated new intent produces an idempotent CREATE proposal, never a page", () => {
  const { dir, db } = fixtureDb();
  try {
    approveDefaultModel(db);
    const evidence = buildEvidence(db, { query: "как выбрать магнитный станок", key: "create" });
    const first = persistContentOpportunity(db, { intentId: evidence.intentId, painPoints: [{ id: evidence.painId, relevance: 100 }] });
    const repeated = persistContentOpportunity(db, { intentId: evidence.intentId, painPoints: [{ id: evidence.painId, relevance: 100 }] });
    assert.equal(first.opportunity.decision, "CREATE");
    assert.equal(first.opportunity.recommended_url_id, null);
    assert.equal(repeated.duplicate, true);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM opportunity_evaluations").get().count, 1);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM content_assets").get().count, 0);

    registerOpportunityBusinessInput(db, {
      categorySlug: "stanki-sverlilnye", clusterId: evidence.clusterId,
      businessPriority: 96, marginBusinessScore: 92,
      sourceRef: "approved-planning-sheet:create-v2", validFrom: Date.now(), reviewedBy: "commercial-reviewer",
    });
    assert.throws(() => reviewContentOpportunity(db, {
      opportunityId: first.opportunity.id, reviewDecision: "APPROVE", reviewedBy: "editorial-reviewer",
    }), /stale/);
    const reevaluated = persistContentOpportunity(db, { intentId: evidence.intentId, painPoints: [{ id: evidence.painId, relevance: 100 }] });
    assert.equal(reevaluated.opportunity.id, first.opportunity.id);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM opportunity_evaluations").get().count, 2);
    const reviewed = reviewContentOpportunity(db, {
      opportunityId: first.opportunity.id, reviewDecision: "APPROVE", reviewedBy: "editorial-reviewer",
    });
    assert.equal(reviewed.status, "REVIEWED");
    db.prepare("UPDATE products SET stock = 0").run();
    db.prepare("UPDATE variants SET quantity = 0").run();
    const unavailable = persistContentOpportunity(db, { intentId: evidence.intentId, painPoints: [{ id: evidence.painId, relevance: 100 }] });
    assert.equal(unavailable.opportunity.decision, "REJECT");
    assert.equal(unavailable.opportunity.decision_reason_code, "NO_PRODUCT_AVAILABILITY");
    db.prepare("UPDATE products SET stock = 5").run();
    db.prepare("UPDATE variants SET quantity = 5").run();
    const restored = persistContentOpportunity(db, { intentId: evidence.intentId, painPoints: [{ id: evidence.painId, relevance: 100 }] });
    assert.equal(restored.duplicate, false);
    assert.equal(restored.opportunity.decision, "CREATE");
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM opportunity_evaluations").get().count, 4);
  } finally { db.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test("an existing best URL produces UPDATE and overlapping URLs produce MERGE", () => {
  const updateFixture = fixtureDb();
  try {
    approveDefaultModel(updateFixture.db, "update-model");
    const evidence = buildEvidence(updateFixture.db, {
      query: "как выбрать сверлильный станок", key: "update", existingUrl: "/c/stanki-sverlilnye",
    });
    const proposal = evaluateContentOpportunity(updateFixture.db, { intentId: evidence.intentId, painPoints: [evidence.painId] });
    assert.equal(proposal.decision, "UPDATE");
    assert.ok(proposal.recommendedUrlId);
    assert.equal(proposal.existingUrlCount, 1);
  } finally { updateFixture.db.close(); fs.rmSync(updateFixture.dir, { recursive: true, force: true }); }

  const mergeFixture = fixtureDb();
  try {
    approveDefaultModel(mergeFixture.db, "merge-model");
    const evidence = buildEvidence(mergeFixture.db, { query: "как выбрать станок для сверления", key: "merge" });
    const firstUrl = registerSiteUrl(mergeFixture.db, { path: "/c/stanki-sverlilnye", pageType: "CATEGORY", indexStatus: "INDEX", httpStatus: 200 });
    const secondUrl = registerSiteUrl(mergeFixture.db, { path: "/lp/stanki-sverlilnye", pageType: "SEO_LANDING", indexStatus: "INDEX", httpStatus: 200 });
    const now = Date.now();
    const insertMapping = mergeFixture.db.prepare(`
      INSERT INTO intent_url_mappings (
        intent_id, site_url_id, mapping_role, status, reviewed_by, reviewed_at, created_at, updated_at
      ) VALUES (?, ?, 'OVERLAP', 'APPROVED', 'seo-reviewer', ?, ?, ?)
    `);
    insertMapping.run(evidence.intentId, firstUrl.id, now, now, now);
    insertMapping.run(evidence.intentId, secondUrl.id, now, now, now);
    const proposal = evaluateContentOpportunity(mergeFixture.db, { intentId: evidence.intentId, painPoints: [evidence.painId] });
    assert.equal(proposal.decision, "MERGE");
    assert.equal(proposal.decisionReasonCode, "OVERLAPPING_PAGES");
    assert.equal(proposal.existingUrlCount, 2);
  } finally { mergeFixture.db.close(); fs.rmSync(mergeFixture.dir, { recursive: true, force: true }); }
});

test("no differentiation is a hard REJECT regardless of other commercial signals", () => {
  const { dir, db } = fixtureDb();
  try {
    approveDefaultModel(db, "reject-model");
    const evidence = buildEvidence(db, {
      query: "лучший магнитный сверлильный станок", key: "reject", differentiationSignals: [],
    });
    const proposal = evaluateContentOpportunity(db, { intentId: evidence.intentId, painPoints: [evidence.painId] });
    assert.equal(proposal.decision, "REJECT");
    assert.equal(proposal.decisionReasonCode, "SERP_REJECTED");
    assert.equal(proposal.differentiationScore, 0);
  } finally { db.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test("a materially duplicate intent merges into the existing opportunity instead of creating another page", () => {
  const { dir, db } = fixtureDb();
  try {
    approveDefaultModel(db, "duplicate-model");
    const firstEvidence = buildEvidence(db, { query: "выбрать магнитный станок", key: "duplicate-a" });
    const first = persistContentOpportunity(db, { intentId: firstEvidence.intentId, painPoints: [firstEvidence.painId] });
    assert.equal(first.opportunity.decision, "CREATE");
    const secondEvidence = buildEvidence(db, { query: "как выбрать магнитный станок", key: "duplicate-b" });
    const second = persistContentOpportunity(db, { intentId: secondEvidence.intentId, painPoints: [secondEvidence.painId] });
    assert.equal(second.opportunity.decision, "MERGE");
    assert.equal(second.opportunity.merge_into_opportunity_id, first.opportunity.id);
    assert.equal(second.opportunity.decision_reason_code, "DUPLICATE_INTENT");
  } finally { db.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});
