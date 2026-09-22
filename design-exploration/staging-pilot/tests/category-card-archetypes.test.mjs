import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  categoryCardArchetypes,
  getCategoryCardArchetype,
  getCategoryCardArchetypeSlugs,
  pluralizeCardVariants,
} from "../app/data/categoryCardArchetypes.mjs";
import {
  getFeedCategoryPage,
  getFeedCategoryProductType,
  getFeedTableColumns,
  getPublishedFeedCategorySlugs,
  prefersDenseFeedTable,
  toFeedProductCardModel,
} from "../app/data/feedCatalog.ts";

test("every published category has an explicit buying-archetype", () => {
  assert.deepEqual(
    [...getCategoryCardArchetypeSlugs()].sort(),
    [...getPublishedFeedCategorySlugs()].sort(),
  );
  for (const slug of getPublishedFeedCategorySlugs()) {
    const profile = getCategoryCardArchetype(slug);
    assert.ok(categoryCardArchetypes[profile.id], `${slug}: unknown archetype`);
    assert.equal(profile.variantForms.length, 3, `${slug}: Russian variant forms`);
    for (const key of ["badge", "singleAction", "multipleAction", "detailAction", "tableIdentity", "priceRequestNote"]) {
      assert.ok(profile[key]?.trim(), `${slug}: ${key}`);
    }
  }
});

test("archetypes follow the industrial buying decision", () => {
  assert.equal(getCategoryCardArchetype("kompressory").id, "machine");
  assert.equal(getCategoryCardArchetype("borfrezy").id, "precision-tooling");
  assert.equal(getCategoryCardArchetype("sozh-i-sots").id, "process-supply");
  assert.equal(getCategoryCardArchetype("stanki-lazernoy-rezki").id, "project-system");
  assert.equal(getCategoryCardArchetype("stanochnaya-osnastka").id, "fixtures");
});

test("product cards explain selected feed filters", () => {
  const slug = "borfrezy";
  const initial = getFeedCategoryPage(slug, { pageSize:12 });
  const facet = initial.facets.find((item) => item.keyword && item.options.length > 0);
  assert.ok(facet);
  const option = facet.options[0];
  const filtered = getFeedCategoryPage(slug, { filters:{ [facet.key]:[option.value] }, pageSize:12 });
  assert.ok(filtered.products.length > 0);
  const card = toFeedProductCardModel(filtered.products[0], [{ keyword:facet.keyword, label:facet.label, values:[option.value] }]);
  assert.ok(card.matchReasons.includes(`${facet.label}: ${option.value}`));
  assert.equal(card.cardArchetype.id, "precision-tooling");
});

test("cards with sparse feed data provide category-specific clarification prompts", () => {
  const product = getFeedCategoryPage("stanochnaya-osnastka", { pageSize:6 }).products[0];
  const card = toFeedProductCardModel(product);
  assert.equal(card.specs.length, 0);
  assert.equal(card.cardArchetype.id, "fixtures");
  assert.equal(card.decisionPrompts.length, 3);
  assert.ok(card.decisionPrompts.every(Boolean));
  assert.equal(prefersDenseFeedTable("stanochnaya-osnastka"), false);
});

test("bandsaw options use compatibility-first fixture cards", () => {
  const product = getFeedCategoryPage("lentochnopilnye-stanki", { productType:"accessories", pageSize:6 }).products[0];
  assert.equal(getFeedCategoryProductType("lentochnopilnye-stanki", product), "accessories");
  const card = toFeedProductCardModel(product, [], false, "fixtures");
  assert.equal(card.cardArchetype.id, "fixtures");
  assert.deepEqual(card.decisionPrompts, ["Модель станка", "Назначение", "Интерфейс"]);
});

test("laser project cards identify the workpiece class before technical comparison", () => {
  for (const [segment, label] of [["sheet", "Для листового металла"], ["tube", "Для труб и профиля"], ["combined", "Лист + труба"], ["special", "Специальная задача"]]) {
    const product = getFeedCategoryPage("stanki-lazernoy-rezki", { segment, pageSize:6 }).products[0];
    const card = toFeedProductCardModel(product);
    assert.equal(card.cardArchetype.id, "project-system");
    assert.equal(card.taskLabel, label);
  }
});

