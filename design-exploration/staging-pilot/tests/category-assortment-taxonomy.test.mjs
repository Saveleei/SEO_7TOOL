import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  categoryAssortmentTaxonomies,
  getCategoryFamily,
  getCategoryFamilyLabel,
} from "../app/data/categoryAssortmentTaxonomy.mjs";
import { getCategoryExpertProfile } from "../app/data/categoryExpertProfiles.mjs";
import {
  getFeedCategoryPage,
  getPublishedFeedCatalogSnapshot,
  getPublishedFeedCategorySlugs,
  toFeedProductCardModel,
} from "../app/data/feedCatalog.ts";

test("every published category exposes a feed-grounded assortment entry path", () => {
  for (const slug of getPublishedFeedCategorySlugs()) {
    const profile = getCategoryExpertProfile(slug);
    assert.ok(profile.assortmentPrompt?.length >= 20, `${slug}: assortment prompt`);
    assert.ok(profile.assortmentShortcuts?.length >= 2, `${slug}: assortment shortcuts`);
    assert.ok(profile.assortmentShortcuts.every((shortcut) => shortcut.family || shortcut.segment || shortcut.productType || shortcut.query), `${slug}: shortcut target`);
  }
});

test("category families classify every current product exactly once and family filters agree", () => {
  const snapshot = getPublishedFeedCatalogSnapshot();
  for (const [slug, taxonomy] of Object.entries(categoryAssortmentTaxonomies)) {
    const products = snapshot.products.filter((product) => product.category === slug);
    assert.ok(products.length > 0, `${slug}: current assortment`);
    const counts = new Map(taxonomy.families.map((family) => [family.id, 0]));

    for (const product of products) {
      const familyId = getCategoryFamily(slug, product);
      assert.ok(familyId, `${slug}/${product.slug}: family`);
      assert.ok(counts.has(familyId), `${slug}/${product.slug}: known family`);
      counts.set(familyId, (counts.get(familyId) ?? 0) + 1);
      assert.ok(getCategoryFamilyLabel(slug, familyId)?.length > 2, `${slug}/${familyId}: label`);
    }

    const visibleFamilies = [...counts].filter(([, count]) => count > 0);
    assert.ok(visibleFamilies.length >= 2, `${slug}: at least two populated families`);
    assert.equal(visibleFamilies.reduce((sum, [, count]) => sum + count, 0), products.length, `${slug}: no lost or duplicated products`);
    for (const [familyId, expected] of visibleFamilies) {
      assert.equal(getFeedCategoryPage(slug, { family:familyId, pageSize:48 }).total, expected, `${slug}/${familyId}: filtered total`);
    }
  }
});

test("family shortcuts carry a decision frame and product cards identify their family", () => {
  const snapshot = getPublishedFeedCatalogSnapshot();
  for (const slug of Object.keys(categoryAssortmentTaxonomies)) {
    const profile = getCategoryExpertProfile(slug);
    const shortcuts = profile.assortmentShortcuts.filter((shortcut) => shortcut.family);
    assert.ok(shortcuts.every((shortcut) => shortcut.heroTitle && shortcut.heroIntro && shortcut.listingTitle && shortcut.selectorTitle), `${slug}: family copy`);
    assert.ok(shortcuts.every((shortcut) => shortcut.scopeGuidance?.bestFor && shortcut.scopeGuidance?.checkFirst && shortcut.scopeGuidance?.compareBy), `${slug}: decision guidance`);

    const product = snapshot.products.find((candidate) => candidate.category === slug);
    assert.ok(product, `${slug}: representative product`);
    const card = toFeedProductCardModel(product);
    assert.equal(card.taskLabel, getCategoryFamilyLabel(slug, getCategoryFamily(slug, product)), `${slug}: card family label`);
  }
});

test("category page preserves family context and uses engineer-first handoff where configured", async () => {
  const page = await readFile(new URL("../app/catalog/category/[slug]/page.tsx", import.meta.url), "utf8");
  assert.match(page, /requestedFamily = firstValue\(rawSearchParams\.family\)/u);
  assert.match(page, /name="family" value=\{family\}/u);
  assert.match(page, /removeKey:"family"/u);
  assert.match(page, /activeShortcut\?\.selectionMode/u);
  assert.match(page, /id="category-selector" open/u);
  assert.match(page, /Заказать подбор инженера/u);
});
