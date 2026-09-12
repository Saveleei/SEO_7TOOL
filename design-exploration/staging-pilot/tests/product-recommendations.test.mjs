import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getParameterNumber, getParameterValue, selectCompatibleAccessories, selectProductAlternatives } from "../app/data/productRecommendations.mjs";

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

test("parameter helpers preserve feed units and parse decimal commas", () => {
  const variant = machine.variants[0];
  assert.equal(getParameterValue(variant, "масса"), "10,5 кг");
  assert.equal(getParameterNumber(variant, "масса"), 10.5);
  assert.equal(getParameterNumber(variant, "макс. диаметр корончатого"), 35);
});

test("product page uses exact variants, honest supply states and local callback dialogs", async () => {
  const page = await readFile(new URL("../app/product/[slug]/page.tsx", import.meta.url), "utf8");
  const purchase = await readFile(new URL("../app/ui/FeedProductPurchase.tsx", import.meta.url), "utf8");
  assert.match(page, /getFeedAccessoryRecommendations\(product, 3\)/u);
  assert.match(page, /В фиде нет состава поставки и файлов документов/u);
  assert.match(page, /id:`variant:\$\{primaryVariant\.id\}`/u);
  assert.doesNotMatch(page, /Система охлаждения|Страховочный ремень|1 100 Вт/u);
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
  const manager = await readFile(new URL("../app/ui/ManagerContactCard.tsx", import.meta.url), "utf8");
  assert.match(purchase, /page_type:"product", product_id:productId, variant_id:trackedVariantId/u);
  assert.match(manager, /PHONE_CLICK/u);
  assert.match(manager, /EMAIL_CLICK/u);
  assert.match(manager, /click_messenger/u);
  assert.doesNotMatch(purchase, /phone:|email:|name:/u);
});

test("legacy STEYR route and all primary search links converge on the feed product", async () => {
  const legacy = await readFile(new URL("../app/product/lenz-steyr-35/page.tsx", import.meta.url), "utf8");
  const headerSearch = await readFile(new URL("../app/ui/HeaderSearch.tsx", import.meta.url), "utf8");
  const catalogSearch = await readFile(new URL("../app/data/catalogSearch.ts", import.meta.url), "utf8");
  const canonicalPath = "/product/magnitnyy-sverlilnyy-stanok-lenz-steyr-35";
  assert.match(legacy, new RegExp(canonicalPath));
  assert.match(headerSearch, /<SmartSearch placement="header" \/>/u);
  assert.match(catalogSearch, /`\/product\/\$\{product\.slug\}/u);
});
