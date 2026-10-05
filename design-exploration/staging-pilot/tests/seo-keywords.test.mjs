import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getPublishedFeedCatalogSnapshot } from "../app/data/feedCatalog.ts";
import { getLegacySubcategoriesForCategory } from "../app/data/legacySubcategories.ts";
import { createPublicMetadata } from "../app/data/seo.ts";
import {
  buildBrandSeoKeywords,
  buildCategorySeoKeywords,
  buildProductSeoKeywords,
  buildSubcategorySeoKeywords,
  buildTaskSeoKeywords,
  normalizeSeoKeywords,
} from "../app/data/seoKeywords.ts";

test("SEO keywords are normalized, deduplicated, and bounded", () => {
  const keywords = normalizeSeoKeywords([
    "  Свёрла   по металлу ",
    "СВЕРЛА ПО МЕТАЛЛУ",
    "магнитные, станки\n",
    "резьбонарезные; станки",
    ...Array.from({ length:10 }, (_, index) => `запрос ${index}`),
  ]);
  assert.deepEqual(keywords.slice(0, 3), ["Свёрла по металлу", "магнитные станки", "резьбонарезные станки"]);
  assert.equal(keywords.length, 6);
  assert.ok(keywords.every((keyword) => !/[,;|\r\n]/u.test(keyword)));
  assert.ok(keywords.join(", ").length <= 420);
});

test("the drilling parent owns only the generic commercial cluster", () => {
  const keywords = buildCategorySeoKeywords({
    slug:"stanki-sverlilnye",
    title:"Станки сверлильные",
    h1:"Сверлильные станки по металлу",
  });
  assert.deepEqual(keywords, [
    "сверлильные станки по металлу",
    "сверлильные станки",
    "промышленные сверлильные станки",
    "станки для сверления металла",
    "купить сверлильные станки по металлу",
    "сверлильные станки по металлу цена",
  ]);
  assert.equal(keywords.some((keyword) => /магнит|стационар|реверс|резьбонарез|weldon|бесщеточ/iu.test(keyword)), false);
});

test("dedicated drilling subcategories own their narrow intent without exact parent duplicates", () => {
  const parentKeywords = new Set(buildCategorySeoKeywords({
    slug:"stanki-sverlilnye",
    title:"Станки сверлильные",
    h1:"Сверлильные станки по металлу",
  }).map(keywordIdentity));
  const landings = getLegacySubcategoriesForCategory("stanki-sverlilnye");
  assert.ok(landings.length >= 6);
  const clusters = landings.map((landing) => {
    const keywords = buildSubcategorySeoKeywords({ title:landing.title, h1:landing.h1 });
    assert.ok(keywords.length >= 3, landing.slug);
    assert.equal(keywords.some((keyword) => parentKeywords.has(keywordIdentity(keyword))), false, landing.slug);
    return keywords.map(keywordIdentity).join("|");
  });
  assert.equal(new Set(clusters).size, clusters.length);
  const magnetic = landings.find((landing) => landing.slug === "magnitnye");
  assert.ok(magnetic);
  assert.ok(buildSubcategorySeoKeywords({ title:magnetic.title, h1:magnetic.h1 }).some((keyword) => /магнит/iu.test(keyword)));
});

test("all published category clusters are distinct, short, and free of duplicates", () => {
  const categories = getPublishedFeedCatalogSnapshot().categories.filter((category) => category.published);
  const clusters = categories.map((category) => {
    const keywords = buildCategorySeoKeywords(category);
    assert.ok(keywords.length >= 4 && keywords.length <= 6, category.slug);
    assert.equal(new Set(keywords.map(keywordIdentity)).size, keywords.length, category.slug);
    assert.ok(keywords.join(", ").length <= 420, category.slug);
    return keywords.map(keywordIdentity).join("|");
  });
  assert.equal(new Set(clusters).size, clusters.length);
});

test("brand, product, and task builders keep page-specific commercial intent", () => {
  assert.deepEqual(buildBrandSeoKeywords({ brand:"Euroboor", categories:["Станки сверлильные"] }).slice(0, 4), [
    "Euroboor",
    "Euroboor купить",
    "оборудование Euroboor",
    "инструмент Euroboor",
  ]);
  const productKeywords = buildProductSeoKeywords({ title:"Магнитный сверлильный станок ECO.40S+", brand:"Euroboor", sku:"ECO.40S+" });
  assert.ok(productKeywords.includes("Euroboor ECO.40S+"));
  assert.ok(productKeywords.includes("ECO.40S+"));
  const taskKeywords = buildTaskSeoKeywords({ title:"Сверление и резьба", categories:["Сверлильные станки", "Корончатые свёрла"] });
  assert.ok(taskKeywords.includes("Сверление и резьба"));
  assert.ok(taskKeywords.includes("Сверлильные станки"));
});

test("noindex metadata omits keywords even when a caller supplies them", () => {
  const previous = process.env.SEO_INDEXING_ENABLED;
  process.env.SEO_INDEXING_ENABLED = "1";
  try {
    const indexable = createPublicMetadata({ title:"Категория", description:"Описание", path:"/c/example", keywords:["ключевая фраза"] });
    assert.deepEqual(indexable.keywords, ["ключевая фраза"]);
    const noindex = createPublicMetadata({ title:"Фильтр", description:"Описание", path:"/c/example", indexable:false, keywords:["ключевая фраза"] });
    assert.equal(Object.hasOwn(noindex, "keywords"), false);
    delete process.env.SEO_INDEXING_ENABLED;
    const staging = createPublicMetadata({ title:"Категория", description:"Описание", path:"/c/example", keywords:["ключевая фраза"] });
    assert.equal(Object.hasOwn(staging, "keywords"), false);
  } finally {
    if (previous === undefined) delete process.env.SEO_INDEXING_ENABLED;
    else process.env.SEO_INDEXING_ENABLED = previous;
  }
});

test("commercial templates use typed keyword builders instead of request parameters", async () => {
  const sources = await Promise.all([
    readFile(new URL("../app/catalog/category/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/c/[slug]/[subslug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/brand/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/product/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/catalog/task/[task]/page.tsx", import.meta.url), "utf8"),
  ]);
  const builders = ["buildCategorySeoKeywords", "buildSubcategorySeoKeywords", "buildBrandSeoKeywords", "buildProductSeoKeywords", "buildTaskSeoKeywords"];
  sources.forEach((source, index) => {
    assert.match(source, new RegExp(`keywords:${builders[index]}\\(`, "u"));
    assert.doesNotMatch(source, /keywords:[^\n]*(?:rawSearchParams|searchParams)/u);
  });
});

function keywordIdentity(value) {
  return value.toLocaleLowerCase("ru-RU").replace(/ё/gu, "е");
}
