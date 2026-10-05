import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  getFeedCategoryPage,
  getFeedCategoryRecoverySuggestions,
  getGuidedFacetOptions,
  getPublishedFeedCategorySlugs,
} from "../app/data/feedCatalog.ts";
import { selectCategoryAssistantFacets } from "../app/data/categoryExpertProfiles.mjs";
import {
  buildCategoryQueryContext,
  buildCategorySelectionUrl,
  getCategorySelectionRule,
  parseCategorySelectionNumber,
} from "../app/data/categorySelection.mjs";

const specialSelectors = new Set(["borfrezy", "stanki-sverlilnye"]);
const scenarioAudit = buildScenarioAudit();

test(`feed-grounded selection matrix covers ${scenarioAudit.length} scenarios across all 24 categories`, () => {
  const slugs = getPublishedFeedCategorySlugs();
  assert.equal(slugs.length, 24);
  assert.deepEqual(new Set(scenarioAudit.map((scenario) => scenario.slug)), new Set(slugs));
  for (const scenario of scenarioAudit) {
    assert.ok(scenario.resultCount > 0, `${scenario.slug}: ${scenario.label} returned no compatible product family`);
  }
});

test("every structured category exposes at least one scenario that materially narrows its assortment", () => {
  for (const slug of getPublishedFeedCategorySlugs()) {
    const total = getFeedCategoryPage(slug, { pageSize:48 }).total;
    const scenarios = scenarioAudit.filter((scenario) => scenario.slug === slug && scenario.label !== "manual engineer handoff");
    if (scenarios.length === 0 || total <= 1) continue;
    assert.ok(scenarios.some((scenario) => scenario.resultCount < total), `${slug}: guided questions do not narrow the current assortment`);
  }
});

test("every filterable category can recover from an impossible condition without discarding the whole task", () => {
  for (const slug of getPublishedFeedCategorySlugs()) {
    const page = getFeedCategoryPage(slug, { pageSize:48 });
    const facet = page.facets.find((candidate) => candidate.keyword) ?? page.facets[0];
    if (!facet) continue;
    const query = { filters:{ [facet.key]:["__not_in_feed__"] } };
    assert.equal(getFeedCategoryPage(slug, query).total, 0, `${slug}: invalid value should create a zero-result state`);
    const suggestions = getFeedCategoryRecoverySuggestions(slug, query);
    assert.ok(suggestions.some((suggestion) => suggestion.removeKeys.includes(`f_${facet.key}`) && suggestion.resultCount > 0), `${slug}: missing a safe one-step recovery`);
  }
});

test("pipe range recovery removes both boundaries as one customer condition", () => {
  const page = getFeedCategoryPage("kromkorezy-dlya-trub", { pageSize:48 });
  const maximumFacet = page.facets.find((facet) => facet.keyword === "макс. диаметр тру");
  const minimumFacet = page.facets.find((facet) => facet.keyword === "мин. диаметр тру");
  assert.ok(maximumFacet && minimumFacet);
  const query = { numericMinimums:{ [maximumFacet.key]:5000 }, numericMaximums:{ [minimumFacet.key]:5000 } };
  assert.equal(getFeedCategoryPage("kromkorezy-dlya-trub", query).total, 0);
  const suggestion = getFeedCategoryRecoverySuggestions("kromkorezy-dlya-trub", query, 5)
    .find((candidate) => candidate.removeKeys.includes(`min_${maximumFacet.key}`));
  assert.ok(suggestion);
  assert.deepEqual(new Set(suggestion.removeKeys), new Set([`min_${maximumFacet.key}`, `max_${minimumFacet.key}`]));
  assert.ok(suggestion.resultCount > 0);
});

test("engineer handoff keeps selected technical context but contains no customer data", () => {
  const page = getFeedCategoryPage("kompressory", { pageSize:48 });
  const performance = page.facets.find((facet) => facet.keyword === "производительность");
  assert.ok(performance);
  const context = buildCategoryQueryContext("Компрессоры", page.facets, {
    search:"винтовой",
    availability:"in-stock",
    numericMinimums:{ [performance.key]:1210 },
  });
  assert.match(context, /Компрессоры/u);
  assert.match(context, /не менее 1210/u);
  assert.match(context, /подтверждённое наличие/u);
  assert.doesNotMatch(context, /телефон|email|почт.*@/iu);
});

test("category result UI explains exact, shortlist, broad and zero-result next steps", async () => {
  const [page, guidance, styles] = await Promise.all([
    readFile(new URL("../app/catalog/category/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ui/CategoryResultGuidance.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /getFeedCategoryRecoverySuggestions/u);
  assert.match(page, /Не нужно начинать подбор заново/u);
  assert.match(page, /Не ослаблять требования — передать инженеру/u);
  assert.match(page, /removeKeys:suggestion\.removeKeys/u);
  assert.match(guidance, /Точное товарное семейство/u);
  assert.match(guidance, /Короткий список/u);
  assert.match(guidance, /Выбор всё ещё широкий/u);
  assert.match(styles, /\.feed-result-guidance p \{[^}]*font-size:14px/us);
  assert.match(styles, /\.feed-recovery-options>a \{[^}]*font-size:14px/us);
});

function buildScenarioAudit() {
  const scenarios = [];
  for (const slug of getPublishedFeedCategorySlugs()) {
    const page = getFeedCategoryPage(slug, { pageSize:48 });
    const technicalFacets = page.facets.filter((facet) => facet.keyword);
    const selectedFacets = selectCategoryAssistantFacets(slug, technicalFacets);
    if (selectedFacets.length === 0) {
      scenarios.push({ slug, label:"manual engineer handoff", resultCount:page.total });
      continue;
    }

    for (const facet of selectedFacets) {
      const rule = specialSelectors.has(slug) ? getSpecialSelectorRule(slug, facet.keyword) : getCategorySelectionRule(slug, facet.keyword);
      const options = getGuidedFacetOptions(facet, 6);
      const points = Array.from(new Set([options[0], options[Math.floor(options.length / 2)], options.at(-1)].filter(Boolean)));
      const minimumFacet = rule.mode === "range" ? technicalFacets.find((candidate) => candidate.keyword === rule.minimumKeyword) : undefined;
      for (const option of points) {
        const url = buildCategorySelectionUrl({
          pathname:`/c/${slug}`,
          selections:[{ key:facet.key, value:option.value, mode:rule.mode, minimumFacetKey:minimumFacet?.key }],
        });
        const result = getFeedCategoryPage(slug, queryFromSelectionUrl(url));
        scenarios.push({ slug, label:`${facet.label}: ${option.label}`, resultCount:result.total });
      }
    }
  }
  return scenarios;
}

function getSpecialSelectorRule(slug, keyword) {
  if (slug === "stanki-sverlilnye" && keyword === "макс. диаметр") return { mode:"minimum" };
  return getCategorySelectionRule(slug, keyword);
}

function queryFromSelectionUrl(value) {
  const url = new URL(value, "https://example.test");
  const filters = {};
  const numericMinimums = {};
  const numericMaximums = {};
  for (const [key, item] of url.searchParams) {
    if (key.startsWith("f_")) (filters[key.slice(2)] ??= []).push(item);
    if (key.startsWith("min_")) numericMinimums[key.slice(4)] = parseCategorySelectionNumber(item);
    if (key.startsWith("max_")) numericMaximums[key.slice(4)] = parseCategorySelectionNumber(item);
  }
  return { filters, numericMinimums, numericMaximums };
}
