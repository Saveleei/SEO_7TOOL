import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runStalexProductionCatalogBuild } from "../scripts/build-stalex-production-catalog.mjs";
import {
  publishProductionCatalog,
  validateProductionFeedRuntime,
  verifyProductionCatalogCandidate,
  writeProductionFeedStatus,
} from "../scripts/lib/production-feed-runtime.mjs";
import { validateStalexProductionCatalogCandidate } from "../scripts/validate-stalex-production-catalog-candidate.mjs";

function baseCatalog() {
  return {
    categories:[{ slug:"stanki-sverlilnye", title:"Сверлильные станки", count:0, published:true, icon:"drill" }],
    subcategories:[],
    products:[],
  };
}

function stalexSnapshot() {
  return {
    status:"validated",
    publicationEnabled:false,
    refreshedAt:"2026-09-29T00:35:00.000Z",
    summary:{ storefrontPublishable:0 },
    records:[{
      id:"reviewed-1",
      catalogId:"reviewed-1",
      sku:"ST-PROD-1",
      name:"Редукторный сверлильный станок Stalex GB28 Profi",
      active:true,
      priceRub:242250,
      oldPriceRub:null,
      availability:{ quantity:3, canPromiseToday:false },
      warranty:"12 месяцев",
      dataPilotReady:true,
      refreshedAt:"2026-09-29T00:35:00.000Z",
      category:{ chosen:{ id:"stalex-drill", decision:"existing-category", targetSlug:"stanki-sverlilnye" } },
      sourceData:{
        images:["catalog_files/gb28.jpg"],
        description:"Технические характеристики подтверждены фидом.",
        catalogProperties:[{ name:"Макс. диаметр сверления (Ст. 3), мм", code:"MAX_DRILL", value:"28" }],
        modificationProperties:[],
      },
    }],
  };
}

async function createCandidate(directory) {
  const basePath = path.join(directory, "base.json");
  const baseMetadataPath = path.join(directory, "base-meta.json");
  const stalexPath = path.join(directory, "stalex.json");
  const outputPath = path.join(directory, "candidate", "products.json");
  const metadataOutputPath = path.join(directory, "candidate", "catalog-snapshot-meta.json");
  const reportPath = path.join(directory, "candidate", "stalex-report.json");
  const reviewedReportPath = path.join(directory, "reviewed-report.json");
  const baseSource = `${JSON.stringify(baseCatalog(), null, 2)}\n`;
  await writeFile(basePath, baseSource, "utf8");
  await writeFile(baseMetadataPath, JSON.stringify({
    status:"complete",
    completedAt:"2026-09-29T00:25:00.000Z",
    catalogSha256:createHash("sha256").update(baseSource).digest("hex"),
  }), "utf8");
  await writeFile(stalexPath, JSON.stringify(stalexSnapshot()), "utf8");
  const result = runStalexProductionCatalogBuild({
    basePath,
    baseMetadataPath,
    stalexPath,
    outputPath,
    metadataOutputPath,
    reportPath,
  });
  await writeFile(reviewedReportPath, JSON.stringify({ selected:1, productIds:["STALEX-reviewed-1"] }), "utf8");
  return { ...result, outputPath, metadataOutputPath, reportPath, reviewedReportPath };
}

