import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { finalizeCatalogSnapshot } from "../scripts/finalize-catalog-snapshot.mjs";
import { loadSupplierFeed } from "../scripts/lib/feed-source.mjs";

test("remote feed failure preserves last known good data instead of silently using a stale file", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "7tool-feed-source-"));
  const fallback = path.join(directory, "dealer.xml");
  await writeFile(fallback, "<feed>stale</feed>", "utf8");
  let calls = 0;
  try {
    await assert.rejects(() => loadSupplierFeed({
      feedUrl:"https://supplier.example/feed.xml",
      localFeed:fallback,
      attempts:2,
      wait:async () => {},
      fetchImpl:async () => {
        calls += 1;
        throw new Error("network unavailable");
      },
    }), /последний корректный снимок сохранён/u);
    assert.equal(calls, 2);
  } finally {
    await rm(directory, { recursive:true, force:true });
  }
});
test("local feed use is explicit and the emergency fallback is opt-in", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "7tool-feed-local-"));
  const localFeed = path.join(directory, "dealer.xml");
  await writeFile(localFeed, "<feed>local</feed>", "utf8");
  try {
    const explicit = await loadSupplierFeed({ localFeed, explicitLocalFile:true });
    assert.equal(explicit.source, "local-explicit");
    const fallback = await loadSupplierFeed({
      feedUrl:"https://supplier.example/feed.xml",
      localFeed,
      allowLocalFallback:true,
      attempts:1,
      fetchImpl:async () => { throw new Error("offline"); },
    });
    assert.equal(fallback.source, "local-fallback");
  } finally {
    await rm(directory, { recursive:true, force:true });
  }
});

test("catalog finalization publishes data before matching completion metadata", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "7tool-feed-finalize-"));
  const catalogPath = path.join(directory, "products.json");
  const metadataPath = path.join(directory, "catalog-snapshot-meta.json");
  const publishDir = path.join(directory, "published");
  const catalogSource = JSON.stringify({ categories:[{ slug:"tools" }], products:[{ id:"p-1" }] });
  await writeFile(catalogPath, catalogSource, "utf8");
  await writeFile(metadataPath, JSON.stringify({ status:"complete", completedAt:"2026-09-25T00:15:00.000Z", sourceId:"supplier" }), "utf8");
  try {
    const result = finalizeCatalogSnapshot({ catalogPath, metadataPath, publishDir });
    const publishedCatalog = await readFile(path.join(publishDir, "products.json"), "utf8");
    const publishedMetadata = JSON.parse(await readFile(path.join(publishDir, "catalog-snapshot-meta.json"), "utf8"));
    assert.equal(publishedCatalog, catalogSource);
    assert.equal(publishedMetadata.catalogSha256, createHash("sha256").update(catalogSource).digest("hex"));
    assert.equal(result.catalogSha256, publishedMetadata.catalogSha256);
    assert.equal(publishedMetadata.completedAt, "2026-09-25T00:15:00.000Z");
  } finally {
    await rm(directory, { recursive:true, force:true });
  }
});

test("scheduler scripts are Linux-safe and nightly refresh publishes freshness metadata", async () => {
  const [attributes, hourly, nightly, storefront, stalexPilot, queue] = await Promise.all([
    readFile(new URL("../../.gitattributes", import.meta.url), "utf8"),
    readFile(new URL("../scripts/hourly-refresh.sh", import.meta.url)),
    readFile(new URL("../scripts/nightly-rebuild.sh", import.meta.url)),
    readFile(new URL("../scripts/storefront-snapshot-refresh.sh", import.meta.url)),
    readFile(new URL("../scripts/stalex-test-catalog-refresh.sh", import.meta.url)),
    readFile(new URL("../scripts/process-production-queues.sh", import.meta.url)),
  ]);
  assert.match(attributes, /\*\.sh text eol=lf/u);
  for (const source of [hourly, nightly, storefront, stalexPilot, queue]) assert.equal(source.includes(13), false, "shell scripts must not contain CRLF bytes");
  const nightlyText = nightly.toString("utf8");
  assert.match(nightlyText, /node scripts\/refresh-feed\.mts/u);
  assert.match(nightlyText, /node scripts\/finalize-catalog-snapshot\.mjs/u);
  assert.ok(nightlyText.indexOf("refresh-feed.mts") < nightlyText.indexOf("finalize-catalog-snapshot.mjs"));
  assert.ok(nightlyText.indexOf("finalize-catalog-snapshot.mjs") < nightlyText.indexOf("npm run build"));
  const storefrontText = storefront.toString("utf8");
  assert.match(storefrontText, /CATALOG_WORK_DIR=\$\{CATALOG_WORK_DIR:\?/u);
  assert.match(storefrontText, /STOREFRONT_BUILD_DIR=\$\{STOREFRONT_BUILD_DIR:-\}/u);
  assert.match(storefrontText, /npm run db:backup/u);
  assert.match(storefrontText, /REQUESTED_PM2_APP_NAME/u);
  assert.match(storefrontText, /Refusing to reload a non-test PM2 process/u);
  assert.ok(storefrontText.indexOf("refresh-feed.mts") < storefrontText.indexOf("finalize-catalog-snapshot.mjs"));
  assert.ok(storefrontText.indexOf("finalize-catalog-snapshot.mjs") < storefrontText.indexOf('if [ -n "$STOREFRONT_BUILD_DIR" ]'));
  assert.ok(storefrontText.indexOf("npm run build") < storefrontText.indexOf('pm2 reload "$PM2_APP_NAME"'));
  assert.ok(storefrontText.indexOf("finalize-catalog-snapshot.mjs") < storefrontText.indexOf("pm2 reload"));
  assert.doesNotMatch(storefrontText, /pm2 reload .*--update-env/u);
  const stalexPilotText = stalexPilot.toString("utf8");
  assert.match(stalexPilotText, /node scripts\/refresh-stalex-feed\.mjs/u);
  assert.match(stalexPilotText, /node scripts\/build-stalex-test-catalog\.mjs/u);
  assert.match(stalexPilotText, /node scripts\/validate-stalex-test-catalog-candidate\.mjs/u);
  assert.ok(stalexPilotText.indexOf("refresh-stalex-feed.mjs") < stalexPilotText.indexOf("build-stalex-test-catalog.mjs"));
  assert.ok(stalexPilotText.indexOf("build-stalex-test-catalog.mjs") < stalexPilotText.indexOf("validate-stalex-test-catalog-candidate.mjs"));
  assert.ok(stalexPilotText.indexOf("validate-stalex-test-catalog-candidate.mjs") < stalexPilotText.indexOf('pm2 reload "$PM2_APP_NAME"'));
  assert.doesNotMatch(stalexPilotText, /npm run build/u);
  assert.match(stalexPilotText, /REQUESTED_PM2_APP_NAME/u);
  assert.match(stalexPilotText, /Refusing to reload a non-test PM2 process/u);
  assert.match(stalexPilotText, /PILOT_PUBLISH_DIR\/products\.json/u);
  assert.doesNotMatch(stalexPilotText, /7tool-prod/u);
});

test("supplier category for compact TVN pipe cutters stays in pipe beveling equipment", async () => {
  const source = await readFile(new URL("../scripts/refresh-feed.mts", import.meta.url), "utf8");
  assert.match(source, /"11":\s*"kromkorezy-dlya-trub"/u);
});
