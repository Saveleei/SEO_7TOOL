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
