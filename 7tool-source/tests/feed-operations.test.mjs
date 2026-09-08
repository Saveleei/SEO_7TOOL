import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import Database from "better-sqlite3";

const root = process.cwd();

function runScript(script, env) {
  return spawnSync(process.execPath, [path.join(root, script)], {
    cwd: root,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
}

test("защита настроек категорий останавливает обновление при расхождении DB и JSON", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "7tool-category-guard-"));
  try {
    const dbPath = path.join(directory, "data.db");
    const jsonPath = path.join(directory, "products.json");
    const database = new Database(dbPath);
    database.exec(`
      CREATE TABLE categories (
        slug TEXT PRIMARY KEY, title TEXT, icon TEXT, sort_order INTEGER,
        subtitle TEXT, cta_text TEXT, cover_image TEXT, meta_title TEXT,
        meta_description TEXT, image_alt TEXT, h1 TEXT, intro TEXT,
        seo_text TEXT, published INTEGER
      )
    `);
    database.prepare(`
      INSERT INTO categories (
        slug, title, icon, sort_order, subtitle, cta_text, cover_image,
        meta_title, meta_description, image_alt, h1, intro, seo_text, published
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run("test", "Категория", "wrench", 3, null, "Подобрать", "/cover.webp", "Meta", "Description", "Alt", "H1", "Intro", "SEO", 1);
    database.close();

    const category = {
      slug: "test", title: "Категория", icon: "wrench", sortOrder: 3,
      subtitle: null, ctaText: "Подобрать", coverImage: "/cover.webp",
      metaTitle: "Meta", metaDescription: "Description", imageAlt: "Alt",
      h1: "H1", intro: "Intro", seoText: "SEO", published: true,
    };
    fs.writeFileSync(jsonPath, JSON.stringify({ categories: [category] }), "utf8");

    const matching = runScript("scripts/verify-category-settings.mjs", {
      SQLITE_PATH: dbPath,
      CATALOG_JSON_PATH: jsonPath,
    });
    assert.equal(matching.status, 0, matching.stderr || matching.stdout);
    assert.equal(JSON.parse(matching.stdout).ok, true);

    fs.writeFileSync(jsonPath, JSON.stringify({ categories: [{ ...category, title: "Изменено" }] }), "utf8");
    const mismatching = runScript("scripts/verify-category-settings.mjs", {
      SQLITE_PATH: dbPath,
      CATALOG_JSON_PATH: jsonPath,
    });
    assert.equal(mismatching.status, 1);
    assert.match(mismatching.stderr, /CATEGORY_SETTINGS_MISMATCH/);
    assert.deepEqual(JSON.parse(mismatching.stdout).differences, [
      { slug: "test", issue: "field_mismatch", fields: ["title"] },
    ]);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("контроль фида подтверждает свежий источник, XML и отчёт", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "7tool-feed-health-"));
  try {
    const now = new Date().toISOString();
    const statePath = path.join(directory, "state.json");
    const reportPath = path.join(directory, "report.json");
    const feedPath = path.join(directory, "feed.xml");
    fs.writeFileSync(statePath, JSON.stringify({
      ok: true,
      completedAt: now,
      sourceType: "remote",
      sourceUpdatedAt: now,
    }), "utf8");
    fs.writeFileSync(reportPath, JSON.stringify({ generatedAt: now, offers: 2 }), "utf8");
    fs.writeFileSync(feedPath, '<?xml version="1.0"?><yml_catalog><shop><offers><offer id="1"/><offer id="2"/></offers></shop></yml_catalog>', "utf8");

    const healthy = runScript("scripts/check-feed-health.mjs", {
      FEED_STATE_PATH: statePath,
      ADVERTISING_FEED_REPORT_PATH: reportPath,
      ADVERTISING_FEED_PATH: feedPath,
      AD_FEED_MIN_OFFERS: "2",
      FEED_HEALTH_REMOTE_CHECK: "0",
    });
    assert.equal(healthy.status, 0, healthy.stderr || healthy.stdout);
    assert.equal(JSON.parse(healthy.stdout).sourceType, "remote");

    const stale = new Date(Date.now() - 8 * 3_600_000).toISOString();
    fs.writeFileSync(statePath, JSON.stringify({
      ok: true,
      completedAt: now,
      sourceType: "fallback-local",
      sourceUpdatedAt: stale,
    }), "utf8");
    const unhealthy = runScript("scripts/check-feed-health.mjs", {
      FEED_STATE_PATH: statePath,
      ADVERTISING_FEED_REPORT_PATH: reportPath,
      ADVERTISING_FEED_PATH: feedPath,
      AD_FEED_MIN_OFFERS: "2",
      FEED_HEALTH_MAX_AGE_HOURS: "3",
      FEED_HEALTH_REMOTE_CHECK: "0",
    });
    assert.equal(unhealthy.status, 1);
    assert.match(unhealthy.stderr, /FEED_SOURCE_STALE/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("оба cron-контура ставят защитные проверки до публикации файлов", () => {
  for (const script of ["scripts/hourly-refresh.sh", "scripts/nightly-rebuild.sh"]) {
    const source = fs.readFileSync(path.join(root, script), "utf8");
    const firstGuard = source.indexOf("node scripts/verify-category-settings.mjs");
    const refresh = source.indexOf("node scripts/refresh-feed.mts");
    const secondGuard = source.indexOf("node scripts/verify-category-settings.mjs", firstGuard + 1);
    const health = source.indexOf("node scripts/check-feed-health.mjs");
    const copy = source.indexOf("cp src/lib/products.json");
    assert.ok(firstGuard >= 0 && firstGuard < refresh, `${script}: no pre-refresh settings guard`);
    assert.ok(secondGuard > refresh && secondGuard < health, `${script}: no post-refresh settings guard`);
    assert.ok(health > secondGuard && health < copy, `${script}: health check must precede publish copy`);
  }
});

test("резервный фид ограничен по возрасту и успешная загрузка кэшируется атомарно", () => {
  const source = fs.readFileSync(path.join(root, "scripts", "refresh-feed.mts"), "utf8");
  assert.match(source, /FEED_FALLBACK_MAX_AGE_HOURS/);
  assert.match(source, /assertFallbackFresh\(LOCAL_FEED\)/);
  assert.match(source, /cacheValidatedFeed\(xml\)/);
  assert.match(source, /fs\.renameSync\(tmpPath, target\)/);
  assert.match(source, /sourceUpdatedAt/);
});
