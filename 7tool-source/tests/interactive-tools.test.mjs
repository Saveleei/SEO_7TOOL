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
  approveInteractiveTool,
  calculateAnnularCutterRpm,
  createInteractiveToolDraft,
  getPublicInteractiveTool,
  markStaleInteractiveTools,
  publishInteractiveTool,
  selectVerifiedProducts,
} from "../src/lib/tool-platform.mjs";

const human = { actorType: "HUMAN", actorId: "tool-reviewer@example.test" };
const ai = { actorType: "AI_ASSISTED", actorId: "tool-assistant" };
const system = { actorType: "SYSTEM", actorId: "tool-stale-scan-v1" };

function fixtureDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "7tool-interactive-tools-"));
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
    INSERT INTO categories (slug, title) VALUES
      ('stanki-sverlilnye', 'Магнитные сверлильные станки'),
      ('magnitnaya-osnastka', 'Оснастка для магнитных станков'),
      ('kromkorezy-po-listu', 'Кромкорезы по листу'),
      ('truborezy', 'Труборезы');
    INSERT INTO products (id, slug, title, brand, category, images, draft, stock) VALUES
      ('p1', 'lenz-steyr-50', 'Магнитный станок LENZ STEYR-50', 'LENZ', 'stanki-sverlilnye', '["/p1.jpg"]', 0, 3),
      ('p2', 'koronka-weldon-19', 'Корончатое сверло Weldon 19', 'LENZ', 'magnitnaya-osnastka', '["/p2.jpg"]', 0, 4),
      ('p3', 'beveler-15', 'Кромкорез BEVEL-15', '7TOOL', 'kromkorezy-po-listu', '["/p3.jpg"]', 0, 2),
      ('p4', 'pipe-cutter-120', 'Труборез PIPE-120', '7TOOL', 'truborezy', '["/p4.jpg"]', 0, 2),
      ('p5', 'unverified-magnetic-drill', 'Станок без verified-фактов', 'TEST', 'stanki-sverlilnye', '["/p5.jpg"]', 0, 1);
    INSERT INTO variants (id, product_id, name, params, images, available, quantity) VALUES
      ('v1', 'p1', 'STEYR-50', '[]', '["/p1.jpg"]', 1, 3),
      ('v2', 'p2', 'Weldon 19', '[]', '["/p2.jpg"]', 1, 4),
      ('v3', 'p3', 'BEVEL-15', '[]', '["/p3.jpg"]', 1, 2),
      ('v4', 'p4', 'PIPE-120', '[]', '["/p4.jpg"]', 1, 2),
      ('v5', 'p5', 'UNVERIFIED', '[]', '["/p5.jpg"]', 1, 1);
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
  seedProductKnowledge(db);
  return { dir, db };
}

function seedEvidenceSource(db) {
  const now = Date.now();
  db.prepare(`
    INSERT INTO sources (id, source_type, name, rights_policy, active, created_at, updated_at)
    VALUES ('verified-manuals', 'MANUAL', 'Проверенные паспорта и режимы', 'PUBLISHABLE_FACTS', 1, ?, ?)
  `).run(now, now);
  db.prepare(`
    INSERT INTO import_runs (
      id, source_id, started_at, completed_at, status, input_checksum,
      record_count, rejected_count, parser_version, schema_version
    ) VALUES ('tools-fixture-run', 'verified-manuals', ?, ?, 'SUCCEEDED',
      'tools-fixture', 100, 0, 'fixture', 'fixture')
  `).run(now, now);
}

function sourceFact(db, { id, subjectType, subjectId, predicate, value, unit }) {
  const now = Date.now();
  const number = typeof value === "number";
  const object = value !== null && typeof value === "object";
  db.prepare(`
    INSERT INTO source_facts (
      id, source_id, import_run_id, subject_type, subject_id, predicate,
      value_text, value_number, unit, value_json, observed_at, checksum, status
    ) VALUES (?, 'verified-manuals', 'tools-fixture-run', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'VALID')
  `).run(id, subjectType, subjectId, predicate, number || object ? null : String(value),
    number ? value : null, unit ?? null, object ? JSON.stringify(value) : null, now, `checksum-${id}`);
}

