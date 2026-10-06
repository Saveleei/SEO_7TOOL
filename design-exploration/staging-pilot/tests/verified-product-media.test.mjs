import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import feedSnapshotJson from "../../../7tool-source/src/lib/products.json" with { type:"json" };
import { classifyMissingProductMedia } from "../app/data/catalogMediaRecovery.mjs";
import { getCatalogQualityReport } from "../app/data/catalogQuality.ts";
import { getPublishedFeedCatalogSnapshot } from "../app/data/feedCatalog.ts";
import { applyVerifiedProductMedia, verifiedProductMedia } from "../app/data/verifiedProductMedia.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("verified media is bound to exact feed identities and local immutable assets", async () => {
  assert.equal(verifiedProductMedia.length, 21);
  assert.equal(new Set(verifiedProductMedia.map((entry) => entry.id)).size, verifiedProductMedia.length);

  for (const entry of verifiedProductMedia) {
    const product = feedSnapshotJson.products.find((candidate) => candidate.id === entry.id);
    assert.ok(product, `${entry.id} must still exist in the supplier snapshot`);
    assert.equal(product.brand, entry.expectedBrand);
    assert.equal(product.sku, entry.expectedSku);
    assert.equal(product.title, entry.expectedTitle);
    assert.equal(product.images?.some(Boolean) || product.variants.some((variant) => variant.images?.some(Boolean)), false, `${entry.id} must not override feed media`);
    assert.ok(product.stock > 0, `${entry.id} must remain a currently stocked verified assignment`);
    assert.match(entry.sourcePage, /^https:\/\/k2tool\.ru\/catalog\//u);
    assert.match(entry.sourceImage, /^https:\/\/s3\.k2tool\.ru\/images\/product\//u);
    assert.match(entry.image, /^\/product-media\/verified\/[a-f0-9]{32}\.(?:webp|jpe?g|png)$/u);

    const bytes = await readFile(path.join(projectRoot, "public", entry.image.slice(1)));
    assert.equal(bytes.byteLength, entry.byteSize, `${entry.id} asset size changed`);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), entry.sha256, `${entry.id} asset hash changed`);
  }
});

test("verified media enriches every storefront reader without overwriting feed images or mismatched products", async () => {
  const enriched = getPublishedFeedCatalogSnapshot();
  for (const entry of verifiedProductMedia) {
    assert.deepEqual(enriched.products.find((product) => product.id === entry.id)?.images, [entry.image]);
  }

  const reference = feedSnapshotJson.products.find((product) => product.id === verifiedProductMedia[0].id);
  const existingImage = applyVerifiedProductMedia({ categories:[], products:[{ ...reference, images:["https://supplier.example/exact.webp"] }] });
  assert.deepEqual(existingImage.products[0].images, ["https://supplier.example/exact.webp"]);

  const mismatched = applyVerifiedProductMedia({ categories:[], products:[{ ...reference, title:`${reference.title} другое исполнение` }] });
  assert.deepEqual(mismatched.products[0].images, []);

  const searchSource = await readFile(path.join(projectRoot, "app", "data", "catalogSearch.ts"), "utf8");
  assert.match(searchSource, /getPublishedFeedCatalogSnapshot\(\)/u);
  assert.doesNotMatch(searchSource, /products\.json/u);
});

test("catalog quality removes only the 21 proven missing-image cases", () => {
  const report = getCatalogQualityReport();
  const missingImages = report.issues.filter((issue) => issue.code === "missing_image");
  const verifiedIds = new Set(verifiedProductMedia.map((entry) => entry.id));

  assert.equal(missingImages.length, 628);
  assert.equal(missingImages.some((issue) => verifiedIds.has(issue.productId)), false);
  assert.deepEqual(report.priorities.p1, { issueCount:983, affectedProductCount:803 });
});

test("every unresolved image has an actionable evidence queue without approximate matching", () => {
  const report = getCatalogQualityReport();
  const missingIds = new Set(report.issues.filter((issue) => issue.code === "missing_image").map((issue) => issue.productId));
  const products = getPublishedFeedCatalogSnapshot().products.filter((product) => missingIds.has(product.id));
  const counts = Object.fromEntries(Object.entries(Object.groupBy(products, (product) => classifyMissingProductMedia(product).code)).map(([code, entries]) => [code, entries.length]));

  assert.deepEqual(counts, {
    stocked_source_ready:54,
    unstocked_source_ready:515,
    unstocked_identity_first:56,
    stocked_identity_first:3,
  });
  for (const issue of report.issues.filter((entry) => entry.code === "missing_image")) {
    assert.match(issue.detail, /^Приоритет [12] · (?:точный источник|сначала идентификация)\./u);
  }
});
