import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import Database from "better-sqlite3";
import { parseSupplierFeed } from "../scripts/lib/supplier-feed-parser.mjs";
import { offerFacts, recordFeedObservation, safeSourceLabel } from "../scripts/lib/feed-provenance.mjs";

const fixture = `<?xml version="1.0"?>
<yml_catalog><shop><offers>
  <offer id="A-1" available="true" group="false">
    <status>Опубликовано</status><name><![CDATA[Станок &amp; тест]]></name>
    <categoryId>54</categoryId><vendorCode>SKU-1</vendorCode><vendor>LENZ</vendor>
    <barcode>4670000000001</barcode><price>47999.40</price><quantity>3</quantity>
    <param name="k2.Мощность" unit="Вт">1100</param>
    <picture>https://cdn.example.test/a.jpg</picture><picture>javascript:bad</picture>
    <accessory>ACC-1</accessory>
  </offer>
</offers></shop></yml_catalog>`;

test("supplier parser extracts typed facts and rejects non-http images", () => {
  const [offer] = parseSupplierFeed(fixture);
  assert.equal(offer.id, "A-1");
  assert.equal(offer.name, "Станок & тест");
  assert.equal(offer.price, 47999);
  assert.equal(offer.quantity, 3);
  assert.deepEqual(offer.params, [{ name: "Мощность", value: "1100", unit: "Вт" }]);
  assert.deepEqual(offer.pictures, ["https://cdn.example.test/a.jpg"]);
  assert.ok(offerFacts(offer).some(([predicate]) => predicate === "parameters"));
});

test("feed URL logging strips path, query and credentials", () => {
  assert.equal(safeSourceLabel("https://user:pass@example.test/private/token?q=secret"), "https://example.test");
});

test("migration requires a backup and provenance writes immutable observations", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "7tool-feed-"));
  try {
    const dbPath = path.join(temp, "data.db");
    const backupPath = path.join(temp, "backup.db");
    new Database(dbPath).close();
    fs.copyFileSync(dbPath, backupPath);
    const migration = spawnSync(process.execPath, ["scripts/migrate-seo.mjs", "--apply", `--backup=${backupPath}`], {
      cwd: path.resolve(import.meta.dirname, ".."),
      env: { ...process.env, SQLITE_PATH: dbPath }, encoding: "utf8",
    });
    assert.equal(migration.status, 0, migration.stderr || migration.stdout);

    const db = new Database(dbPath);
    const offers = parseSupplierFeed(fixture);
    const result = recordFeedObservation(db, {
      sourceId: "fixture", sourceName: "Fixture", sourceUrl: "https://example.test/secret",
      xml: fixture, offers,
    });
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM import_runs").get().n, 1);
    assert.equal(db.prepare("SELECT base_url FROM sources WHERE id = 'fixture'").get().base_url, "https://example.test");
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM source_facts WHERE import_run_id = ?").get(result.runId).n, result.factCount);
    assert.ok(result.factCount >= 10);
    db.close();
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