function verifiedAssertion(db, { id, subjectType = "PRODUCT", subjectId, predicate, value, unit }) {
  const factId = `fact-${id}`;
  sourceFact(db, { id: factId, subjectType, subjectId, predicate, value, unit });
  return createFactAssertion(db, {
    id, subjectType, subjectId, predicate, value, unit,
    verificationStatus: "VERIFIED", verifiedBy: "technical-reviewer@example.test",
    evidenceSourceFactIds: [factId],
  });
}

function feature(db, { productId, key, value, unit, id = `${productId}-${key}` }) {
  const assertionId = verifiedAssertion(db, { id: `assert-${id}`, subjectId: productId, predicate: `FEATURE_${id}`, value, unit });
  addVerifiedProductFeature(db, { id: `feature-${id}`, productId, featureKey: key, assertionId });
  return assertionId;
}

function application(db, { productId, value, id }) {
  const assertionId = verifiedAssertion(db, { id: `assert-${id}`, subjectId: productId, predicate: "SUPPORTS", value });
  addVerifiedProductApplication(db, { id: `application-${id}`, productId, applicationKey: value, suitability: "SUPPORTED", assertionId });
}

function seedProductKnowledge(db) {
  feature(db, { productId: "p1", key: "max_diameter", value: 50, unit: "mm" });
  feature(db, { productId: "p1", key: "max_depth", value: 75, unit: "mm" });
  feature(db, { productId: "p1", key: "materials", value: ["Сталь", "Нержавеющая сталь"] });
  feature(db, { productId: "p1", key: "thread_requirement", value: ["M3–M16"] });
  feature(db, { productId: "p1", key: "weight", value: 13, unit: "kg" });
  feature(db, { productId: "p1", key: "shank", value: ["Weldon 19"] });
  application(db, { productId: "p1", value: "Сверление стали", id: "p1-application" });

  feature(db, { productId: "p3", key: "workpiece_type", value: ["Плита"] });
  feature(db, { productId: "p3", key: "max_thickness", value: 15, unit: "mm" });
  feature(db, { productId: "p3", key: "angle_min", value: 30, unit: "deg" });
  feature(db, { productId: "p3", key: "angle_max", value: 60, unit: "deg" });
  feature(db, { productId: "p3", key: "max_bevel_width", value: 12, unit: "mm" });
  feature(db, { productId: "p3", key: "materials", value: ["Сталь"] });

  feature(db, { productId: "p4", key: "max_pipe_diameter", value: 120, unit: "mm" });
  feature(db, { productId: "p4", key: "max_wall_thickness", value: 8, unit: "mm" });
  feature(db, { productId: "p4", key: "materials", value: ["Сталь"] });
  application(db, { productId: "p4", value: "Монтаж трубопровода", id: "p4-application" });

  const now = Date.now();
  const factId = "fact-unverified-diameter";
  sourceFact(db, { id: factId, subjectType: "PRODUCT", subjectId: "p5", predicate: "UNVERIFIED_DIAMETER", value: 100, unit: "mm" });
  const assertionId = createFactAssertion(db, {
    id: "assert-unverified-diameter", subjectType: "PRODUCT", subjectId: "p5",
    predicate: "UNVERIFIED_DIAMETER", value: 100, unit: "mm",
    verificationStatus: "SOURCED", evidenceSourceFactIds: [factId],
  });
  db.prepare(`
    INSERT INTO product_features (
      id, product_id, feature_key, value_number, unit, assertion_id, status, created_at, updated_at
    ) VALUES ('feature-unverified-diameter', 'p5', 'max_diameter', 100, 'mm', ?, 'ACTIVE', ?, ?)
  `).run(assertionId, now, now);

  const compatibilityAssertion = verifiedAssertion(db, {
    id: "assert-p1-p2-compatible", subjectId: "p1", predicate: "COMPATIBLE_WITH", value: "p2",
  });
  setVerifiedCompatibility(db, {
    id: "compatibility-p1-p2", productAId: "p1", productBId: "p2",
    compatibilityType: "оснастка Weldon 19", compatibilityStatus: "COMPATIBLE",
    assertionId: compatibilityAssertion,
  });
  const directionAssertion = verifiedAssertion(db, {
    id: "assert-p1-uses-p2", subjectId: "p1", predicate: "USES_ACCESSORY", value: "p2",
  });
  addKnowledgeRelation(db, {
    id: "relation-p1-uses-p2", subjectType: "PRODUCT", subjectId: "p1",
    predicate: "USES_ACCESSORY", objectType: "PRODUCT", objectId: "p2",
    assertionId: directionAssertion,
  });
}

