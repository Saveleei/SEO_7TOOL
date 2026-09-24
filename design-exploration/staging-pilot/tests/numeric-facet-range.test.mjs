import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  getFeedCategoryPage,
  getFeedCategoryProductCountForQuery,
  getPromotedFacetOptions,
  getPublishedFeedCategorySlugs,
} from "../app/data/feedCatalog.ts";

const numericValue = (value) => Number.parseFloat(String(value).replace(",", ".").match(/-?\d+(?:\.\d+)?/)?.[0] ?? "NaN");

test("pipe beveler diameter exposes the actual 15–2300 mm feed range", () => {
  const page = getFeedCategoryPage("kromkorezy-dlya-trub", { pageSize:6 });
  const facet = page.facets.find((item) => item.keyword === "макс. диаметр тру");
  assert.ok(facet);
  assert.equal(facet.numeric, true);
  assert.equal(numericValue(facet.options[0].value), 15);
  assert.equal(numericValue(facet.options.at(-1).value), 2300);
  assert.ok(facet.options.some((option) => option.value === "80"));
  assert.ok(facet.options.length > 10, "the complete range must not be reduced to popularity leaders");
});

test("promoted numeric choices sample the whole range and preserve a selected value", () => {
  const facet = getFeedCategoryPage("kromkorezy-dlya-trub", { pageSize:6 }).facets.find((item) => item.keyword === "макс. диаметр тру");
  assert.ok(facet);
  const promoted = getPromotedFacetOptions(facet, 5);
  assert.equal(promoted.length, 5);
  assert.equal(numericValue(promoted[0].value), 15);
  assert.equal(numericValue(promoted.at(-1).value), 2300);

  const withSelection = getPromotedFacetOptions(facet, 5, ["80"]);
  assert.ok(withSelection.some((option) => option.value === "80"));
  assert.equal(numericValue(withSelection.at(-1).value), 2300);
});

test("numeric facets stay ordered and keep both endpoints across categories", () => {
  for (const slug of getPublishedFeedCategorySlugs()) {
    const page = getFeedCategoryPage(slug, { pageSize:6 });
    for (const facet of page.facets.filter((item) => item.numeric)) {
      const values = facet.options.map((option) => numericValue(option.value));
      assert.ok(values.every(Number.isFinite), `${slug}/${facet.label}: numeric values`);
      assert.deepEqual(values, [...values].sort((first, second) => first - second), `${slug}/${facet.label}: ascending range`);
    }
  }
});

test("the maximum pipe range remains filterable", () => {
  const page = getFeedCategoryPage("kromkorezy-dlya-trub", { pageSize:6 });
  const facet = page.facets.find((item) => item.keyword === "макс. диаметр тру");
  assert.ok(facet);
  const result = getFeedCategoryPage("kromkorezy-dlya-trub", { filters:{ [facet.key]:["2300"] }, pageSize:6 });
  assert.ok(result.total > 0);
  assert.ok(result.products.some((product) => product.title.includes("SDD-2300")));
});

test("promoted and full numeric filters remain visible without horizontal clipping", async () => {
  const page = await readFile(new URL("../app/catalog/category/[slug]/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(page, /getPromotedFacetOptions\(facet, promotedOptionLimit, filters\[facet\.key\], preferredOptions\)/u);
  assert.match(page, /facet\.keyword === "рабочая длина" \? \["110 мм"\] : \[\]/u);
  assert.match(page, /диапазон \{rangeStart\}–\{rangeEnd\}/u);
  assert.match(page, /feed-numeric-filter/u);
  assert.match(page, /Диапазон фида:/u);
  assert.match(styles, /\.feed-promoted-filters>div>div \{[^}]*flex-wrap:wrap[^}]*overflow:visible/us);
  assert.match(styles, /\.feed-filter-panel \.feed-numeric-filter>div \{[^}]*max-height:285px[^}]*overflow:auto/us);
});

test("high-cardinality dimensions use a bounded range control instead of hundreds of checkboxes", async () => {
  const category = getFeedCategoryPage("sverla-i-zenkovki", { pageSize:6 });
  assert.ok(category.facets.some((facet) => facet.numeric && facet.options.length > 40));

  const [page, styles] = await Promise.all([
    readFile(new URL("../app/catalog/category/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /HIGH_CARDINALITY_NUMERIC_OPTIONS = 40/u);
  assert.match(page, /className="feed-numeric-range"/u);
  assert.match(page, /name=\{`min_\$\{facet\.key\}`\}/u);
  assert.match(page, /name=\{`max_\$\{facet\.key\}`\}/u);
  assert.match(page, /selectedOptions\.map/u);
  assert.match(styles, /\.feed-filter-panel \.feed-numeric-filter>\.feed-numeric-range \{[^}]*grid-template-columns:repeat\(2/us);
});

test("assortment counters reuse the ranked category without rebuilding every facet", async () => {
  const queries = [
    { family:"drills" },
    { family:"countersinks" },
    { search:"ступенчат" },
  ];
  for (const query of queries) {
    assert.equal(
      getFeedCategoryProductCountForQuery("sverla-i-zenkovki", query),
      getFeedCategoryPage("sverla-i-zenkovki", { ...query, pageSize:6 }).total,
    );
  }
  const page = await readFile(new URL("../app/catalog/category/[slug]/page.tsx", import.meta.url), "utf8");
  assert.match(page, /getFeedCategoryProductCountForQuery/u);
  assert.doesNotMatch(page, /count:getFeedCategoryPage\(slug/u);
});