test("production Stalex candidate uses reviewed production scope and exact checksums", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "7tool-production-feed-"));
  try {
    const candidate = await createCandidate(directory);
    const metadata = JSON.parse(await readFile(candidate.metadataOutputPath, "utf8"));
    const catalog = JSON.parse(await readFile(candidate.outputPath, "utf8"));
    const report = JSON.parse(await readFile(candidate.reportPath, "utf8"));
    assert.equal(metadata.sourceId, "production-stalex-catalog");
    assert.equal(metadata.publicationScope, "production");
    assert.equal(report.mode, "production");
    assert.equal(catalog.products[0].publicationScope, "production");
    const verified = validateStalexProductionCatalogCandidate({
      catalogPath:candidate.outputPath,
      metadataPath:candidate.metadataOutputPath,
      reportPath:candidate.reportPath,
      reviewedReportPath:candidate.reviewedReportPath,
    });
    assert.equal(verified.selected, 1);
    await writeFile(candidate.reviewedReportPath, JSON.stringify({ selected:1, productIds:["STALEX-unreviewed"] }), "utf8");
    assert.throws(() => validateStalexProductionCatalogCandidate({
      catalogPath:candidate.outputPath,
      metadataPath:candidate.metadataOutputPath,
      reportPath:candidate.reportPath,
      reviewedReportPath:candidate.reviewedReportPath,
    }), /состав Stalex-каталога изменился/iu);
  } finally {
    await rm(directory, { recursive:true, force:true });
  }
});

test("production catalog publication swaps one immutable pointer only after validation", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "7tool-production-publish-"));
  try {
    const sharedRoot = path.join(directory, "production-shared");
    const candidateRoot = path.join(sharedRoot, "feed-work", "fixture");
    await mkdir(candidateRoot, { recursive:true });
    const candidate = await createCandidate(candidateRoot);
    const releasesDir = path.join(sharedRoot, "catalog-releases");
    const currentLink = path.join(sharedRoot, "catalog-current");
    let published;
    try {
      published = publishProductionCatalog({
        sharedRoot,
        releasesDir,
        currentLink,
        catalogPath:candidate.outputPath,
        metadataPath:candidate.metadataOutputPath,
        reportPath:candidate.reportPath,
        reviewedReportPath:candidate.reviewedReportPath,
        now:new Date("2026-09-29T00:40:00.000Z"),
      });
    } catch (error) {
      if (process.platform === "win32" && error?.code === "EPERM") {
        context.skip("Windows host does not allow test symlinks; Linux server check remains mandatory.");
        return;
      }
      throw error;
    }
    assert.equal(await realpath(currentLink), await realpath(published.generationDir));
    const before = await realpath(currentLink);
    const metadata = JSON.parse(await readFile(candidate.metadataOutputPath, "utf8"));
    await writeFile(candidate.metadataOutputPath, JSON.stringify({ ...metadata, catalogSha256:"0".repeat(64) }), "utf8");
    assert.throws(() => publishProductionCatalog({
      sharedRoot,
      releasesDir,
      currentLink,
      catalogPath:candidate.outputPath,
      metadataPath:candidate.metadataOutputPath,
      reportPath:candidate.reportPath,
      reviewedReportPath:candidate.reviewedReportPath,
      now:new Date("2026-09-29T00:41:00.000Z"),
    }), /SHA-256/u);
    assert.equal(await realpath(currentLink), before);
  } finally {
    await rm(directory, { recursive:true, force:true });
  }
});

