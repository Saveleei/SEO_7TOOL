import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getParameterNumber, getParameterValue, selectComparableAlternatives, selectCompatibleAccessories, selectProductAlternatives, selectProductCompatibility } from "../app/data/productRecommendations.mjs";

const snapshot = JSON.parse(await readFile(new URL("../../../7tool-source/src/lib/products.json", import.meta.url), "utf8"));
const machine = snapshot.products.find((product) => product.slug === "magnitnyy-sverlilnyy-stanok-lenz-steyr-35");

test("accessory recommendations use exact feed variants inside the machine range", () => {
  const recommendations = selectCompatibleAccessories(snapshot.products, machine, 3);
  assert.equal(recommendations.length, 3);
  assert.deepEqual(recommendations.map((item) => item.diameter), [18, 25, 35]);
  for (const item of recommendations) {
    assert.equal(item.variant.available, true);
    assert.ok(item.variant.quantity > 0);
    assert.ok(item.variant.price > 0);
    assert.ok(item.diameter <= 35);
    assert.match(item.spindle, /Weldon 19/u);
  }
});

test("alternatives have explicit, non-duplicated decision reasons", () => {
  const alternatives = selectProductAlternatives(snapshot.products, machine, 3);
  assert.deepEqual(alternatives.map((item) => item.reason), ["Ниже цена", "С реверсом", "Больший диаметр"]);
  assert.equal(new Set(alternatives.map((item) => item.product.id)).size, alternatives.length);
  assert.ok(alternatives.every((item) => item.product.category === machine.category));
  assert.ok(alternatives.every((item) => /магнит|электромагнит/iu.test(item.product.title)));
});

test("annular cutter recommendations find machines from the selected size and carry evidence", () => {
  const cutter = snapshot.products.find((product) => product.slug === "sverla-koronchatye-lzhs");
  const selectedVariant = cutter.variants.find((variant) => variant.sku === "LZHS-013");
  const compatibility = selectProductCompatibility(snapshot.products, cutter, selectedVariant, 3);
  assert.equal(compatibility.length, 3);
  assert.ok(compatibility.every((item) => item.product.category === "stanki-sverlilnye"));
  assert.ok(compatibility.every((item) => /магнит|электромагнит/iu.test(item.product.title)));
  assert.ok(compatibility.every((item) => item.evidence.some((fact) => fact.includes("Ø13 мм"))));
  assert.ok(compatibility.every((item) => item.evidence.some((fact) => /Weldon 19/u.test(fact))));
  assert.ok(compatibility.every((item) => item.caveat.includes("рабочую длину 30 мм")));
});

test("generic alternatives preserve the critical selected size and explain matches", () => {
  const cutter = snapshot.products.find((product) => product.slug === "sverla-koronchatye-lzhs");
  const selectedVariant = cutter.variants.find((variant) => variant.sku === "LZHS-013");
  const alternatives = selectComparableAlternatives(snapshot.products, cutter, selectedVariant, 3);
  assert.equal(alternatives.length, 3);
  assert.equal(new Set(alternatives.map((item) => item.product.id)).size, alternatives.length);
  assert.ok(alternatives.every((item) => item.product.id !== cutter.id));
  assert.ok(alternatives.every((item) => item.evidence.length >= 2));
  assert.ok(alternatives.every((item) => item.evidence.some((fact) => fact === "Диаметр режущей части: 13 мм")));
  assert.ok(alternatives.every((item) => item.reason.includes("параметр") || item.reason.includes("Ниже цена")));
});

test("categories without an explicit cross-category rule do not receive invented compatibility", () => {
  const compressor = snapshot.products.find((product) => product.slug === "remennoy-odnostupenchatyy-kompressor-fubag-vcf-100-cm3");
  assert.deepEqual(selectProductCompatibility(snapshot.products, compressor, compressor.variants[0], 3), []);
});

test("parameter helpers preserve feed units and parse decimal commas", () => {
  const variant = machine.variants[0];
  assert.equal(getParameterValue(variant, "масса"), "10,5 кг");
  assert.equal(getParameterNumber(variant, "масса"), 10.5);
  assert.equal(getParameterNumber(variant, "макс. диаметр корончатого"), 35);
});

