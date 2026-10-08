import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getPublishedFeedCategorySlugs } from "../app/data/feedCatalog.ts";
import { getProductPageArchetype, productPageArchetypes } from "../app/data/productPageArchetypes.ts";

test("every published category resolves to a complete product-page buying archetype", () => {
  const requiredCopy = [
    "badge",
    "routeTitle",
    "routeLead",
    "primaryAction",
    "requestAction",
    "fitAction",
    "compareAction",
    "quoteProof",
    "decisionTitle",
    "recommendationTitle",
    "comparisonTitle",
    "supplyTitle",
    "finalTitle",
    "savedContextLabel",
  ];

  for (const categorySlug of getPublishedFeedCategorySlugs()) {
    const archetype = getProductPageArchetype(categorySlug);
    assert.equal(productPageArchetypes[archetype.id], archetype, `${categorySlug}: unknown archetype`);
    for (const key of requiredCopy) assert.ok(archetype[key]?.trim(), `${categorySlug}: ${key}`);
  }
});

test("priority categories use the appropriate industrial purchase scenario", () => {
  assert.equal(getProductPageArchetype("stanki-sverlilnye").id, "equipment");
  assert.equal(getProductPageArchetype("koronchatye-sverla").id, "dimensional-tooling");
  assert.equal(getProductPageArchetype("borfrezy").id, "dimensional-tooling");
  assert.equal(getProductPageArchetype("kromkorezy-po-listu").id, "mobile-processing");
  assert.equal(getProductPageArchetype("kromkorezy-dlya-trub").id, "mobile-processing");
  assert.equal(getProductPageArchetype("magnitnaya-osnastka").id, "compatible-accessory");
  assert.equal(getProductPageArchetype("sozh-i-sots").id, "process-consumable");
  assert.equal(getProductPageArchetype("stanki-lazernoy-rezki").id, "project-system");
});

test("product page surfaces the scenario before purchase and carries it through comparison and quote", async () => {
  const [page, purchase, recommendations, comparison, styles] = await Promise.all([
    readFile(new URL("../app/product/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ui/FeedProductPurchase.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ui/ProductRecommendationSystem.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ui/ProductComparisonDialog.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /getProductPageArchetype\(product\.category\)/u);
  assert.match(page, /className="feed-product-buying-route"/u);
  assert.match(page, /expertProfile\.criteria\.slice\(0, 3\)/u);
  assert.match(page, /categorySlug=\{product\.category\}/u);
  assert.match(page, /data-product-archetype=\{pageArchetype\.id\}/u);
  assert.match(purchase, /feed-quote-primary[\s\S]*Получить КП/u);
  assert.doesNotMatch(purchase, /feed-quote-secondary|>В запрос</u);
  assert.doesNotMatch(purchase, /feed-quote-quick|feed-open-quote|QuickOrderDialog/u);
  assert.match(purchase, /pageArchetype\.fitAction/u);
  assert.match(purchase, />Сравнить<\/button>/u);
  assert.match(recommendations, /heading=\{pageArchetype\.comparisonTitle\}/u);
  assert.match(recommendations, /pageArchetype\.compatibilityTitle/u);
  assert.match(comparison, /\{heading\}/u);
  assert.match(comparison, /\{keepAction\}/u);
  assert.match(styles, /\.feed-product-buying-route \{/u);
  assert.match(styles, /@media \(max-width:760px\)[\s\S]*\.feed-product-buying-route \{ grid-template-columns:1fr/u);
});

test("tooling and equipment actions do not collapse into generic model copy", () => {
  const equipment = getProductPageArchetype("stanki-sverlilnye");
  const tooling = getProductPageArchetype("koronchatye-sverla");
  assert.match(equipment.primaryAction, /оборудование/iu);
  assert.match(equipment.compareAction, /модел/iu);
  assert.match(tooling.primaryAction, /типоразмер/iu);
  assert.match(tooling.compareAction, /серии|размер/iu);
  assert.match(tooling.quoteProof, /точный типоразмер/iu);
});
