import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { GET as getProductVariants } from "../app/api/catalog-product-variants/route.ts";
import { getVariantChoicePresentation, sortVariantsForChoice } from "../app/data/variantPresentation.ts";

const snapshot = JSON.parse(await readFile(new URL("../../../7tool-source/src/lib/products.json", import.meta.url), "utf8"));
const annularCutters = snapshot.products.find((product) => product.slug === "sverla-koronchatye-lzhs");

test("annular cutter choices lead with size instead of supplier article", () => {
  assert.ok(annularCutters);
  const variant = annularCutters.variants.find((entry) => entry.sku === "LZHS-013");
  const choice = getVariantChoicePresentation(annularCutters, variant);
  assert.equal(choice.label, "Ø13 × 30 мм");
  assert.equal(choice.selectorLabel, "Размер");
  assert.equal(choice.sizeLed, true);
  assert.match(choice.context, /Weldon 19 \+ Nitto/u);
  assert.doesNotMatch(choice.label, /LZHS|A9021/u);
});

test("all cutter variants are sorted by diameter rather than article feed order", () => {
  const sorted = sortVariantsForChoice(annularCutters, annularCutters.variants);
  assert.equal(sorted.length, 49);
  assert.deepEqual(sorted.slice(0, 5).map((variant) => getVariantChoicePresentation(annularCutters, variant).diameter), [12, 13, 14, 15, 16]);
  assert.equal(sorted.at(-1).sku, "LZHS-060");
});

test("product selector exposes the full searchable size range and keeps SKU secondary", async () => {
  const page = await readFile(new URL("../app/product/[slug]/page.tsx", import.meta.url), "utf8");
  const purchase = await readFile(new URL("../app/ui/FeedProductPurchase.tsx", import.meta.url), "utf8");
  assert.match(page, /sortVariantsForChoice\(product,/u);
  assert.doesNotMatch(page, /allVariants\.filter[\s\S]{0,200}\.slice\(0, 12\)/u);
  assert.match(page, /getProductVariantChoices\(product\)/u);
  assert.match(page, /variantsEndpoint=\{`\/api\/catalog-product-variants/u);
  assert.match(purchase, /Все \$\{totalVariantCount\}/u);
  assert.match(purchase, /Найти по размеру или артикулу/u);
  assert.match(purchase, /<b>\{variant\.choiceLabel\}<\/b>/u);
  assert.match(purchase, /<small>\{selected\.choiceContext[\s\S]*артикул \$\{selected\.sku\}/u);
  assert.doesNotMatch(purchase, /<b>\{variant\.sku/u);
});

test("full size list is loaded on demand in natural order", async () => {
  const response = await getProductVariants(new Request("http://127.0.0.1/api/catalog-product-variants?product=sverla-koronchatye-lzhs"));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control") ?? "", /max-age=300/u);
  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.variants.length, 49);
  assert.deepEqual(payload.variants.slice(0, 5).map((variant) => variant.choiceLabel), ["Ø12 × 30 мм", "Ø13 × 30 мм", "Ø14 × 30 мм", "Ø15 × 30 мм", "Ø16 × 30 мм"]);
  assert.equal(payload.variants[0].sku, "LZHS-012");

  const invalid = await getProductVariants(new Request("http://127.0.0.1/api/catalog-product-variants?product=../secret"));
  assert.equal(invalid.status, 400);
});

test("compatible accessory cards lead with working size and keep article as reference", async () => {
  const page = await readFile(new URL("../app/product/[slug]/page.tsx", import.meta.url), "utf8");
  assert.match(page, /className="feed-accessory-size">\{choice\.label\}/u);
  assert.match(page, /<small>Артикул \{variant\.sku/u);
  assert.doesNotMatch(page, /<h3><Link[^>]*>\{variant\.name/u);
});
