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
  listVerifiedCompatibility,
  listVerifiedRelations,
  setVerifiedCompatibility,
} from "../src/lib/knowledge-graph.mjs";

function migratedFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "7tool-graph-"));
  const dbPath = path.join(dir, "data.db");
  const backupPath = path.join(dir, "backup.db");
  const seed = new Database(dbPath);
  seed.exec(`
    CREATE TABLE categories (slug TEXT PRIMARY KEY);
    CREATE TABLE products (id TEXT PRIMARY KEY);
    CREATE TABLE variants (id TEXT PRIMARY KEY, product_id TEXT REFERENCES products(id));
    INSERT INTO categories VALUES ('drills');
    INSERT INTO products VALUES ('p1'), ('p2');
    INSERT INTO variants VALUES ('v1', 'p1');
  `);
  seed.close();
  fs.copyFileSync(dbPath, backupPath);
  const migration = spawnSync(process.execPath, ["scripts/migrate-seo.mjs", "--apply", `--backup=${backupPath}`], {
    cwd: path.resolve(import.meta.dirname, ".."), env: { ...process.env, SQLITE_PATH: dbPath }, encoding: "utf8",
  });
  assert.equal(migration.status, 0, migration.stderr || migration.stdout);
  return { dir, db: new Database(dbPath) };
}

function seedEvidence(db, { sourceId = "manual", rights = "PUBLISHABLE_FACTS", factId, subjectId, predicate, value }) {
  const now = Date.now();
  db.prepare(`INSERT OR IGNORE INTO sources
    (id, source_type, name, rights_policy, active, created_at, updated_at)
    VALUES (?, 'MANUAL', ?, ?, 1, ?, ?)`
  ).run(sourceId, sourceId, rights, now, now);
  const runId = `run-${factId}`;
  db.prepare(`INSERT INTO import_runs
    (id, source_id, started_at, completed_at, status, input_checksum, record_count, parser_version, schema_version)
    VALUES (?, ?, ?, ?, 'SUCCEEDED', ?, 1, 'fixture', 'fixture')`
  ).run(runId, sourceId, now, now, factId);
  db.prepare(`INSERT INTO source_facts
    (id, source_id, import_run_id, subject_type, subject_id, predicate, value_text, observed_at, checksum, status)
    VALUES (?, ?, ?, 'PRODUCT', ?, ?, ?, ?, ?, 'VALID')`
  ).run(factId, sourceId, runId, subjectId, predicate, value, now, factId);
}

test("only evidence-backed verified assertions enter the public graph", () => {
  const { dir, db } = migratedFixture();
  try {
    seedEvidence(db, { factId: "f-compatible", subjectId: "p1", predicate: "COMPATIBLE_WITH", value: "p2" });
    const assertionId = createFactAssertion(db, {
      subjectType: "PRODUCT", subjectId: "p1", predicate: "COMPATIBLE_WITH", value: "p2",
      verificationStatus: "VERIFIED", verifiedBy: "real-reviewer", evidenceSourceFactIds: ["f-compatible"],
    });
    addKnowledgeRelation(db, {
      subjectType: "PRODUCT", subjectId: "p1", predicate: "COMPATIBLE_WITH",
      objectType: "PRODUCT", objectId: "p2", assertionId,
    });
    assert.equal(listVerifiedRelations(db, "PRODUCT", "p1").length, 1);

    const sourcedId = createFactAssertion(db, {
      subjectType: "PRODUCT", subjectId: "p1", predicate: "USES", value: "coolant",
      verificationStatus: "SOURCED", evidenceSourceFactIds: ["f-compatible"],
    });
    assert.throws(() => addKnowledgeRelation(db, {
      subjectType: "PRODUCT", subjectId: "p1", predicate: "USES",
      objectType: "MATERIAL", objectId: "coolant", assertionId: sourcedId,
    }), /not VERIFIED/);
  } finally {
    db.close(); fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("compatibility pairs are normalized and unknown/self relations are blocked", () => {
  const { dir, db } = migratedFixture();
  try {
    seedEvidence(db, { factId: "f-pair", subjectId: "p1", predicate: "COMPATIBLE_WITH", value: "p2" });
    const assertionId = createFactAssertion(db, {
      subjectType: "PRODUCT", subjectId: "p1", predicate: "COMPATIBLE_WITH", value: "p2",
      verificationStatus: "VERIFIED", verifiedBy: "reviewer", evidenceSourceFactIds: ["f-pair"],
    });
    const pair = setVerifiedCompatibility(db, {
      productAId: "p2", productBId: "p1", compatibilityType: "ACCESSORY",
      compatibilityStatus: "COMPATIBLE", assertionId,
    });
    assert.deepEqual(pair, { productAId: "p1", productBId: "p2", compatibilityType: "ACCESSORY" });
    assert.equal(listVerifiedCompatibility(db, "p2").length, 1);
    assert.throws(() => setVerifiedCompatibility(db, {
      productAId: "p1", productBId: "p1", compatibilityType: "ACCESSORY",
      compatibilityStatus: "COMPATIBLE", assertionId,
    }), /different products/);
    assert.throws(() => setVerifiedCompatibility(db, {
      productAId: "p1", productBId: "p2", compatibilityType: "ACCESSORY",
      compatibilityStatus: "UNKNOWN", assertionId,
    }), /cannot be verified/);
  } finally {
    db.close(); fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("source rights gate blocks publishable assertions until approved", () => {
  const { dir, db } = migratedFixture();
  try {
    seedEvidence(db, { sourceId: "supplier", rights: "CONTRACT_REQUIRED", factId: "f-rights", subjectId: "p1", predicate: "HAS_SHANK", value: "Weldon 19" });
    assert.throws(() => createFactAssertion(db, {
      subjectType: "PRODUCT", subjectId: "p1", predicate: "HAS_SHANK", value: "Weldon 19",
      verificationStatus: "VERIFIED", verifiedBy: "reviewer", evidenceSourceFactIds: ["f-rights"],
    }), /not approved/);
  } finally {
    db.close(); fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("features and applications are projections of verified assertions", () => {
  const { dir, db } = migratedFixture();
  try {
    seedEvidence(db, { factId: "f-depth", subjectId: "p1", predicate: "HAS_DEPTH", value: "50" });
    const depth = createFactAssertion(db, {
      subjectType: "PRODUCT", subjectId: "p1", predicate: "HAS_DEPTH", value: 50, unit: "mm",
      verificationStatus: "VERIFIED", verifiedBy: "reviewer", evidenceSourceFactIds: ["f-depth"],
    });
    addVerifiedProductFeature(db, { productId: "p1", variantId: "v1", featureKey: "drilling_depth", assertionId: depth });
    assert.deepEqual(db.prepare("SELECT value_number, unit FROM product_features").get(), { value_number: 50, unit: "mm" });

    seedEvidence(db, { factId: "f-app", subjectId: "p1", predicate: "SUPPORTS", value: "structural-steel" });
    const application = createFactAssertion(db, {
      subjectType: "PRODUCT", subjectId: "p1", predicate: "SUPPORTS", value: "structural-steel",
      verificationStatus: "VERIFIED", verifiedBy: "reviewer", evidenceSourceFactIds: ["f-app"],
    });
    addVerifiedProductApplication(db, {
      productId: "p1", applicationKey: "structural-steel", suitability: "SUPPORTED", assertionId: application,
    });
    assert.equal(db.prepare("SELECT suitability FROM product_applications").get().suitability, "SUPPORTED");
  } finally {
    db.close(); fs.rmSync(dir, { recursive: true, force: true });
  }
});
