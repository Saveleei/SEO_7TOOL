import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { GET as getProductVariants } from "../app/api/catalog-product-variants/route.ts";
import { getFeedVariantSpecs, toFeedProductCardModel } from "../app/data/feedCatalog.ts";
import { publicProductPath } from "../app/data/publicUrls.ts";
import { CATEGORY_VARIANT_PRESENTATION_RULES, getProductVariantChoice, getProductVariantChoicePage, getProductVariantChoices, getVariantChoicePresentation, selectDefaultVariant, sortVariantsForChoice } from "../app/data/variantPresentation.ts";

const snapshot = JSON.parse(await readFile(new URL("../../../7tool-source/src/lib/products.json", import.meta.url), "utf8"));
const annularCutters = snapshot.products.find((product) => product.slug === "sverla-koronchatye-lzhs");
const magneticPlates = snapshot.products.find((product) => product.slug === "plity-magnitnye-heden");

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

test("default product variant prefers confirmed stock and price without changing explicit sorting", () => {
  const product = annularCutters;
  assert.ok(product);
  const variants = [
    { ...product.variants[0], id:"unavailable", available:false, quantity:0, price:100 },
    { ...product.variants[0], id:"stock-no-price", available:true, quantity:2, price:undefined },
    { ...product.variants[0], id:"stock-price", available:true, quantity:1, price:200 },
  ];
  assert.equal(selectDefaultVariant(product, variants)?.id, "stock-price");
});

test("all cutter variants are sorted by diameter rather than article feed order", () => {
  const sorted = sortVariantsForChoice(annularCutters, annularCutters.variants);
  assert.equal(sorted.length, 49);
  assert.deepEqual(sorted.slice(0, 5).map((variant) => getVariantChoicePresentation(annularCutters, variant).diameter), [12, 13, 14, 15, 16]);
  assert.equal(sorted.at(-1).sku, "LZHS-060");
});

test("magnetic plate choices extract supplier dimensions and remove the repeated series name", () => {
  assert.ok(magneticPlates);
  const choices = getProductVariantChoices(magneticPlates);
  assert.equal(choices.length, 19);
  assert.deepEqual(choices.slice(0, 4).map((choice) => choice.choiceLabel), ["100 × 175 мм", "100 × 200 мм", "125 × 250 мм", "130 × 70 мм"]);
  assert.ok(choices.every((choice) => choice.selectorLabel === "Размер"));
  assert.ok(choices.every((choice) => !/плита|heden/iu.test(choice.choiceLabel)));
});