test("runtime paths are production-owned and cannot escape into the test contour", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "7tool-production-runtime-"));
  const appDir = path.join(directory, "runtime", "7tool-source");
  const sharedRoot = path.join(directory, "7tool-production-shared");
  const scripts = [
    "backup-data.mjs",
    "refresh-feed.mts",
    "refresh-stalex-feed.mjs",
    "build-stalex-production-catalog.mjs",
    "validate-stalex-production-catalog-candidate.mjs",
    "production-feed-runtime.mjs",
  ];
  try {
    await mkdir(path.join(appDir, "node_modules", "better-sqlite3"), { recursive:true });
    await writeFile(path.join(appDir, "package.json"), JSON.stringify({ name:"runtime" }), "utf8");
    await writeFile(path.join(appDir, "node_modules", "better-sqlite3", "package.json"), JSON.stringify({ name:"better-sqlite3", main:"index.js" }), "utf8");
    await writeFile(path.join(appDir, "node_modules", "better-sqlite3", "index.js"), "module.exports = {};\n", "utf8");
    await mkdir(path.join(appDir, "scripts"), { recursive:true });
    for (const script of scripts) await writeFile(path.join(appDir, "scripts", script), "// fixture\n", "utf8");
    await mkdir(path.join(sharedRoot, "stalex"), { recursive:true });
    await writeFile(path.join(sharedRoot, "stalex", "reviewed-report.json"), JSON.stringify({ selected:0, productIds:[] }), "utf8");
    const result = validateProductionFeedRuntime({
      appDir,
      sharedRoot,
      workDir:path.join(sharedRoot, "feed-work"),
      releasesDir:path.join(sharedRoot, "catalog-releases"),
      currentLink:path.join(sharedRoot, "catalog-current"),
      reviewedReportPath:path.join(sharedRoot, "stalex", "reviewed-report.json"),
      statusPath:path.join(sharedRoot, "refresh-status.json"),
      lockPath:path.join(sharedRoot, "refresh.lock"),
      baseCatalogPath:path.join(sharedRoot, "feed-work", "base", "products.json"),
      baseMetadataPath:path.join(sharedRoot, "feed-work", "base", "catalog-snapshot-meta.json"),
      baseDatabasePath:path.join(sharedRoot, "feed-work", "base", "data.db"),
      stalexStatePath:path.join(sharedRoot, "stalex", "normalized-snapshot.json"),
      stalexStatusPath:path.join(sharedRoot, "stalex", "refresh-status.json"),
      stalexLockPath:path.join(sharedRoot, "stalex", "refresh.lock"),
      backupDir:path.join(sharedRoot, "backups"),
    });
    assert.equal(result.sharedRoot, path.resolve(sharedRoot));
    assert.throws(() => validateProductionFeedRuntime({
      appDir,
      sharedRoot:path.join(directory, "7tool-test-shared"),
      workDir:path.join(directory, "7tool-test-shared", "feed-work"),
      releasesDir:path.join(directory, "7tool-test-shared", "catalog-releases"),
      currentLink:path.join(directory, "7tool-test-shared", "catalog-current"),
      reviewedReportPath:path.join(directory, "7tool-test-shared", "reviewed-report.json"),
      statusPath:path.join(directory, "7tool-test-shared", "refresh-status.json"),
      lockPath:path.join(directory, "7tool-test-shared", "refresh.lock"),
      baseCatalogPath:path.join(directory, "7tool-test-shared", "base", "products.json"),
      baseMetadataPath:path.join(directory, "7tool-test-shared", "base", "meta.json"),
      baseDatabasePath:path.join(directory, "7tool-test-shared", "base", "data.db"),
      stalexStatePath:path.join(directory, "7tool-test-shared", "stalex", "state.json"),
      stalexStatusPath:path.join(directory, "7tool-test-shared", "stalex", "status.json"),
      stalexLockPath:path.join(directory, "7tool-test-shared", "stalex", "lock"),
      backupDir:path.join(directory, "7tool-test-shared", "backups"),
    }), /test-контур/iu);
    assert.throws(() => validateProductionFeedRuntime({
      appDir,
      sharedRoot,
      workDir:path.join(directory, "outside"),
      releasesDir:path.join(sharedRoot, "catalog-releases"),
      currentLink:path.join(sharedRoot, "catalog-current"),
      reviewedReportPath:path.join(sharedRoot, "stalex", "reviewed-report.json"),
      statusPath:path.join(sharedRoot, "refresh-status.json"),
      lockPath:path.join(sharedRoot, "refresh.lock"),
      baseCatalogPath:path.join(sharedRoot, "feed-work", "base", "products.json"),
      baseMetadataPath:path.join(sharedRoot, "feed-work", "base", "catalog-snapshot-meta.json"),
      baseDatabasePath:path.join(sharedRoot, "feed-work", "base", "data.db"),
      stalexStatePath:path.join(sharedRoot, "stalex", "normalized-snapshot.json"),
      stalexStatusPath:path.join(sharedRoot, "stalex", "refresh-status.json"),
      stalexLockPath:path.join(sharedRoot, "stalex", "refresh.lock"),
      backupDir:path.join(sharedRoot, "backups"),
    }), /внутри production shared root/iu);
  } finally {
    await rm(directory, { recursive:true, force:true });
  }
});

