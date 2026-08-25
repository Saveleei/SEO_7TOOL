import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

import {
  CONTENT_HARD_FAIL_CODES,
  DIFFERENTIATION_SCORE_MINIMUM,
  EVIDENCE_POINTS,
  EVIDENCE_SCORE_MINIMUM,
  QUALITY_SCORE_MINIMUM,
  QUALITY_WEIGHTS,
  SCALE_CHECKPOINTS,
  assessContentQuality,
  calculateContentQualityScore,
  createScaleProgram,
  enqueueScaleContent,
  getScaleStatus,
  listScaleCandidates,
  markPublishQueueComplete,
  requestNextScaleCheckpoint,
  requireApprovedPublishQueue,
  reviewContentScorecard,
  reviewPublishQueueItem,
  reviewScaleCheckpoint,
} from "../src/lib/scale-governance.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationPath = path.join(root, "scripts", "migrations", "017_scale_governance.sql");
const migrationSql = fs.readFileSync(migrationPath, "utf8");
const upSql = migrationSql.slice(migrationSql.indexOf("-- migrate:up") + "-- migrate:up".length, migrationSql.indexOf("-- migrate:down"));
const downSql = migrationSql.slice(migrationSql.indexOf("-- migrate:down") + "-- migrate:down".length);

function fixtureDb() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "7tool-scale-"));
  const db = new Database(path.join(directory, "fixture.db"));
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE categories (slug TEXT PRIMARY KEY, title TEXT NOT NULL);
    CREATE TABLE pilot_programs (id TEXT PRIMARY KEY, status TEXT NOT NULL);
    CREATE TABLE pilot_kpi_snapshots (
      id TEXT PRIMARY KEY,
      pilot_id TEXT NOT NULL REFERENCES pilot_programs(id),
      scope_type TEXT NOT NULL,
      category_slug TEXT
    );
    CREATE TABLE content_opportunities (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      decision TEXT NOT NULL,
      opportunity_score INTEGER NOT NULL,
      evaluation_checksum TEXT NOT NULL,
      cannibalization_risk TEXT NOT NULL,
      duplicate_risk TEXT NOT NULL
    );
    CREATE TABLE content_assets (
      id TEXT PRIMARY KEY,
      current_revision_id TEXT,
      opportunity_id TEXT NOT NULL REFERENCES content_opportunities(id),
      source_opportunity_checksum TEXT NOT NULL,
      status TEXT NOT NULL,
      human_reviewed INTEGER NOT NULL,
      slug TEXT NOT NULL,
      canonical TEXT NOT NULL,
      content_type TEXT NOT NULL,
      category_slug TEXT NOT NULL REFERENCES categories(slug),
      title TEXT NOT NULL,
      quality_score INTEGER,
      evidence_score INTEGER,
      differentiation_score INTEGER,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE content_revisions (
      id TEXT PRIMARY KEY,
      content_asset_id TEXT NOT NULL REFERENCES content_assets(id),
      content_body TEXT NOT NULL,
      content_hash TEXT NOT NULL
    );
    CREATE TABLE content_quality_checks (
      revision_id TEXT PRIMARY KEY REFERENCES content_revisions(id),
      issues_json TEXT NOT NULL,
      hard_fail INTEGER NOT NULL
    );
    CREATE TABLE sources (
      id TEXT PRIMARY KEY,
      source_type TEXT NOT NULL,
      active INTEGER NOT NULL,
      rights_policy TEXT NOT NULL
    );
    CREATE TABLE fact_assertions (
      id TEXT PRIMARY KEY,
      predicate TEXT NOT NULL,
      verification_status TEXT NOT NULL
    );
    CREATE TABLE content_sources (
      id TEXT PRIMARY KEY,
      content_asset_id TEXT NOT NULL REFERENCES content_assets(id),
      source_id TEXT NOT NULL REFERENCES sources(id),
      assertion_id TEXT REFERENCES fact_assertions(id),
      evidence_status TEXT NOT NULL
    );
    CREATE TABLE content_approvals (
      id TEXT PRIMARY KEY,
      content_asset_id TEXT NOT NULL REFERENCES content_assets(id),
      revision_id TEXT NOT NULL REFERENCES content_revisions(id),
      approval_type TEXT NOT NULL,
      decision TEXT NOT NULL
    );
    CREATE TABLE products (id TEXT PRIMARY KEY, draft INTEGER NOT NULL);
    CREATE TABLE content_products (
      content_asset_id TEXT NOT NULL REFERENCES content_assets(id),
      product_id TEXT NOT NULL REFERENCES products(id)
    );
    CREATE TABLE product_compatibility (
      id TEXT PRIMARY KEY,
      product_a_id TEXT NOT NULL REFERENCES products(id),
      product_b_id TEXT NOT NULL REFERENCES products(id),
      verified INTEGER NOT NULL
    );
    CREATE TABLE pain_points (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      mentions INTEGER NOT NULL,
      sources_count INTEGER NOT NULL
    );
    CREATE TABLE opportunity_pain_points (
      opportunity_id TEXT NOT NULL REFERENCES content_opportunities(id),
      pain_point_id TEXT NOT NULL REFERENCES pain_points(id)
    );
    CREATE TABLE site_urls (
      path TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL
    );

    INSERT INTO categories VALUES ('stanki-sverlilnye', 'Сверлильные станки');
    INSERT INTO pilot_programs VALUES ('pilot-1', 'APPROVED');
    INSERT INTO pilot_kpi_snapshots VALUES ('pilot-kpi-1', 'pilot-1', 'PILOT', NULL);
    INSERT INTO products VALUES ('product-1', 0), ('product-2', 0);
    INSERT INTO product_compatibility VALUES ('compatibility-1', 'product-1', 'product-2', 1);
    INSERT INTO sources VALUES
      ('supplier-1', 'SUPPLIER_FEED', 1, 'PUBLISHABLE_FACTS'),
      ('manufacturer-1', 'MANUFACTURER', 1, 'PUBLISHABLE_FACTS'),
      ('manual-1', 'MANUAL', 1, 'PUBLISHABLE_FACTS');
    INSERT INTO fact_assertions VALUES ('assertion-1', 'verified compatibility', 'VERIFIED');
    INSERT INTO pain_points VALUES ('pain-1', 'REVIEWED', 12, 3);
  `);
  seedArticle(db, { suffix: "1", score: 96 });
  db.exec(upSql);
  return { db, directory };
}

function seedArticle(db, { suffix, score = 90 }) {
  const contentId = `content-${suffix}`;
  const revisionId = `revision-${suffix}`;
  const opportunityId = `opportunity-${suffix}`;
  const checksum = `opportunity-checksum-${suffix}`;
  const slug = `article-${suffix}`;
  const body = JSON.stringify({
    sections: [{
      heading: "Проверяемый расчёт",
      blocks: [{ type: "table", sourceRefs: [`manual:${suffix}`], rows: [["Параметр", "Значение"]] }],
    }],
  });
  db.prepare(`
    INSERT INTO content_opportunities (
      id, status, decision, opportunity_score, evaluation_checksum,
      cannibalization_risk, duplicate_risk
    ) VALUES (?, 'REVIEWED', 'CREATE', ?, ?, 'LOW', 'LOW')
  `).run(opportunityId, score, checksum);
  db.prepare(`
    INSERT INTO content_assets (
      id, current_revision_id, opportunity_id, source_opportunity_checksum,
      status, human_reviewed, slug, canonical, content_type, category_slug,
      title, updated_at
    ) VALUES (?, ?, ?, ?, 'READY', 1, ?, ?, 'ARTICLE', 'stanki-sverlilnye', ?, 1000)
  `).run(contentId, revisionId, opportunityId, checksum, slug, `/articles/${slug}`, `Статья ${suffix}`);
  db.prepare("INSERT INTO content_revisions VALUES (?, ?, ?, ?)")
    .run(revisionId, contentId, body, `content-hash-${suffix}`);
  db.prepare("INSERT INTO content_quality_checks VALUES (?, '[]', 0)").run(revisionId);
  db.prepare("INSERT INTO content_products VALUES (?, 'product-1')").run(contentId);
  db.prepare("INSERT INTO opportunity_pain_points VALUES (?, 'pain-1')").run(opportunityId);
  db.prepare("INSERT INTO site_urls VALUES (?, 'CONTENT_ASSET', ?)").run(`/articles/${slug}`, contentId);
  for (const [index, sourceId] of ["supplier-1", "manufacturer-1", "manual-1"].entries()) {
    db.prepare("INSERT INTO content_sources VALUES (?, ?, ?, ?, 'VERIFIED')")
      .run(`content-source-${suffix}-${index}`, contentId, sourceId, index === 2 ? "assertion-1" : null);
  }
  db.prepare("INSERT INTO content_approvals VALUES (?, ?, ?, 'FACT', 'APPROVED')")
    .run(`fact-approval-${suffix}`, contentId, revisionId);
  db.prepare("INSERT INTO content_approvals VALUES (?, ?, ?, 'EXPERT', 'APPROVED')")
    .run(`expert-approval-${suffix}`, contentId, revisionId);
  return { contentId, revisionId, opportunityId };
}

function cleanup(fixture) {
  fixture.db.close();
  fs.rmSync(fixture.directory, { recursive: true, force: true });
}

function scorecardInput(contentId, overrides = {}) {
  return {
    contentId,
    assessedBy: "quality-editor",
    assessedAt: 2_000,
    components: Object.fromEntries(Object.keys(QUALITY_WEIGHTS).map((key) => [key, 90])),
    differentiation: {
      score: 90,
      rationale: "Страница объединяет проверенные спецификации, расчёт и рабочий сценарий выбора оборудования.",
      proof: ["Параметры связаны с источниками и практической таблицей выбора."],
    },
    manualHardFails: [],
    ...overrides,
  };
}

function approveScorecard(db, contentId, assessedAt = 2_000, reviewedAt = 3_000) {
  const assessed = assessContentQuality(db, { ...scorecardInput(contentId), assessedAt });
  const reviewed = reviewContentScorecard(db, {
    scorecardId: assessed.scorecard.id,
    decision: "APPROVE",
    reviewedBy: "quality-reviewer",
    reviewedAt,
  });
  return { assessed, reviewed };
}

test("Phase 20 encodes the exact quality weights, thresholds, checkpoints and hard-fail taxonomy", () => {
  assert.deepEqual(SCALE_CHECKPOINTS, [25, 50, 100, 250]);
  assert.equal(QUALITY_SCORE_MINIMUM, 85);
  assert.equal(EVIDENCE_SCORE_MINIMUM, 80);
  assert.equal(DIFFERENTIATION_SCORE_MINIMUM, 60);
  assert.deepEqual(QUALITY_WEIGHTS, {
    intentMatch: 15,
    technicalAccuracy: 20,
    originalValue: 15,
    practicalValue: 15,
    evidence: 10,
    visualValue: 5,
    seo: 5,
    internalLinking: 5,
    conversionValue: 5,
    readability: 5,
  });
  assert.equal(Object.values(QUALITY_WEIGHTS).reduce((sum, value) => sum + value, 0), 100);
  assert.equal(Object.values(EVIDENCE_POINTS).reduce((sum, value) => sum + value, 0), 100);
  assert.deepEqual(CONTENT_HARD_FAIL_CODES, [
    "INVENTED_TECHNICAL_DATA", "DUPLICATE_INTENT", "SEVERE_CANNIBALIZATION",
    "COPYRIGHT_PROBLEM", "BROKEN_CANONICAL", "MISLEADING_CLAIM",
    "DUPLICATED_ARTICLE", "NO_UNIQUE_USER_VALUE",
  ]);
  const components = Object.fromEntries(Object.keys(QUALITY_WEIGHTS).map((key) => [key, 0]));
  components.technicalAccuracy = 100;
  assert.equal(calculateContentQualityScore(components).qualityScore, 20);

  const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  assert.equal(packageJson.scripts["seo:scale"], "node scripts/scale-governance.mjs");
  const cli = fs.readFileSync(path.join(root, "scripts", "scale-governance.mjs"), "utf8");
  assert.match(cli, /No command creates content or fills a publishing quota automatically/);
});

test("scorecards derive evidence, require human approval and keep immutable audit evidence", () => {
  const fixture = fixtureDb();
  try {
    const first = assessContentQuality(fixture.db, scorecardInput("content-1"));
    assert.equal(first.duplicate, false);
    assert.equal(first.assessment.qualityScore, 90);
    assert.equal(first.assessment.evidence.evidenceScore, 90);
    assert.equal(first.assessment.differentiation.score, 90);
    assert.equal(first.assessment.hardFails.hardFail, false);
    assert.equal(assessContentQuality(fixture.db, scorecardInput("content-1")).duplicate, true);

    const approved = reviewContentScorecard(fixture.db, {
      scorecardId: first.scorecard.id,
      decision: "APPROVE",
      reviewedBy: "quality-reviewer",
      reviewedAt: 3_000,
    });
    assert.equal(approved.status, "APPROVED");
    assert.deepEqual(
      fixture.db.prepare("SELECT quality_score, evidence_score, differentiation_score FROM content_assets WHERE id = 'content-1'").get(),
      { quality_score: 90, evidence_score: 90, differentiation_score: 90 },
    );
    assert.throws(
      () => fixture.db.prepare("UPDATE content_quality_scorecards SET quality_score = 99 WHERE id = ?").run(first.scorecard.id),
      /immutable/,
    );
  } finally { cleanup(fixture); }
});

test("hard fails block publication regardless of a high aggregate score", () => {
  const fixture = fixtureDb();
  try {
    fixture.db.prepare(`
      UPDATE content_opportunities
      SET duplicate_risk = 'HIGH', cannibalization_risk = 'HIGH'
      WHERE id = 'opportunity-1'
    `).run();
    const input = scorecardInput("content-1", {
      components: Object.fromEntries(Object.keys(QUALITY_WEIGHTS).map((key) => [key, 100])),
      differentiation: {
        score: 50,
        rationale: "Материал пока не доказывает достаточное отличие от страниц в текущей поисковой выдаче.",
        proof: ["Зафиксирован только один общий элемент без уникального пользовательского результата."],
      },
      manualHardFails: [{
        code: "MISLEADING_CLAIM",
        evidence: "Редактор обнаружил неподтверждённое обещание результата в основном тексте.",
      }],
    });
    const assessed = assessContentQuality(fixture.db, input);
    assert.equal(assessed.assessment.qualityScore, 100);
    assert.equal(assessed.assessment.hardFails.hardFail, true);
    assert.deepEqual(assessed.assessment.hardFails.hardFailCodes, [
      "DUPLICATE_INTENT", "SEVERE_CANNIBALIZATION", "MISLEADING_CLAIM", "NO_UNIQUE_USER_VALUE",
    ]);
    assert.throws(() => reviewContentScorecard(fixture.db, {
      scorecardId: assessed.scorecard.id,
      decision: "APPROVE",
      reviewedBy: "quality-reviewer",
      reviewedAt: 3_000,
    }), /DifferentiationScore|Hard fail/);
    assert.equal(fixture.db.prepare("SELECT status FROM content_quality_scorecards WHERE id = ?").get(assessed.scorecard.id).status, "REVIEW_REQUIRED");
  } finally { cleanup(fixture); }
});

test("a scorecard becomes stale when its opportunity evidence changes", () => {
  const fixture = fixtureDb();
  try {
    const assessed = assessContentQuality(fixture.db, scorecardInput("content-1"));
    fixture.db.prepare("UPDATE content_opportunities SET evaluation_checksum = 'changed-checksum' WHERE id = 'opportunity-1'").run();
    assert.throws(() => reviewContentScorecard(fixture.db, {
      scorecardId: assessed.scorecard.id,
      decision: "APPROVE",
      reviewedBy: "quality-reviewer",
      reviewedAt: 3_000,
    }), /evidence changed/);
  } finally { cleanup(fixture); }
});

test("scale advances through reviewed ceilings and dispatches only explicitly queued content", () => {
  const fixture = fixtureDb();
  try {
    approveScorecard(fixture.db, "content-1");
    const created = createScaleProgram(fixture.db, {
      pilotId: "pilot-1",
      kpiSnapshotId: "pilot-kpi-1",
      successRationale: "Пилот достиг согласованных KPI и может перейти к контролируемому расширению.",
      createdBy: "scale-owner",
      createdAt: 3_100,
    });
    assert.equal(created.program.status, "REVIEW_REQUIRED");
    const activated = reviewScaleCheckpoint(fixture.db, {
      reviewId: created.checkpointReviewId,
      decision: "APPROVE",
      reviewedBy: "scale-reviewer",
      reviewedAt: 3_200,
    });
    assert.equal(activated.program.status, "ACTIVE");
    assert.equal(activated.program.current_checkpoint, 25);

    const candidates = listScaleCandidates(fixture.db, { scaleProgramId: created.program.id });
    assert.deepEqual(candidates.candidates.map((item) => item.id), ["content-1"]);
    assert.deepEqual(candidates.capacity, { used: 25, ceiling: 50, remaining: 25 });

    const queued = enqueueScaleContent(fixture.db, {
      scaleProgramId: created.program.id,
      contentId: "content-1",
      scheduledAt: 5_000,
      requestedBy: "publishing-editor",
      createdAt: 4_000,
    });
    assert.equal(queued.queueItem.status, "REVIEW_REQUIRED");
    assert.equal(queued.queueItem.created_at, 4_000);
    assert.equal(queued.queueItem.scheduled_at, 5_000);
    assert.equal(fixture.db.prepare("SELECT COUNT(*) AS count FROM content_publish_queue").get().count, 1);

    const approved = reviewPublishQueueItem(fixture.db, {
      queueId: queued.queueItem.id,
      decision: "APPROVE",
      reviewedBy: "publishing-reviewer",
      reviewedAt: 4_500,
    });
    assert.equal(approved.status, "APPROVED");
    assert.throws(() => requireApprovedPublishQueue(fixture.db, { id: "content-1" }, 4_999), /future time/);
    const dispatch = requireApprovedPublishQueue(fixture.db, { id: "content-1" }, 5_000);
    assert.equal(dispatch.id, queued.queueItem.id);
    assert.equal(markPublishQueueComplete(fixture.db, dispatch, 5_000).status, "PUBLISHED");

    const status = getScaleStatus(fixture.db, { scaleProgramId: created.program.id });
    assert.deepEqual(status.capacity, { used: 26, ceiling: 50, remaining: 24 });
    assert.deepEqual(status.queueCounts, [{ status: "PUBLISHED", count: 1 }]);
    assert.throws(() => requestNextScaleCheckpoint(fixture.db, {
      scaleProgramId: created.program.id,
      kpiSnapshotId: "pilot-kpi-1",
      successRationale: "Нужен следующий рубеж только после фактического достижения текущего объёма.",
      createdBy: "scale-owner",
      createdAt: 6_000,
    }), /requires 50 published items; observed 26/);

    seedArticle(fixture.db, { suffix: "2", score: 95 });
    assert.throws(
      () => requireApprovedPublishQueue(fixture.db, { id: "content-2" }, 6_000),
      /approved publish queue item/,
    );
  } finally { cleanup(fixture); }
});

test("migration 017 is indexed and reversible, and publication is wired to the active scale gate", () => {
  const fixture = fixtureDb();
  try {
    const dispatchPlan = fixture.db.prepare(`
      EXPLAIN QUERY PLAN SELECT id FROM content_publish_queue
      WHERE status = 'APPROVED' AND scheduled_at <= ?
      ORDER BY scheduled_at, priority DESC LIMIT 10
    `).all(10_000).map((row) => row.detail).join("\n");
    assert.match(dispatchPlan, /idx_content_publish_queue_dispatch/);
    const scorecardPlan = fixture.db.prepare(`
      EXPLAIN QUERY PLAN SELECT id FROM content_quality_scorecards
      WHERE content_id = ? AND revision_id = ? AND status = 'APPROVED'
      ORDER BY assessed_at DESC LIMIT 1
    `).all("content-1", "revision-1").map((row) => row.detail).join("\n");
    assert.match(scorecardPlan, /idx_content_scorecard_(one_approved|latest)/);

    const platform = fs.readFileSync(path.join(root, "src", "lib", "content-platform.mjs"), "utf8");
    assert.match(platform, /requireApprovedPublishQueue\(db, article, now\)/);
    assert.match(platform, /markPublishQueueComplete\(db, publishQueueItem, now\)/);

    fixture.db.exec(downSql);
    for (const table of [
      "content_scale_programs", "content_scale_checkpoint_reviews",
      "content_quality_scorecards", "content_publish_queue",
    ]) {
      assert.equal(fixture.db.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = ?").get(table), undefined);
    }
  } finally { cleanup(fixture); }
});