test("product selector keeps the initial payload bounded and opens the paged full matrix", async () => {
  const page = await readFile(new URL("../app/product/[slug]/page.tsx", import.meta.url), "utf8");
  const purchase = await readFile(new URL("../app/ui/FeedProductPurchase.tsx", import.meta.url), "utf8");
  const picker = await readFile(new URL("../app/ui/VariantPickerDialog.tsx", import.meta.url), "utf8");
  assert.match(page, /sortVariantsForChoice\(product,/u);
  assert.match(page, /getProductVariantChoicePage\(product, \{ limit:24 \}\)/u);
  assert.match(page, /getProductVariantChoice\(product, primaryVariant\.id\)/u);
  assert.match(page, /variants=\{initialPurchaseVariants\}/u);
  assert.match(page, /totalVariantCount=\{initialPurchasePage\.totalVariantCount\}/u);
  assert.match(page, /initialNextOffset=\{initialPurchasePage\.nextOffset\}/u);
  assert.match(page, /variantsEndpoint=\{variantsEndpoint\}/u);
  assert.doesNotMatch(page, /getProductVariantChoices\(product\)/u);
  assert.match(purchase, /variants\.slice\(0, INITIAL_VARIANTS\)/u);
  assert.match(purchase, /feed-variant-options--sizes/u);
  assert.match(purchase, /Сейчас показано \{collapsedVariantCount\} из \{totalVariantCount\}/u);
  assert.match(purchase, /feed-variant-availability-legend/u);
  assert.match(purchase, /<VariantPickerDialog/u);
  assert.match(purchase, /initialNextOffset=\{initialNextOffset\}/u);
  assert.match(purchase, /initialAvailableVariantCount=\{availableVariantCount\}/u);
  assert.match(purchase, /Открыть удобный выбор/u);
  assert.match(purchase, /totalVariantCount > 1 && <VariantPickerDialog/u);
  assert.match(picker, /Найти по размеру или артикулу/u);
  assert.match(picker, /initialNextOffset === undefined/u);
  assert.match(purchase, /feed-add-label--mobile">\{added \? "Добавлено" : "Добавить в КП"\}/u);
  assert.match(purchase, /<small>\{selected\.choiceContext[\s\S]*артикул \$\{selected\.sku\}/u);
  assert.doesNotMatch(purchase, /<b>\{variant\.sku/u);
  assert.doesNotMatch(purchase, /history\.replaceState/u);
});

test("a deep-linked variant can be materialized without serializing the full matrix", () => {
  const exact = annularCutters.variants.find((variant) => variant.sku === "LZHS-060");
  assert.ok(exact);
  const choice = getProductVariantChoice(annularCutters, exact.id);
  assert.equal(choice?.id, exact.id);
  assert.equal(choice?.sku, "LZHS-060");
  assert.equal(choice?.href, `${publicProductPath(annularCutters, exact)}#variants`);
  assert.equal(getProductVariantChoice(annularCutters, "missing-variant"), undefined);
});

test("non-size execution choices keep complete decision labels visible", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(styles, /\.feed-variant-options:not\(\.feed-variant-options--sizes\)>a b,[\s\S]*?white-space:normal;[\s\S]*?overflow-wrap:anywhere;/u);
  assert.match(styles, /@media \(max-width:760px\)[\s\S]*?\.feed-variant-options:not\(\.feed-variant-options--sizes\) \{ grid-template-columns:1fr; \}/u);
});

test("variant API pages the full matrix, searches every row, and keeps responses bounded", async () => {
  const response = await getProductVariants(new Request("http://127.0.0.1/api/catalog-product-variants?product=sverla-koronchatye-lzhs"));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control") ?? "", /max-age=120/u);
  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.totalVariantCount, 49);
  assert.equal(payload.matchedVariantCount, 49);
  assert.equal(payload.offset, 0);
  assert.equal(payload.nextOffset, 24);
  assert.equal(payload.variants.length, 24);
  assert.equal("keySpecs" in payload.variants[0], false);
  assert.deepEqual(payload.variants.slice(0, 5).map((variant) => variant.choiceLabel), ["Ø12 × 30 мм", "Ø13 × 30 мм", "Ø14 × 30 мм", "Ø15 × 30 мм", "Ø16 × 30 мм"]);
  assert.equal(payload.variants[0].sku, "LZHS-012");

  const secondResponse = await getProductVariants(new Request("http://127.0.0.1/api/catalog-product-variants?product=sverla-koronchatye-lzhs&offset=24&limit=24"));
  const secondPayload = await secondResponse.json();
  assert.equal(secondPayload.variants.length, 24);
  assert.equal(secondPayload.offset, 24);
  assert.equal(secondPayload.nextOffset, 48);

  const finalResponse = await getProductVariants(new Request("http://127.0.0.1/api/catalog-product-variants?product=sverla-koronchatye-lzhs&offset=48&limit=24"));
  const finalPayload = await finalResponse.json();
  assert.equal(finalPayload.variants.length, 1);
  assert.equal(finalPayload.variants[0].sku, "LZHS-060");
  assert.equal(finalPayload.nextOffset, null);

  const searchResponse = await getProductVariants(new Request("http://127.0.0.1/api/catalog-product-variants?product=sverla-koronchatye-lzhs&q=LZHS-060"));
  const searchPayload = await searchResponse.json();
  assert.equal(searchPayload.matchedVariantCount, 1);
  assert.deepEqual(searchPayload.variants.map((variant) => variant.sku), ["LZHS-060"]);

  const biggestProduct = snapshot.products.reduce((largest, product) => product.variants.length > largest.variants.length ? product : largest, snapshot.products[0]);
  assert.ok(biggestProduct.variants.length > 400);
  const biggestResponse = await getProductVariants(new Request(`http://127.0.0.1/api/catalog-product-variants?product=${biggestProduct.slug}&limit=500`));
  const biggestBody = await biggestResponse.text();
  const biggestPayload = JSON.parse(biggestBody);
  assert.equal(biggestPayload.totalVariantCount, biggestProduct.variants.length);
  assert.equal(biggestPayload.variants.length, 60);
  assert.ok(Buffer.byteLength(biggestBody) < 70_000, `paged response is unexpectedly large: ${Buffer.byteLength(biggestBody)} bytes`);

  const directPage = getProductVariantChoicePage(biggestProduct, { limit:24 });
  assert.equal(directPage.variants.length, 24);
  assert.equal(directPage.nextOffset, 24);

  const invalid = await getProductVariants(new Request("http://127.0.0.1/api/catalog-product-variants?product=../secret"));
  assert.equal(invalid.status, 400);

  const overlongQuery = await getProductVariants(new Request(`http://127.0.0.1/api/catalog-product-variants?product=sverla-koronchatye-lzhs&q=${"a".repeat(101)}`));
  assert.equal(overlongQuery.status, 400);
});

test("compatible accessory cards lead with working size and keep article as reference", async () => {
  const recommendations = await readFile(new URL("../app/ui/ProductRecommendationSystem.tsx", import.meta.url), "utf8");
  assert.match(recommendations, /className="feed-recommendation-choice">\{choice\.label\}/u);
  assert.match(recommendations, /variant\.sku \? `Артикул \$\{variant\.sku\}`/u);
  assert.doesNotMatch(recommendations, /<h4><a[^>]*>\{variant\.name/u);
});

test("category card variants show the buyer size first and keep actions readable", async () => {
  const [card, table, picker, matrix, styles] = await Promise.all([
    readFile(new URL("../app/ui/FeedProductCard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ui/FeedProductTable.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ui/VariantPickerDialog.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ui/VariantAvailabilityMatrix.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  for (const source of [card, table]) {
    assert.match(source, /VariantPickerDialog/u);
    assert.match(source, /toPickerItems/u);
    assert.match(source, /variantChoiceLabel/u);
    assert.match(source, /\/api\/catalog-product-variants\?product=\$\{encodeURIComponent\(/u);
    assert.match(source, /&v=\$\{encodeURIComponent\(product\.catalogRevision\)\}/u);
    assert.match(source, /variantsEndpoint=\{/u);
    assert.match(source, /preloadVariantPickerItems/u);
  }
  const cardModel = toFeedProductCardModel(annularCutters);
  assert.match(cardModel.catalogRevision, /^[a-f0-9]{12}-\d+$/u);
  assert.match(picker, /fetch\(requestUrl/u);
  assert.match(picker, /preloadVariantPickerItems/u);
  assert.match(picker, /Первые варианты уже доступны/u);
  assert.match(picker, /Показать ещё/u);
  assert.match(picker, /Показано \{filteredItems\.length\} из \{matchedVariantCount\}/u);
  assert.match(picker, /SEARCH_DEBOUNCE_MS/u);
  assert.match(picker, /filteredItems\.length > 0/u);
  assert.match(picker, /aria-label="Матрица размеров и наличия"/u);
  assert.match(picker, /variant-picker-dialog--\$\{selectorLabel === "Размер" \? "sizes" : "executions"\}/u);
  assert.match(picker, /item\.context && <em>\{item\.context\}<\/em>/u);
  assert.match(picker, /availableItems\.filter/u);
  assert.match(picker, /item\.shippingPromise\.available \? "is-available" : "is-unconfirmed"/u);
  assert.match(picker, /<b>\{item\.label\}<\/b>/u);
  assert.match(picker, /Артикул \$\{selected\.sku\}/u);
  assert.match(picker, /Добавить в КП/u);
  assert.match(card, /<VariantAvailabilityMatrix/u);
  assert.match(table, /<VariantAvailabilityMatrix/u);
  assert.match(matrix, /Матрица доступности/u);
  assert.match(matrix, /variant\.choiceLabel/u);
  assert.match(matrix, /variant\.shippingPromise\.available \? "В наличии" : "Уточним"/u);
  assert.match(matrix, /Открыть полный выбор/u);
  assert.match(styles, /\.variant-availability-matrix--sizes \.variant-availability-grid \{ grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/u);
  assert.match(styles, /\.variant-availability-matrix--executions \.variant-availability-grid \{ grid-template-columns:minmax\(0,1fr\)/u);
  assert.match(styles, /\.variant-picker-dialog \{[\s\S]*?max-height:min/u);
  assert.match(styles, /\.variant-picker-loading--inline/u);
  assert.match(styles, /@media \(max-width:760px\)[\s\S]*?\.variant-picker-dialog \{ width:100%; height:100dvh/u);
});

test("full comparison repeats the commercial decision after technical parameters", async () => {
  const [page, client, styles] = await Promise.all([
    readFile(new URL("../app/compare/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/compare/ComparePageClient.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  const comparison = `${page}\n${client}`;
  assert.doesNotMatch(comparison, /\["Ориентировочная цена с НДС", "price"/u);
  assert.match(comparison, /comparison-table__price/u);
  assert.match(comparison, /comparison-table__commercial-row/u);
  assert.match(comparison, /Цена и следующий шаг/u);
  assert.match(comparison, /Выбрать исполнение/u);
  assert.match(styles, /\.comparison-table__commercial-row td strong[^}]*font:/u);
});

test("every feed category has a buyer-first variant presentation rule", () => {
  const categories = new Set(snapshot.products.map((product) => product.category));
  assert.deepEqual([...categories].filter((category) => !CATEGORY_VARIANT_PRESENTATION_RULES[category]), []);
});

test("all feed choices stay readable and never use SKU as the primary label", () => {
  let choiceCount = 0;
  for (const product of snapshot.products) {
    for (const variant of product.variants) {
      const choice = getVariantChoicePresentation(product, variant);
      choiceCount += 1;
      assert.ok(choice.label.trim(), `${product.slug}/${variant.id} has an empty label`);
      assert.ok(choice.label.length <= 72, `${product.slug}/${variant.id} has an overlong label: ${choice.label}`);
      if (variant.sku.trim()) assert.notEqual(normalize(choice.label), normalize(variant.sku), `${product.slug}/${variant.id} leads with SKU`);
    }
  }
  const snapshotVariantCount = snapshot.products.reduce((sum, product) => sum + product.variants.length, 0);
  assert.ok(choiceCount > 18_000);
  assert.equal(choiceCount, snapshotVariantCount);
});

test("category matrix leads with the actual industrial decision parameter", () => {
  const tap = findVariant("metchiki", (variant) => variant.sku === "20.1820-002");
  assert.equal(getVariantChoicePresentation(tap.product, tap.variant).label, "M3");
  assert.match(getVariantChoicePresentation(tap.product, tap.variant).context, /DIN 371/u);

  const pipeBeveler = findVariant("kromkorezy-dlya-trub", (variant) => variant.sku === "ТВР-170 П");
  assert.equal(getVariantChoicePresentation(pipeBeveler.product, pipeBeveler.variant).label, "Ø60–159 мм");

  const pipeCutter = findVariant("truborezy", (variant) => variant.sku === "H2S");
  assert.equal(getVariantChoicePresentation(pipeCutter.product, pipeCutter.variant).label, "Ø25–63 мм");

  const sawBlade = findVariant("pilnye-diski", (variant) => variant.sku === "5.1000.200.010");
  assert.equal(getVariantChoicePresentation(sawBlade.product, sawBlade.variant).label, "Ø200 × 1,2 × 32 мм");

  const compressor = findVariant("kompressory", (variant) => variant.sku === "45681472");
  const compressorChoice = getVariantChoicePresentation(compressor.product, compressor.variant);
  assert.equal(compressorChoice.label, "440 л/мин");
  assert.match(compressorChoice.context, /ресивер 100 л/u);
  assert.match(compressorChoice.context, /2,2 кВт/u);
  assert.match(getProductVariantChoices(compressor.product).find((choice) => choice.id === compressor.variant.id).choiceContext, /арт\. 45681472/u);

  const coolant = findVariant("sozh-i-sots", (variant) => variant.sku === "60.1100-050");
  assert.equal(getVariantChoicePresentation(coolant.product, coolant.variant).label, "5 л");

  const loadGrab = findVariant("zahvaty-dlya-gruzov", (variant) => variant.sku === "EML-500");
  assert.equal(getVariantChoicePresentation(loadGrab.product, loadGrab.variant).label, "500 кг");
});

test("magnetic drill cards lead with annular capacity and name twist-drill capacity explicitly", () => {
  const drill = snapshot.products.find((product) => product.slug === "magnitnyy-sverlilnyy-stanok-lenz-steyr-35");
  assert.ok(drill);
  const variant = drill.variants.find((entry) => entry.sku === "STEYR-35");
  assert.ok(variant);
  const choice = getVariantChoicePresentation(drill, variant);
  assert.equal(choice.label, "Корончатое сверление до Ø35 мм");
  assert.match(choice.context, /Спиральное сверление до Ø13 мм/u);
  const specs = getFeedVariantSpecs(drill, variant);
  assert.deepEqual(specs.slice(0, 2), [
    { label:"Макс. Ø корончатого сверления", value:"35 мм" },
    { label:"Макс. Ø спирального сверления", value:"13 мм" },
  ]);
});

test("every variant deep link preserves the exact selection and returns to the selector", () => {
  for (const product of snapshot.products) {
    for (const choice of getProductVariantChoices(product)) {
      const variant = product.variants.find((entry) => entry.id === choice.id);
      assert.ok(variant);
      assert.equal(choice.href, `${publicProductPath(product, variant)}#variants`);
    }
  }
});

test("variant thumbnails appear only for exact visually distinct supplier images", () => {
  const sameImageProduct = structuredClone(annularCutters);
  sameImageProduct.images = ["https://cdn.example.test/group.webp"];
  sameImageProduct.variants = sameImageProduct.variants.slice(0, 3).map((variant) => ({ ...variant, images:["https://cdn.example.test/group.webp"] }));
  const repeatedChoices = getProductVariantChoices(sameImageProduct);
  assert.ok(repeatedChoices.every((choice) => choice.image === "https://cdn.example.test/group.webp"));
  assert.ok(repeatedChoices.every((choice) => choice.selectorImage === undefined));

  const distinctImageProduct = structuredClone(sameImageProduct);
  distinctImageProduct.variants[1].images = ["https://cdn.example.test/execution-b.webp"];
  const distinctChoices = getProductVariantChoices(distinctImageProduct);
  assert.equal(distinctChoices[0].selectorImage, undefined);
  assert.equal(distinctChoices[1].selectorImage, "https://cdn.example.test/execution-b.webp");
  assert.equal(distinctChoices[2].selectorImage, undefined);
  assert.equal(distinctChoices[1].image, "https://cdn.example.test/execution-b.webp");
});

test("product selector explains exact media without filling every size with a duplicate thumbnail", async () => {
  const purchase = await readFile(new URL("../app/ui/FeedProductPurchase.tsx", import.meta.url), "utf8");
  const gallery = await readFile(new URL("../app/ui/FeedProductGallery.tsx", import.meta.url), "utf8");
  assert.match(purchase, /variant\.selectorImage && <Image/u);
  assert.match(purchase, /Миниатюра показана только у исполнения с отличающимся фото поставщика/u);
  assert.match(gallery, /Фото выбранного исполнения/u);
  assert.match(gallery, /Проверенное фото товара из товарной группы — исполнение сверяем по параметрам/u);
});

test("product comparison keeps price columns stable", async () => {
  const comparison = await readFile(new URL("../app/ui/ProductComparisonDialog.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(comparison, /className="product-comparison-commercial"/u);
  assert.match(styles, /product-comparison-scroll table[^}]*table-layout:fixed/u);
  assert.match(styles, /product-comparison-commercial>b[^}]*white-space:nowrap/u);
  assert.doesNotMatch(styles, /product-comparison-commercial-row td \{ display:grid/u);
});

test("selected execution drives every server-rendered product area", async () => {
  const page = await readFile(new URL("../app/product/[slug]/page.tsx", import.meta.url), "utf8");
  assert.match(page, /const primaryVariant = allVariants\.find\(\(variant\) => variant\.id === selectedVariantId\)/u);
  assert.match(page, /primaryVariant\?\.images/u);
  assert.match(page, /getFeedVariantSpecs\(product, primaryVariant\)/u);
  assert.match(page, /formatFeedPrice\(primaryVariant\?\.price\)/u);
  assert.match(page, /id:`variant:\$\{primaryVariant\.id\}`/u);
  assert.match(page, /selectedProductContext/u);
  assert.match(page, /expertProfile\.criteria/u);
  assert.doesNotMatch(page, /Сообщите материал, толщину и глубину отверстия/u);
  assert.match(page, /Спиральное сверление — до Ø\$\{holeDiameter\}/u);
  assert.match(page, /основной рабочий диапазон магнитного станка/u);
  assert.doesNotMatch(page, /Максимальный диаметр отверстия — \$\{holeDiameter\}/u);
});

function findVariant(category, predicate) {
  for (const product of snapshot.products) {
    if (product.category !== category) continue;
    const variant = product.variants.find(predicate);
    if (variant) return { product, variant };
  }
  assert.fail(`Variant fixture not found for ${category}`);
}

function normalize(value) {
  return String(value).toLocaleLowerCase("ru-RU").replace(/ё/gu, "е").replace(/[^a-zа-я0-9]+/giu, " ").trim();
}
