import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { selectCategoryFacets } from "../app/data/categoryExpertProfiles.mjs";
import { buildDrillDiameterOptions } from "../app/data/drillSelection.mjs";
import { getFeedCategoryPage, getPromotedFacetOptions, getPublishedFeedCategorySlugs } from "../app/data/feedCatalog.ts";

test("every generic category selector samples the complete numeric feed range", () => {
  const published = getPublishedFeedCategorySlugs();
  assert.equal(published.length, 24);
  let auditedNumericFacets = 0;

  for (const slug of published.filter((value) => value !== "borfrezy" && value !== "stanki-sverlilnye")) {
    const page = getFeedCategoryPage(slug, { pageSize:1 });
    const facets = selectCategoryFacets(slug, page.facets.filter((facet) => facet.keyword), 3);
    for (const facet of facets.filter((candidate) => candidate.numeric && candidate.options.length > 1)) {
      const choices = getPromotedFacetOptions(facet, 6);
      auditedNumericFacets += 1;
      assert.ok(choices.some((option) => option.value === facet.options[0].value), `${slug}/${facet.label}: minimum`);
      assert.ok(choices.some((option) => option.value === facet.options.at(-1).value), `${slug}/${facet.label}: maximum`);
      assert.ok(choices.every((option) => facet.options.some((source) => source.value === option.value)), `${slug}/${facet.label}: feed values only`);
    }
  }

  assert.ok(auditedNumericFacets >= 25, "the audit must cover numeric choices across the catalog");
});

test("pipe beveler selector includes the actual 2300 mm maximum", () => {
  const page = getFeedCategoryPage("kromkorezy-dlya-trub", { pageSize:1 });
  const facet = selectCategoryFacets("kromkorezy-dlya-trub", page.facets.filter((candidate) => candidate.keyword), 3)
    .find((candidate) => candidate.keyword === "макс. диаметр тру");
  assert.ok(facet);
  const choices = getPromotedFacetOptions(facet, 6);
  assert.deepEqual(choices.map((option) => option.value), ["15", "52", "107", "250", "600", "2300"]);
});

test("drilling selector derives low, middle and 200 mm maximum choices from the feed", () => {
  const facet = getFeedCategoryPage("stanki-sverlilnye", { pageSize:1 }).facets.find((candidate) => candidate.keyword === "макс. диаметр");
  assert.ok(facet);
  const choices = buildDrillDiameterOptions(facet.options, 6, 35);
  assert.equal(choices[0].value, 8);
  assert.equal(choices.at(-1).value, 200);
  assert.ok(choices.some((option) => option.value === 35));
  assert.ok(choices.every((option) => facet.options.some((source) => option.label === `до Ø${source.label}`)));
});

test("category forms render prepared choices, the full range and a path to exact values", async () => {
  const [page, genericSelector, drillSelector, burrSelector] = await Promise.all([
    readFile(new URL("../app/catalog/category/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ui/CategorySelectionAssistant.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ui/DrillSelectionAssistant.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ui/BurrSelectionAssistant.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(page, /getGuidedFacetOptions\(facet, 6, selectedOption \? \[selectedOption\.value\] : \[\]\)/u);
  assert.match(page, /diameterOptions=\{drillDiameterFacet\.options\}/u);
  assert.doesNotMatch(genericSelector, /facet\.options\.slice\(0, 6\)/u);
  assert.match(genericSelector, /Диапазон каталога:/u);
  assert.match(genericSelector, /Другой точный размер — в полном фильтре/u);
  assert.match(drillSelector, /buildDrillDiameterOptions\(diameterOptions, 6, selectedDiameter\)/u);
  assert.match(drillSelector, /Другой размер — в полном фильтре/u);
  assert.match(burrSelector, /shankOptions\.map/u);
});