test("robotics project cards explain the actual process and ask process-specific questions", () => {
  const expectations = [
    ["robot", "Отдельный робот", "Охват"],
    ["welding-cell", "Сварочная ячейка", "Швы"],
    ["laser-processing", "Лазерный процесс", "Материал"],
    ["surface-finishing", "Обработка поверхности", "Операция"],
  ];
  for (const [segment, label, criterion] of expectations) {
    const product = getFeedCategoryPage("svarochnye-roboty", { segment, pageSize:6 }).products.find((candidate) => toFeedProductCardModel(candidate).specs.length < 2);
    assert.ok(product, `${segment}: sparse project card`);
    const card = toFeedProductCardModel(product);
    assert.equal(card.taskLabel, label);
    assert.ok(card.decisionPrompts.includes(criterion), `${segment}: ${criterion}`);
  }
});

test("multi-variant numeric specs use a natural range instead of arbitrary feed order", () => {
  const product = getFeedCategoryPage("koronchatye-sverla", { pageSize:6 }).products.find((item) => item.title.includes("LZTS"));
  assert.ok(product);
  const card = toFeedProductCardModel(product);
  const diameter = card.specs.find((spec) => spec.label === "Диаметр режущей части");
  assert.ok(diameter);
  assert.match(diameter.value, /^12–\d+ мм · 49 вариантов$/u);
  assert.doesNotMatch(diameter.value, /\+\d+$/u);
});

test("dense tables choose decision columns that are actually populated", () => {
  const cutters = getFeedCategoryPage("koronchatye-sverla", { pageSize:48 }).products.map((product) => toFeedProductCardModel(product));
  assert.deepEqual(getFeedTableColumns(cutters), ["Диаметр режущей части", "Рабочая длина", "Материал режущей части"]);

  const sawBlades = getFeedCategoryPage("pilnye-diski", { pageSize:48 }).products.map((product) => toFeedProductCardModel(product));
  const sawBladeColumns = getFeedTableColumns(sawBlades);
  assert.ok(sawBladeColumns.includes("Число зубьев"));
  assert.ok(!sawBladeColumns.includes("Кол-во и форма зубьев"));

  for (const slug of ["koronchatye-sverla", "borfrezy", "pilnye-diski", "metchiki", "sozh-i-sots", "sverla-i-zenkovki"]) {
    const cards = getFeedCategoryPage(slug, { pageSize:48 }).products.map((product) => toFeedProductCardModel(product));
    const columns = getFeedTableColumns(cards);
    const cells = cards.length * columns.length;
    const populated = cards.reduce((count, card) => count + columns.filter((column) => card.specs.some((spec) => spec.label === column)).length, 0);
    assert.ok(columns.length > 0, `${slug}: at least one comparison column`);
    assert.ok(populated / cells >= 0.79, `${slug}: table columns should be at least 79% populated`);
  }
});

test("an exact filtered execution is actionable without another reveal", async () => {
  const card = await readFile(new URL("../app/ui/FeedProductCard.tsx", import.meta.url), "utf8");
  const table = await readFile(new URL("../app/ui/FeedProductTable.tsx", import.meta.url), "utf8");
  const requestCart = await readFile(new URL("../app/ui/RequestCart.tsx", import.meta.url), "utf8");
  assert.match(card, /product\.selectedVariantCount === 1 \? product\.variants\[0\]/u);
  assert.match(table, /product\.selectedVariantCount === 1 \? product\.variants\[0\]/u);
  assert.match(card, /product\.matchReasons\.length > 0/u);
  assert.match(card, /feed-product-specs--fallback/u);
  assert.match(card, /product\.specs\.length >= 2/u);
  assert.match(card, /Один параметр подтверждён в фиде/u);
  assert.match(card, /Комплектация определяется по задаче/u);
  assert.match(card, /Для расчёта проекта нужны/u);
  assert.match(table, /feed-mobile-series--direct/u);
  assert.match(requestCart, /added \? "Добавлено · ещё \+1"/u);
  assert.match(requestCart, /aria-live="polite"/u);
});

test("variant labels use Russian singular and plural forms", () => {
  const forms = categoryCardArchetypes["precision-tooling"].variantForms;
  assert.equal(pluralizeCardVariants(1, forms), "1 типоразмер");
  assert.equal(pluralizeCardVariants(2, forms), "2 типоразмера");
  assert.equal(pluralizeCardVariants(11, forms), "11 типоразмеров");
});
