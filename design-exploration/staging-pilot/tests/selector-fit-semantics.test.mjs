import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildCategorySelectionContext,
  buildCategorySelectionUrl,
  categorySelectionRules,
  getCategorySelectionRule,
} from "../app/data/categorySelection.mjs";
import { selectCategoryFacets } from "../app/data/categoryExpertProfiles.mjs";
import {
  getFeedCategoryPage,
  getGuidedFacetOptions,
  getPublishedFeedCategorySlugs,
  toFeedProductCardModel,
} from "../app/data/feedCatalog.ts";

const numericValue = (value) => Number.parseFloat(String(value).replace(",", ".").match(/-?\d+(?:\.\d+)?/)?.[0] ?? "NaN");

test("every generic selector facet has an explicit category match rule", () => {
  let audited = 0;
  for (const slug of getPublishedFeedCategorySlugs().filter((value) => value !== "borfrezy" && value !== "stanki-sverlilnye")) {
    const page = getFeedCategoryPage(slug, { pageSize:1 });
    const facets = selectCategoryFacets(slug, page.facets.filter((facet) => facet.keyword), 3);
    for (const facet of facets) {
      audited += 1;
      assert.ok(Object.hasOwn(categorySelectionRules[slug] ?? {}, facet.keyword), `${slug}/${facet.keyword}`);
      assert.match(getCategorySelectionRule(slug, facet.keyword).mode, /^(exact|minimum|range)$/u);
    }
  }
  assert.ok(audited >= 55);
});

test("capacity, exact fit and pipe containment produce distinct query constraints", () => {
  const minimumUrl = new URL(buildCategorySelectionUrl({
    pathname:"/catalog/category/kompressory",
    search:"?sort=relevance&f_spec1=old",
    selections:[{ key:"spec1", value:"1210", mode:"minimum" }],
  }), "https://test.7tool.ru");
  assert.equal(minimumUrl.searchParams.get("min_spec1"), "1210");
  assert.equal(minimumUrl.searchParams.has("f_spec1"), false);

  const exactUrl = new URL(buildCategorySelectionUrl({
    pathname:"/catalog/category/pilnye-diski",
    search:"?min_spec1=100",
    selections:[{ key:"spec1", value:"250 мм", mode:"exact" }],
  }), "https://test.7tool.ru");
  assert.equal(exactUrl.searchParams.get("f_spec1"), "250 мм");
  assert.equal(exactUrl.searchParams.has("min_spec1"), false);

  const rangeUrl = new URL(buildCategorySelectionUrl({
    pathname:"/catalog/category/kromkorezy-dlya-trub",
    selections:[{ key:"spec1", minimumFacetKey:"spec2", value:"600", mode:"range" }],
  }), "https://test.7tool.ru");
  assert.equal(rangeUrl.searchParams.get("min_spec1"), "600");
  assert.equal(rangeUrl.searchParams.get("max_spec2"), "600");
  assert.equal(rangeUrl.searchParams.has("f_spec1"), false);
});

test("pipe containment returns only variants whose supported range includes 600 mm", () => {
  const unfiltered = getFeedCategoryPage("kromkorezy-dlya-trub", { pageSize:6 });
  const maximumFacet = unfiltered.facets.find((facet) => facet.keyword === "макс. диаметр тру");
  const minimumFacet = unfiltered.facets.find((facet) => facet.keyword === "мин. диаметр тру");
  assert.ok(maximumFacet && minimumFacet);
  const result = getFeedCategoryPage("kromkorezy-dlya-trub", {
    numericMinimums:{ [maximumFacet.key]:600 },
    numericMaximums:{ [minimumFacet.key]:600 },
    pageSize:48,
  });
  assert.ok(result.total > 0);
  for (const product of result.products) {
    assert.ok(product.variants.some((variant) => {
      const maximums = valuesFor(variant, maximumFacet.keyword).map(numericValue);
      const minimums = valuesFor(variant, minimumFacet.keyword).map(numericValue);
      return maximums.some((value) => value >= 600) && minimums.some((value) => value <= 600);
    }), product.title);
  }
});

test("compact drill choices exclude tolerance fragments but retain real feed diameters", () => {
  const facet = getFeedCategoryPage("sverla-i-zenkovki", { pageSize:1 }).facets.find((candidate) => candidate.keyword === "диаметр режущей");
  assert.ok(facet);
  const choices = getGuidedFacetOptions(facet, 6);
  assert.ok(choices.some((option) => option.value === "80 мм"));
  assert.ok(choices.every((option) => !/h6|\/\s*[-+−–]/iu.test(option.value)));
  assert.ok(choices.every((option) => numericValue(option.value) > 0));
});

test("card reasons explain lower and upper technical bounds", () => {
  const page = getFeedCategoryPage("kromkorezy-dlya-trub", { pageSize:1 });
  const product = page.products[0];
  const card = toFeedProductCardModel(product, [
    { keyword:"макс. диаметр тру", label:"Макс. диаметр труб", values:[], minimum:600 },
    { keyword:"мин. диаметр тру", label:"Мин. диаметр труб", values:[], maximum:600 },
  ]);
  assert.deepEqual(card.matchReasons, ["Макс. диаметр труб: не менее 600", "Мин. диаметр труб: не более 600"]);
});

test("engineer context states how the selected value will be interpreted", () => {
  const context = buildCategorySelectionContext("Компрессоры", [
    { label:"Производительность", value:"1210", mode:"minimum" },
    { label:"Тип", value:"Винтовой", mode:"exact" },
  ]);
  assert.match(context, /требуется не менее 1210/u);
  assert.match(context, /Тип: Винтовой/u);
});

test("category page preserves maximum constraints and passes selector semantics", async () => {
  const [page, selector] = await Promise.all([
    readFile(new URL("../app/catalog/category/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ui/CategorySelectionAssistant.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(page, /numericMaximums/u);
  assert.match(page, /maximum:numericMaximums\[facet\.key\]/u);
  assert.match(page, /selectionMode:rule\.mode/u);
  assert.match(page, /minimumFacetKey:minimumFacet\?\.key/u);
  assert.match(selector, /mode:facet\.selectionMode \?\? "exact"/u);
  assert.match(selector, /facet\.selectionHint/u);
});

function valuesFor(variant, keyword) {
  const normalizedKeyword = keyword.toLocaleLowerCase("ru-RU");
  return variant.params
    .filter((parameter) => parameter.name.toLocaleLowerCase("ru-RU").includes(normalizedKeyword))
    .map((parameter) => `${parameter.value}${parameter.unit ? ` ${parameter.unit}` : ""}`.trim());
}
