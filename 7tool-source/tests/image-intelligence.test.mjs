import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import Database from "better-sqlite3";
import sharp from "sharp";
import {
  approveMediaRightsGrant,
  approveMediaSelection,
  createMediaSelectionRequests,
  discoverSupplierMediaLibrary,
  processApprovedMedia,
  proposeMediaRightsGrant,
  rankMediaSelection,
  registerAiDiagram,
  revokeMediaRightsGrant,
  suggestContextualAlt,
  validateContextualAlt,
} from "../src/lib/image-intelligence.mjs";

const human = { actorType: "HUMAN", actorId: "media-editor@example.test" };
const ai = { actorType: "AI_ASSISTED", actorId: "media-assistant" };
const system = { actorType: "SYSTEM", actorId: "media-processor-v1" };
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function fixtureDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "7tool-media-"));
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
    INSERT INTO products (id, slug, title, brand, category, images, draft, stock) VALUES (
      'product-steyr-35', 'lenz-steyr-35', 'магнитного станка LENZ STEYR-35', 'LENZ',
      'magnitnye-stanki',
      '["https://cdn.supplier.example/steyr-35.jpg","https://images.unrelated.example/stolen.jpg"]', 0, 5
    );
    INSERT INTO variants (id, product_id, name, params, images, available, quantity) VALUES (
      'variant-weldon-19', 'product-steyr-35', 'STEYR-35 Weldon 19',
      '[{"name":"Шпиндель","value":"Weldon 19"}]',
      '["https://media.supplier.example/steyr-35-weldon-19.jpg"]', 1, 5
    );
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
    INSERT INTO sources (id, source_type, name, base_url, rights_policy, active, created_at, updated_at)
    VALUES (
      'supplier-feed', 'SUPPLIER_FEED', 'Approved supplier feed', 'https://supplier.example',
      'CONTRACT_REQUIRED', 1, ${now}, ${now}
    );
    INSERT INTO sources (id, source_type, name, base_url, rights_policy, active, created_at, updated_at)
    VALUES (
      'marketplace-source', 'MARKETPLACE', 'Marketplace research', 'https://marketplace.example',
      'RESEARCH_ONLY', 1, ${now}, ${now}
    );
    INSERT INTO keyword_clusters (
      id, name, category_slug, centroid_text, cluster_method, model_version, status, created_at, updated_at
    ) VALUES (
      'cluster-media', 'Weldon 19', 'magnitnye-stanki', 'шпиндель weldon 19',
      'HUMAN_REVIEWED', 'test-v1', 'REVIEWED', ${now}, ${now}
    );
    INSERT INTO search_intents (
      id, intent_key, label, intent_class, dominant_serp_type, category_slug, status,
      reviewed_by, reviewed_at, created_at, updated_at
    ) VALUES (
      'intent-media', 'intent-weldon-19', 'Шпиндель Weldon 19', 'SPECIFICATION', 'ARTICLE',
      'magnitnye-stanki', 'REVIEWED', 'semantic-reviewer', ${now}, ${now}, ${now}
    );
    INSERT INTO seo_keywords (
      id, query, normalized_query, source_id, region, language, frequency, exact_frequency,
      category_slug, intent_id, cluster_id, intent_class, cannibalization_risk, status,
      first_seen_at, last_seen_at, created_at, updated_at
    ) VALUES (
      'keyword-media', 'шпиндель weldon 19', 'шпиндель weldon 19', 'supplier-feed',
      'RU-MOW', 'ru', 100, 40, 'magnitnye-stanki', 'intent-media', 'cluster-media',
      'SPECIFICATION', 'LOW', 'REVIEWED', ${now}, ${now}, ${now}, ${now}
    );
    INSERT INTO content_assets (
      id, content_type, slug, status, title, h1, category_slug, primary_keyword_id,
      primary_keyword, intent_id, cluster_id, canonical, index_status,
      differentiation_score, business_score, generated_by_ai, human_reviewed,
      current_brief_id, created_at, updated_at
    ) VALUES (
      'content-media-test', 'ARTICLE', 'weldon-19-guide', 'BRIEF_APPROVED',
      'Шпиндель Weldon 19', 'Шпиндель Weldon 19 для магнитного станка',
      'magnitnye-stanki', 'keyword-media', 'шпиндель weldon 19', 'intent-media',
      'cluster-media', '/articles/weldon-19-guide', 'NOINDEX', 80, 80, 0, 0,
      'brief-media-test', ${now}, ${now}
    );
    INSERT INTO article_briefs (
      id, content_asset_id, version, status, user_intent, problem, audience, short_answer,
      calculator_requirement, cta, brief_checksum, generated_by_ai,
      created_by_actor_type, created_by_actor_id, approved_by, approved_at, created_at, updated_at
    ) VALUES (
      'brief-media-test', 'content-media-test', 1, 'APPROVED', 'Понять совместимость.',
      'Нужно увидеть тип шпинделя.', 'Инженер.', 'Сверьте шпиндель. Проверьте паспорт.',
      'Не требуется.', 'Запросить проверку.', 'brief-media-checksum', 1,
      'AI_ASSISTED', 'brief-assistant', 'brief-editor', ${now}, ${now}, ${now}
    );
    INSERT INTO article_brief_items (
      id, brief_id, item_type, item_text, source_ref, sort_order
    ) VALUES (
      'brief-image-weldon', 'brief-media-test', 'SUPPLIER_IMAGE',
      'Шпиндель Weldon 19', 'supplier-feed:product-steyr-35', 0
    );
    INSERT INTO article_brief_items (
      id, brief_id, item_type, item_text, sort_order
    ) VALUES (
      'brief-diagram-weldon', 'brief-media-test', 'REQUIRED_DIAGRAM',
      'Схема установки корончатого сверла', 0
    );
    INSERT INTO content_products (content_asset_id, product_id, relation_type, sort_order)
    VALUES ('content-media-test', 'product-steyr-35', 'TARGET', 0);
  `);
  return { dir, db };
}

test("Supplier media requires domain proof, reviewed rights, local processing and human semantic selection", async () => {
  const { dir, db } = fixtureDb();
  const previousRoot = process.env.MEDIA_ROOT;
  process.env.MEDIA_ROOT = path.join(dir, "media-store");
  try {
    const discovery = discoverSupplierMediaLibrary(db, { sourceId: "supplier-feed", ...system });
    assert.equal(discovery.discoveredAssetIds.length, 2);
    assert.equal(discovery.rejected.length, 1);
    assert.equal(discovery.rejected[0].reason, "OUTSIDE_SUPPLIER_DOMAIN");
    assert.equal(discovery.downloaded, 0);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM media_assets WHERE origin_host = 'images.unrelated.example'").get().count, 0);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM media_assets WHERE license_status = 'CONTRACT_REQUIRED'").get().count, 2);

    const componentAsset = db.prepare(`
      SELECT a.* FROM media_assets a JOIN media_tags t ON t.media_asset_id = a.id
      WHERE t.tag_type = 'COMPONENT' AND t.normalized_tag LIKE '%weldon 19%' LIMIT 1
    `).get();
    assert.ok(componentAsset);
    assert.match(componentAsset.origin_url, /media\.supplier\.example/);

    const proposal = proposeMediaRightsGrant(db, {
      scopeType: "SOURCE",
      scopeValue: "supplier-feed",
      licenseType: "SUPPLIER_CONTRACT",
      copyrightHolder: "Supplier Example LLC",
      permittedUses: ["WEBSITE", "CONTENT", "DERIVATIVES"],
      attributionRequired: true,
      attributionText: "Supplier Example LLC",
      evidenceRef: "contracts/supplier-example-2026.pdf#media",
      evidenceChecksum: sha256("reviewed supplier media contract fixture"),
      validFrom: Date.now() - 1000,
      ...human,
    });
    assert.equal(proposal.grant.status, "PROPOSED");
    assert.throws(() => approveMediaRightsGrant(db, { grantId: proposal.grant.id, ...ai }), /human actor/);
    approveMediaRightsGrant(db, { grantId: proposal.grant.id, ...human });
    assert.equal(db.prepare("SELECT license_status FROM media_assets WHERE id = ?").get(componentAsset.id).license_status, "CONTRACT_APPROVED");

    const fixtureImage = path.join(dir, "supplier-fixture.png");
    await sharp({ create: { width: 900, height: 600, channels: 3, background: "#d0d5db" } })
      .png()
      .toFile(fixtureImage);
    assert.rejects(() => processApprovedMedia(db, { assetId: componentAsset.id, inputPath: fixtureImage, ...ai }), /human or deterministic system/);
    const processed = await processApprovedMedia(db, { assetId: componentAsset.id, inputPath: fixtureImage, ...system });
    assert.equal(processed.asset.status, "PROCESSED");
    assert.equal(processed.variants.length, 6);
    assert.ok(processed.variants.some((variant) => variant.format === "AVIF"));
    assert.ok(processed.variants.some((variant) => variant.format === "WEBP"));
    assert.throws(() => db.prepare("UPDATE media_variants SET width = width + 1 WHERE media_asset_id = ?").run(componentAsset.id), /immutable/);

    const requests = createMediaSelectionRequests(db, { articleId: "content-media-test", ...ai });
    assert.equal(requests.length, 2);
    const supplierRequest = requests.find((request) => request.brief_item_id === "brief-image-weldon");
    assert.equal(supplierRequest.desired_kind, "PRODUCT_COMPONENT");
    const candidates = rankMediaSelection(db, { requestId: supplierRequest.id, ...ai });
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].media_asset_id, componentAsset.id);
    const alt = suggestContextualAlt(db, { requestId: supplierRequest.id, assetId: componentAsset.id });
    assert.match(alt, /Шпиндель Weldon 19/u);
    assert.match(alt, /LENZ STEYR-35/u);
    assert.throws(() => validateContextualAlt(
      "Weldon 19 Weldon 19 Weldon 19 Weldon 19 для станка",
      { semanticNeed: "Weldon 19" },
    ), /keyword stuffing|repeats/);
    assert.throws(() => approveMediaSelection(db, {
      requestId: supplierRequest.id,
      assetId: componentAsset.id,
      confirmedKind: "PRODUCT_COMPONENT",
      depictionLabel: "Шпиндель Weldon 19",
      ...ai,
    }), /human actor/);
    const placement = approveMediaSelection(db, {
      requestId: supplierRequest.id,
      assetId: componentAsset.id,
      confirmedKind: "PRODUCT_COMPONENT",
      depictionLabel: "Шпиндель Weldon 19",
      sectionHeading: "Совместимость шпинделя",
      caption: "Тип шпинделя проверен редактором по изображению поставщика.",
      ...human,
    });
    assert.equal(placement.status, "APPROVED");
    assert.equal(placement.contextual_alt, alt);
    assert.equal(placement.attribution_text, "Supplier Example LLC");

    revokeMediaRightsGrant(db, {
      grantId: proposal.grant.id,
      reason: "Contract media permission withdrawn in the test fixture",
      ...human,
    });
    assert.equal(db.prepare("SELECT status FROM content_media WHERE id = ?").get(placement.id).status, "REJECTED");
    assert.equal(db.prepare("SELECT status FROM media_assets WHERE id = ?").get(componentAsset.id).status, "RIGHTS_REVIEW");
    assert.equal(db.prepare("PRAGMA foreign_key_check").all().length, 0);
  } finally {
    if (previousRoot === undefined) delete process.env.MEDIA_ROOT;
    else process.env.MEDIA_ROOT = previousRoot;
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("Only Supplier Feed photos and explicitly disclosed AI diagrams enter their respective libraries", () => {
  const { dir, db } = fixtureDb();
  try {
    assert.throws(() => discoverSupplierMediaLibrary(db, { sourceId: "marketplace-source", ...system }), /only an active Supplier Feed/);
    assert.throws(() => registerAiDiagram(db, {
      assetKind: "PRODUCT_PHOTO",
      semanticDescription: "Фотография LENZ STEYR-35",
      disclosureText: "AI-generated",
      promptRef: "private/prompts/photo.txt",
      promptHash: sha256("photo prompt"),
      provider: "fixture-provider",
      model: "fixture-model",
      termsRef: "terms/fixture",
      ...ai,
    }), /limited to diagrams/);
    assert.throws(() => registerAiDiagram(db, {
      assetKind: "DIAGRAM",
      semanticDescription: "Установка корончатого сверла",
      disclosureText: "Технологическая схема",
      promptRef: "private/prompts/diagram.txt",
      promptHash: sha256("diagram prompt"),
      provider: "fixture-provider",
      model: "fixture-model",
      termsRef: "terms/fixture",
      ...ai,
    }), /explicitly identify/);
    const registered = registerAiDiagram(db, {
      assetKind: "DIAGRAM",
      semanticDescription: "Установка корончатого сверла в шпиндель Weldon 19",
      disclosureText: "Схема сгенерирована ИИ и не является фотографией товара",
      categorySlug: "magnitnye-stanki",
      promptRef: "private/prompts/diagram.txt",
      promptHash: sha256("diagram prompt"),
      generationRef: "generation-fixture-1",
      provider: "fixture-provider",
      model: "fixture-model",
      termsRef: "terms/fixture",
      ...ai,
    });
    assert.equal(registered.asset.ai_generated, 1);
    assert.equal(registered.asset.depiction_type, "DIAGRAM");
    assert.equal(registered.asset.real_product_id, null);
    assert.equal(registered.asset.origin_url, null);
    const proposal = proposeMediaRightsGrant(db, {
      scopeType: "ASSET",
      scopeValue: registered.asset.id,
      licenseType: "AI_OUTPUT_TERMS",
      copyrightHolder: "7TOOL under provider output terms",
      permittedUses: ["WEBSITE", "CONTENT", "DERIVATIVES"],
      evidenceRef: "terms/fixture#output-rights",
      evidenceChecksum: sha256("reviewed AI output terms"),
      ...human,
    });
    approveMediaRightsGrant(db, { grantId: proposal.grant.id, ...human });
    assert.equal(db.prepare("SELECT status FROM media_assets WHERE id = ?").get(registered.asset.id).status, "RIGHTS_APPROVED");
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("migration 008 indexes cover media discovery and public placement queries and rolls back cleanly", () => {
  const { dir, db } = fixtureDb();
  try {
    db.pragma("optimize");
    const libraryPlan = db.prepare(`
      EXPLAIN QUERY PLAN SELECT id FROM media_assets
      WHERE source_type = 'SUPPLIER_FEED' AND status = 'PROCESSED' AND category_slug = 'magnitnye-stanki'
      ORDER BY id LIMIT 20
    `).all().map((row) => row.detail).join("\n");
    const publicPlan = db.prepare(`
      EXPLAIN QUERY PLAN SELECT id FROM content_media
      WHERE content_asset_id = 'content-media-test' AND status = 'PUBLISHED'
      ORDER BY sort_order, slot_type
    `).all().map((row) => row.detail).join("\n");
    assert.match(libraryPlan, /idx_media_assets_library/);
    assert.match(publicPlan, /idx_content_media_public/);
    for (const filename of ["010_interactive_tools.sql", "009_product_enrichment.sql", "008_image_intelligence.sql"]) {
      const migrationSql = fs.readFileSync(path.resolve(import.meta.dirname, "..", "scripts", "migrations", filename), "utf8");
      const downSql = migrationSql.slice(migrationSql.indexOf("-- migrate:down") + "-- migrate:down".length);
      db.exec(downSql);
    }
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sqlite_schema WHERE name = 'media_assets'").get().count, 0);
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