function rpmRule(db) {
  const subjectId = "annular-cutter-rpm:hss:сталь";
  const assertionId = verifiedAssertion(db, {
    id: "assert-rpm-hss-steel", subjectType: "TOOL_RULE", subjectId,
    predicate: "CUTTING_SPEED_M_PER_MIN", value: 25, unit: "m/min",
  });
  return { cutterType: "HSS", material: "Сталь", cuttingSpeed: 25, assertionId };
}

function publishTool(db, input) {
  const draft = createInteractiveToolDraft(db, { ...input, ...ai }).set;
  approveInteractiveTool(db, { setId: draft.id, ...human });
  return publishInteractiveTool(db, { setId: draft.id, ...human });
}

test("RPM calculator uses only a reviewed cutting-speed rule and human publication", () => {
  const { dir, db } = fixtureDb();
  try {
    const rule = rpmRule(db);
    const draft = createInteractiveToolDraft(db, {
      toolType: "ANNULAR_CUTTER_RPM", rules: [rule], indexStatus: "NOINDEX", ...ai,
    }).set;
    assert.throws(() => approveInteractiveTool(db, { setId: draft.id, ...ai }), /HUMAN/);
    approveInteractiveTool(db, { setId: draft.id, ...human, notes: "Rule checked against the reviewed source" });
    publishInteractiveTool(db, { setId: draft.id, ...human });
    const published = getPublicInteractiveTool(db, "annular-cutter-rpm");
    assert.ok(published);
    assert.deepEqual(calculateAnnularCutterRpm(published, { cutterType: "HSS", material: "Сталь", diameter: 35 }), {
      rpm: 227, diameter: 35, cutterType: "HSS", material: "Сталь", cuttingSpeed: 25,
      assertionId: "assert-rpm-hss-steel",
    });
    assert.equal(calculateAnnularCutterRpm(published, { cutterType: "HSS", material: "Чугун", diameter: 35 }), null);
    assert.throws(() => db.prepare("UPDATE interactive_tool_rules SET output_value = 80 WHERE tool_set_id = ?").run(draft.id), /immutable/);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM interactive_tool_reviews WHERE tool_set_id = ?").get(draft.id).count, 2);

    db.prepare("UPDATE sources SET rights_policy = 'RESEARCH_ONLY', updated_at = ? WHERE id = 'verified-manuals'").run(Date.now());
    assert.equal(getPublicInteractiveTool(db, "annular-cutter-rpm"), null);
    assert.deepEqual(markStaleInteractiveTools(db, { ...system }), { checked: 1, staleSetIds: [draft.id] });
    assert.equal(db.prepare("SELECT status FROM interactive_tool_sets WHERE id = ?").get(draft.id).status, "STALE");
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("selectors match only public products with complete current VERIFIED facts", () => {
  const { dir, db } = fixtureDb();
  try {
    publishTool(db, { toolType: "MAGNETIC_DRILL_SELECTOR", indexStatus: "NOINDEX" });
    publishTool(db, { toolType: "BEVELER_SELECTOR", indexStatus: "NOINDEX" });
    publishTool(db, { toolType: "PIPE_CUTTER_SELECTOR", indexStatus: "NOINDEX" });

    assert.deepEqual(selectVerifiedProducts(db, "MAGNETIC_DRILL_SELECTOR", {
      diameter: 40, depth: 60, material: "Сталь", threadRequirement: "M3–M16", weightLimit: 15,
    }).map((product) => product.id), ["p1"]);
    assert.deepEqual(selectVerifiedProducts(db, "MAGNETIC_DRILL_SELECTOR", { diameter: 60 }).map((product) => product.id), []);
    assert.equal(selectVerifiedProducts(db, "MAGNETIC_DRILL_SELECTOR", { diameter: 40 }).some((product) => product.id === "p5"), false);
    assert.deepEqual(selectVerifiedProducts(db, "BEVELER_SELECTOR", {
      workpiece: "Плита", thickness: 10, angle: 45, bevelWidth: 10, material: "Сталь",
    }).map((product) => product.id), ["p3"]);
    assert.deepEqual(selectVerifiedProducts(db, "PIPE_CUTTER_SELECTOR", {
      diameter: 100, wallThickness: 6, material: "Сталь", application: "Монтаж трубопровода",
    }).map((product) => product.id), ["p4"]);
    assert.equal(getPublicInteractiveTool(db, "magnetic-drill-selector").products.some((product) => product.id === "p3"), false);
    assert.throws(() => createInteractiveToolDraft(db, {
      toolType: "MAGNETIC_DRILL_SELECTOR", indexStatus: "INDEX", ...ai,
    }), /reviewed content opportunity/);
    assert.throws(() => createInteractiveToolDraft(db, {
      toolType: "BEVELER_SELECTOR", rules: [{ invented: true }], ...ai,
    }), /do not accept manual rules/);
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("compatibility table exposes only verified COMPATIBLE relations and verified columns", () => {
  const { dir, db } = fixtureDb();
  try {
    publishTool(db, { toolType: "COMPATIBILITY_TABLE", indexStatus: "NOINDEX" });
    const tool = getPublicInteractiveTool(db, "compatibility-table");
    assert.ok(tool);
    assert.equal(tool.rows.length, 1);
    assert.deepEqual(tool.rows[0], {
      id: "compatibility-p1-p2",
      product: { id: "p1", slug: "lenz-steyr-50", title: "Магнитный станок LENZ STEYR-50" },
      accessory: { id: "p2", slug: "koronka-weldon-19", title: "Корончатое сверло Weldon 19" },
      compatibilityType: "оснастка Weldon 19",
      shank: "Weldon 19",
      maxDiameter: "50 mm",
      depth: "75 mm",
      application: "Сверление стали",
      assertionId: "assert-p1-p2-compatible",
      directionAssertionId: "assert-p1-uses-p2",
    });
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("migration 010 indexes match public/rule queries and rolls back cleanly", () => {
  const { dir, db } = fixtureDb();
  try {
    db.pragma("optimize");
    const publicPlan = db.prepare(`
      EXPLAIN QUERY PLAN SELECT id FROM interactive_tool_sets
      WHERE slug = 'annular-cutter-rpm' AND status = 'PUBLISHED' ORDER BY version DESC LIMIT 1
    `).all().map((row) => row.detail).join("\n");
    const rulePlan = db.prepare(`
      EXPLAIN QUERY PLAN SELECT id FROM interactive_tool_rules
      WHERE tool_set_id = 'fixture' ORDER BY cutter_type, material, sort_order
    `).all().map((row) => row.detail).join("\n");
    assert.match(publicPlan, /idx_interactive_tools_one_published_slug/);
    assert.match(rulePlan, /idx_interactive_tool_rules_set/);
    for (const filename of ["012_lead_generation.sql", "011_semantic_internal_linking.sql", "010_interactive_tools.sql"]) {
      const migrationSql = fs.readFileSync(path.resolve(import.meta.dirname, "..", "scripts", "migrations", filename), "utf8");
      const downSql = migrationSql.slice(migrationSql.indexOf("-- migrate:down") + "-- migrate:down".length);
      db.exec(downSql);
    }
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sqlite_schema WHERE name = 'interactive_tool_sets'").get().count, 0);
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