test("dry-run status is atomic and candidate freshness fails closed", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "7tool-production-status-"));
  try {
    const candidate = await createCandidate(directory);
    const statusPath = path.join(directory, "refresh-status.json");
    const running = writeProductionFeedStatus({ statusPath, status:"running", stage:"preflight", mode:"dry-run", now:new Date("2026-09-29T00:36:00.000Z") });
    const validated = writeProductionFeedStatus({
      statusPath,
      status:"validated",
      stage:"validated",
      mode:"dry-run",
      catalogSha256:candidate.catalogSha256,
      catalogCompletedAt:"2026-09-29T00:25:00.000Z",
      now:new Date("2026-09-29T00:40:00.000Z"),
    });
    assert.equal(validated.startedAt, running.startedAt);
    assert.deepEqual(JSON.parse(await readFile(statusPath, "utf8")), validated);
    assert.throws(() => verifyProductionCatalogCandidate({
      catalogPath:candidate.outputPath,
      metadataPath:candidate.metadataOutputPath,
      reportPath:candidate.reportPath,
      reviewedReportPath:candidate.reviewedReportPath,
      maxAgeMinutes:60,
      now:new Date("2026-09-29T02:00:00.000Z"),
    }), /устарел/iu);
  } finally {
    await rm(directory, { recursive:true, force:true });
  }
});

test("production runner is dry-run by default and gates publication before one exact reload", async () => {
  const source = await readFile(new URL("../scripts/production-feed-refresh.sh", import.meta.url));
  const text = source.toString("utf8");
  assert.equal(source.includes(13), false, "production feed shell must use LF line endings");
  assert.match(text, /PRODUCTION_FEED_MODE:-dry-run/u);
  assert.match(text, /PRODUCTION_FEED_OFFLINE_INPUTS/u);
  assert.match(text, /flock -n 9/u);
  assert.match(text, /build-stalex-production-catalog\.mjs/u);
  assert.match(text, /validate-stalex-production-catalog-candidate\.mjs/u);
  assert.match(text, /production-feed-runtime\.mjs publish/u);
  assert.match(text, /Refusing to reload an unexpected production PM2 process/u);
  assert.match(text, /REQUESTED_PM2_APP_NAME=\$\{PM2_APP_NAME:-7tool-prod\}/u);
  assert.match(text, /\[ "\$PM2_APP_NAME" != "7tool-prod" \]/u);
  assert.match(text, /pm2 reload "\$PM2_APP_NAME"/u);
  assert.match(text, /PRODUCTION_STOREFRONT_HEALTH_URL must use loopback HTTP/u);
  assert.ok(text.indexOf("validate-stalex-production-catalog-candidate.mjs") < text.indexOf("production-feed-runtime.mjs publish"));
  assert.ok(text.indexOf("production-feed-runtime.mjs publish") < text.indexOf('pm2 reload "$PM2_APP_NAME"'));
  assert.ok(text.indexOf('pm2 reload "$PM2_APP_NAME"') < text.indexOf('curl -fsS -o /dev/null "$PRODUCTION_STOREFRONT_HEALTH_URL"'));
  assert.doesNotMatch(text, /7tool-test-shared|7tool-storefront-test/u);
  assert.doesNotMatch(text, /npm run build/u);
});

test("production Stalex CLIs run through the stable runtime symlink", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "7tool-production-cli-link-"));
  const linkedRoot = path.join(directory, "runtime-current");
  try {
    fs.symlinkSync(process.cwd(), linkedRoot, process.platform === "win32" ? "junction" : "dir");
    for (const script of ["build-stalex-production-catalog.mjs", "validate-stalex-production-catalog-candidate.mjs"]) {
      const result = spawnSync(process.execPath, [path.join(linkedRoot, "scripts", script), "--help"], { encoding:"utf8" });
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /Usage:/u);
    }
  } finally {
    fs.rmSync(directory, { force:true, recursive:true });
  }
});
