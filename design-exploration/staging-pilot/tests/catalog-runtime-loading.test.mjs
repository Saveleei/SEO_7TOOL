import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getFeedCategory, getFeedProductBySlug, getPublishedFeedCatalogSnapshot } from "../app/data/feedCatalog.ts";

test("catalog snapshot is loaded once at runtime instead of embedded in the server bundle", async () => {
  const source = await readFile(new URL("../app/data/feedCatalog.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /import\s+feedSnapshotJson\s+from/u);
  assert.match(source, /readFileSync\(snapshotPath, "utf8"\)/u);
  assert.match(source, /CATALOG_FEED_PATH/u);

  const snapshot = getPublishedFeedCatalogSnapshot();
  assert.ok(snapshot.categories.length > 0);
  assert.ok(snapshot.products.length > 0);
  assert.ok(getFeedCategory("stanki-sverlilnye")?.published);
  assert.ok(getFeedProductBySlug("magnitnyy-sverlilnyy-stanok-lenz-steyr-35"));
});

test("catalog presentation generator follows the same operator-selected feed as runtime", async () => {
  const source = await readFile(new URL("../scripts/build-catalog-presentation.mjs", import.meta.url), "utf8");
  assert.match(source, /process\.env\.CATALOG_FEED_PATH/u);
  assert.match(source, /path\.resolve\(configuredFeedPath\)/u);
  assert.match(source, /createHash\("sha256"\)\.update\(feedBytes\)/u);
});

test("base facets are precomputed from the exact feed while runtime overrides remain dynamic", async () => {
  const [feed, generatedSource, catalogSource] = await Promise.all([
    readFile(new URL("../../../7tool-source/src/lib/products.json", import.meta.url)),
    readFile(new URL("../app/data/generatedCatalogFacets.json", import.meta.url), "utf8"),
    readFile(new URL("../app/data/feedCatalog.ts", import.meta.url), "utf8"),
  ]);
  const generated = JSON.parse(generatedSource);
  assert.equal(generated.sourceSha256, createHash("sha256").update(feed).digest("hex"));
  assert.equal(generated.version, 1);
  assert.ok(generated.categories["sverla-i-zenkovki"].length >= 10);
  assert.equal(generated.rankings["sverla-i-zenkovki"].length, 367);
  assert.match(catalogSource, /generatedCatalogFacets\.sourceSha256 === feedSnapshotSha256/u);
  assert.match(catalogSource, /revision === 0/u);
  assert.match(catalogSource, /generatedFacets \?\? buildCategoryFacets/u);
  assert.match(catalogSource, /generatedRanking\.length === \(productsByCategory/u);
});

test("base catalog quality is precomputed without embedding its large report in the server bundle", async () => {
  const [feed, generatedSource, qualitySource] = await Promise.all([
    readFile(new URL("../../../7tool-source/src/lib/products.json", import.meta.url)),
    readFile(new URL("../app/data/generatedCatalogQuality.json", import.meta.url), "utf8"),
    readFile(new URL("../app/data/catalogQuality.ts", import.meta.url), "utf8"),
  ]);
  const generated = JSON.parse(generatedSource);
  assert.equal(generated.sourceSha256, createHash("sha256").update(feed).digest("hex"));
  assert.equal(generated.version, 2);
  assert.equal(generated.report.productCount, getPublishedFeedCatalogSnapshot().products.length);
  assert.ok(generated.report.issueCount > 0);
  assert.match(qualitySource, /readFileSync\(snapshotPath, "utf8"\)/u);
  assert.match(qualitySource, /revision === 0/u);
  assert.match(qualitySource, /generatedReport \?\? buildCatalogQualityReport/u);
  assert.match(qualitySource, /parsed\.version === CATALOG_QUALITY_ANALYZER_VERSION/u);
  assert.doesNotMatch(qualitySource, /import\s+generatedCatalogQuality/u);
});

test("draft supplier products never enter the public storefront snapshot", () => {
  const publicSnapshot = getPublishedFeedCatalogSnapshot();
  assert.equal(publicSnapshot.products.some((product) => product.draft), false);
  assert.equal(publicSnapshot.products.some((product) => product.id === "A57318"), false);
});

test("global navigation uses a feed-current lightweight catalog projection", async () => {
  const [feed, presentationSource, groupsSource] = await Promise.all([
    readFile(new URL("../../../7tool-source/src/lib/products.json", import.meta.url)),
    readFile(new URL("../app/data/generatedCatalogPresentation.json", import.meta.url), "utf8"),
    readFile(new URL("../app/data/productionCategoryGroups.ts", import.meta.url), "utf8"),
  ]);
  const presentation = JSON.parse(presentationSource);
  assert.equal(presentation.sourceSha256, createHash("sha256").update(feed).digest("hex"));
  assert.ok(presentation.publishedCategorySlugs.length > 0);
  assert.ok(presentation.categories["stanki-sverlilnye"].count > 0);
  assert.ok(presentation.categories["stanki-sverlilnye"].image);
  assert.doesNotMatch(groupsSource, /from "\.\/feedCatalog/u);
  assert.match(groupsSource, /generatedCatalogPresentation\.json/u);
});
