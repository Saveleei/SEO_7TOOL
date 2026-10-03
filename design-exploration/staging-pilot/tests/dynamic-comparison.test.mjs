import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("comparison state persists only catalog identifiers and enforces four products", () => {
  const source = read("app/ui/Comparison.tsx");
  assert.match(source, /7tool:comparison:v1/u);
  assert.match(source, /const MAX_ITEMS = 4/u);
  assert.match(source, /unique\.set\(productId/u);
  assert.match(source, /slice\(0, MAX_ITEMS\)/u);
  assert.doesNotMatch(source, /email|phone|company|contactName/iu);
});

test("comparison refreshes buyer selection from the current feed", () => {
  const route = read("app/api/compare/route.ts");
  assert.match(route, /getFeedProductBySlug/u);
  assert.match(route, /getVariantShippingPromise/u);
  assert.match(route, /getProductShippingPromise/u);
  assert.match(route, /getFeedVariantTechnicalSpecs/u);
  assert.match(route, /Cache-Control":"no-store/u);
  assert.doesNotMatch(route, /LENZ STEYR-35|HEDEN DM-36K/u);
});

test("comparison page has empty, one-product and table states", () => {
  const page = read("app/compare/ComparePageClient.tsx");
  assert.match(page, /Вы пока не выбрали товары/u);
  assert.match(page, /Добавьте ещё один товар/u);
  assert.match(page, /comparison-table--dynamic/u);
  assert.match(page, /Цена и следующий шаг/u);
  assert.match(page, /Получить рекомендацию/u);
  assert.match(page, /Нет данных в фиде/u);
});

test("catalog cards, table and exact product variant share one comparison provider", () => {
  const layout = read("app/layout.tsx");
  const list = read("app/ui/FeedProductList.tsx");
  const table = read("app/ui/FeedProductTable.tsx");
  const purchase = read("app/ui/FeedProductPurchase.tsx");
  assert.match(layout, /<ComparisonProvider>/u);
  assert.match(list, /comparisonSelectionFromCard/u);
  assert.match(table, /category_table/u);
  assert.match(table, /category_mobile/u);
  assert.match(read("app/ui/Comparison.tsx"), /product\.selectedVariantCount === 1[\s\S]*variantId:exactVariant\?\.id/u);
  assert.match(purchase, /variantId:selected\.id/u);
  assert.match(purchase, /CompareToggleButton/u);
});

test("comparison analytics are allowlisted and privacy-safe", () => {
  const analytics = read("app/data/conversionAnalytics.mjs");
  for (const event of ["comparison_add", "comparison_remove", "comparison_clear", "comparison_view"]) assert.match(analytics, new RegExp(`"${event}"`, "u"));
  assert.doesNotMatch(analytics, /SAFE_STRING_FIELDS[^]*email/iu);
});

test("responsive tray and comparison table account for mobile actions", () => {
  const css = read("app/globals.css");
  assert.match(css, /\.comparison-tray \{ position:fixed/u);
  assert.match(css, /body:has\(\.comparison-tray\) \.mobile-manager-bubble/u);
  assert.match(css, /\.comparison-table--dynamic thead th:first-child[^]*position:sticky/u);
  assert.match(css, /\.comparison-product-card>img[^]*object-fit:contain/u);
});