test("product page uses exact variants, honest supply states and local callback dialogs", async () => {
  const page = await readFile(new URL("../app/product/[slug]/page.tsx", import.meta.url), "utf8");
  const purchase = await readFile(new URL("../app/ui/FeedProductPurchase.tsx", import.meta.url), "utf8");
  const recommendations = await readFile(new URL("../app/ui/ProductRecommendationSystem.tsx", import.meta.url), "utf8");
  assert.match(page, /<ProductRecommendationSystem product=\{product\} variant=\{primaryVariant\}/u);
  assert.match(page, /pageArchetype\.supplyIntro/u);
  assert.match(page, /id:`variant:\$\{primaryVariant\.id\}`/u);
  assert.doesNotMatch(page, /Система охлаждения|Страховочный ремень|1 100 Вт/u);
  assert.match(recommendations, /pageArchetype\.compatibilityTitle/u);
  assert.match(recommendations, /pageArchetype\.kitTitle/u);
  assert.match(recommendations, /pageArchetype\.alternativesTitle/u);
  assert.match(recommendations, /Не показываем товары из соседней категории наугад/u);
  assert.match(recommendations, /publicProductPath\(product, variant\)/u);
  assert.match(recommendations, /choice\.label/u);
  assert.match(recommendations, /Артикул \$\{variant\.sku\}/u);
  assert.doesNotMatch(recommendations, /mailto:/u);
  assert.match(purchase, /id:`variant:\$\{selected\.id\}`/u);
  assert.match(purchase, /ContactRequestDialog/u);
  assert.doesNotMatch(purchase, /mailto:/u);
});

test("product description removes incomplete feed fragments and keeps readable type", async () => {
  const page = await readFile(new URL("../app/product/[slug]/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(page, /paragraph\.length >= 60 && !paragraph\.endsWith\("\?"\)/u);
  assert.match(page, /Описание и применение/u);
  assert.match(page, /buildDrillDescription\(primaryVariant\)/u);
  assert.match(page, /Отсутствующие параметры не дополнены предположениями/u);
  assert.match(styles, /\.feed-conversion-intro \{[^}]*font-size:16px[^}]*line-height:1\.58/us);
  assert.match(styles, /\.feed-product-description p \{[^}]*font-size:16px[^}]*line-height:1\.62/us);
  assert.match(styles, /\.feed-conversion-spec-table dt,\.feed-conversion-spec-table dd \{[^}]*font-size:14px/us);
  assert.match(styles, /\.feed-spec-source \{[^}]*font-size:12px/us);
});

test("product analytics carries context without contact data", async () => {
  const purchase = await readFile(new URL("../app/ui/FeedProductPurchase.tsx", import.meta.url), "utf8");
  const contactAnalytics = await readFile(new URL("../app/data/contactAnalytics.mjs", import.meta.url), "utf8");
  assert.match(purchase, /page_type:"product", product_id:productId, variant_id:trackedVariantId/u);
  assert.match(contactAnalytics, /PHONE_CLICK/u);
  assert.match(contactAnalytics, /EMAIL_CLICK/u);
  assert.match(contactAnalytics, /click_messenger/u);
  assert.match(contactAnalytics, /SAFE_CONTEXT_FIELDS = \["placement", "product_id", "variant_id", "category"\]/u);
  assert.doesNotMatch(purchase, /phone:|email:|name:/u);
  assert.doesNotMatch(contactAnalytics, /detail\.(phone|email|name)\s*=/u);
});

test("buy-box comparison opens an accessible feed-grounded decision dialog", async () => {
  const [page, purchase, recommendations, comparison] = await Promise.all([
    readFile(new URL("../app/product/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ui/FeedProductPurchase.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ui/ProductRecommendationSystem.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ui/ProductComparisonDialog.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(page, /hasComparableAlternatives=\{alternatives\.length > 0\}/u);
  assert.match(purchase, /aria-haspopup="dialog"/u);
  assert.match(purchase, /new CustomEvent\(PRODUCT_COMPARISON_EVENT\)/u);
  assert.match(purchase, /buttonLabel="Подобрать аналог"/u);
  assert.match(recommendations, /<ProductComparisonDialog/u);
  assert.match(comparison, /role="dialog" aria-modal="true"/u);
  assert.match(comparison, /heading = "Похожие модели по выбранному исполнению"/u);
  assert.match(comparison, /\{keepAction\}/u);
  assert.match(comparison, /Получить КП/u);
  assert.match(comparison, /comparison_add_to_quote/u);
  assert.match(comparison, /target_product_id:option\.productId, target_variant_id:option\.id/u);
  assert.doesNotMatch(comparison, /phone:|email:|name:/u);
});

test("legacy STEYR route and all primary search links converge on the feed product", async () => {
  const legacy = await readFile(new URL("../app/product/lenz-steyr-35/page.tsx", import.meta.url), "utf8");
  const headerSearch = await readFile(new URL("../app/ui/HeaderSearch.tsx", import.meta.url), "utf8");
  const catalogSearch = await readFile(new URL("../app/data/catalogSearch.ts", import.meta.url), "utf8");
  const canonicalPath = "/p/magnitnyy-sverlilnyy-stanok-lenz-steyr-35";
  assert.match(legacy, new RegExp(canonicalPath));
  assert.match(headerSearch, /<SmartSearch placement="header" \/>/u);
  assert.match(catalogSearch, /publicProductPath\(product/u);
});
