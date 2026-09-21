import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildCategorySelectionContext, buildCategorySelectionUrl } from "../app/data/categorySelection.mjs";
import { categoryExpertProfiles, getCategoryExpertProfileSlugs, selectCategoryAssistantFacets, selectCategoryFacets } from "../app/data/categoryExpertProfiles.mjs";
import { getFeedCategoryPage } from "../app/data/feedCatalog.ts";

test("every published feed category has a complete expert profile", async () => {
  const snapshot = JSON.parse(await readFile(new URL("../../../7tool-source/src/lib/products.json", import.meta.url), "utf8"));
  const published = snapshot.categories.filter((category) => category.published).map((category) => category.slug).sort();
  assert.deepEqual(getCategoryExpertProfileSlugs().sort(), published);
  for (const slug of published) {
    const profile = categoryExpertProfiles[slug];
    assert.ok(profile.heroIntro.length >= 80, `${slug}: hero`);
    assert.ok(profile.selectorTitle.length >= 12, `${slug}: selector title`);
    assert.ok(profile.selectorIntro.length >= 70, `${slug}: selector intro`);
    assert.ok(profile.selectorResult.length >= 65, `${slug}: selector result`);
    assert.ok(profile.facetKeywords.length >= 4, `${slug}: facets`);
    assert.ok(profile.promotedFacetKeywords.length >= 3, `${slug}: promoted facets`);
    assert.ok(profile.criteria.length >= 5, `${slug}: criteria`);
    assert.ok(profile.emptyCopy.length >= 70, `${slug}: empty state`);
    assert.ok(profile.selectionMode === undefined || profile.selectionMode === "engineer", `${slug}: selection mode`);
  }
});

test("expert facet ranking follows category intent and never invents options", () => {
  const facets = [
    { key:"brand", label:"Производитель", options:[{ value:"A", label:"A", count:1 }] },
    { key:"spec1", label:"Диаметр диска", keyword:"диаметр диска", options:[{ value:"250 мм", label:"250 мм", count:3 }] },
    { key:"spec2", label:"Материал", keyword:"материал", options:[{ value:"Сталь", label:"Сталь", count:2 }] },
    { key:"spec3", label:"Посадочное отверстие", keyword:"посадочное отверстие", options:[{ value:"32 мм", label:"32 мм", count:4 }] },
  ];
  const selected = selectCategoryFacets("pilnye-diski", facets, 3);
  assert.deepEqual(selected.map((facet) => facet.key), ["spec1", "spec3", "spec2"]);
  assert.ok(selected.every((facet) => facets.includes(facet)));
});

test("sheet beveler quick filters prioritize manufacturer while guided selection uses populated task facets", () => {
  const page = getFeedCategoryPage("kromkorezy-po-listu", { pageSize:48 });
  const promoted = selectCategoryFacets("kromkorezy-po-listu", page.facets, 2);
  const guided = selectCategoryFacets("kromkorezy-po-listu", page.facets.filter((facet) => facet.keyword), 3);

  assert.deepEqual(promoted.map((facet) => facet.key), ["brand", "spec1"]);
  assert.deepEqual(guided.map((facet) => facet.keyword), ["макс. ширина фаски", "возможности", "тип"]);
  assert.ok(guided.every((facet) => facet.options.length > 0));
});

test("serial categories ask the most useful feed-backed questions first", () => {
  const cases = {
    "rezbonareznye-manipulyatory":["макс. резьба", "охват рабочей зоны", "частота вращения"],
    truborezy:["макс. диаметр тру", "макс. толщина стен"],
    kompressory:["производительность", "мощность", "объем ресивера"],
    "sverla-i-zenkovki":["диаметр режущей", "материал", "диаметр хвостовика"],
  };

  for (const [slug, expected] of Object.entries(cases)) {
    const page = getFeedCategoryPage(slug, { pageSize:48 });
    const guided = selectCategoryAssistantFacets(slug, page.facets.filter((facet) => facet.keyword));
    assert.deepEqual(guided.map((facet) => facet.keyword), expected, slug);
  }
});

test("project and heterogeneous categories use an engineer-first selection mode", async () => {
  for (const slug of ["stanki-lazernoy-rezki", "svarochnye-roboty", "shlifovalnoe-i-zatochnoe-oborudovanie"]) {
    assert.equal(categoryExpertProfiles[slug].selectionMode, "engineer", slug);
    const page = getFeedCategoryPage(slug, { pageSize:48 });
    assert.deepEqual(selectCategoryAssistantFacets(slug, page.facets.filter((facet) => facet.keyword)), [], slug);
  }
  const [page, selector] = await Promise.all([
    readFile(new URL("../app/catalog/category/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ui/CategorySelectionAssistant.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(page, /profile\.selectionMode === "engineer"/u);
  assert.match(page, /selectCategoryAssistantFacets\(slug, technicalFacets\)/u);
  assert.match(page, /Передать задачу инженеру/u);
  assert.match(selector, /facets\.length > 0 \? "Подбор без артикула" : "Инженерный подбор"/u);
  assert.match(selector, /facets\.length > 0 \? "Подобрать за минуту" : "Передать задачу"/u);
});

test("generic guided selection replaces only its own filters and keeps commercial context", () => {
  const url = buildCategorySelectionUrl({
    pathname:"/catalog/category/kompressory",
    search:"?availability=in-stock&sort=relevance&page=3&f_spec1=old&f_brand=Fubag",
    selections:[{ key:"spec1", value:"440" }, { key:"spec2", value:"100" }],
  });
  const parsed = new URL(url, "https://test.7tool.ru");
  assert.equal(parsed.hash, "#products");
  assert.equal(parsed.searchParams.get("availability"), "in-stock");
  assert.equal(parsed.searchParams.get("sort"), "relevance");
  assert.equal(parsed.searchParams.get("f_brand"), "Fubag");
  assert.equal(parsed.searchParams.get("f_spec1"), "440");
  assert.equal(parsed.searchParams.get("f_spec2"), "100");
  assert.equal(parsed.searchParams.has("page"), false);
});

test("engineer context contains product parameters but no customer data", () => {
  const context = buildCategorySelectionContext("Компрессоры", [
    { label:"Производительность", value:"440 л/мин" },
    { label:"Мощность", value:"" },
  ]);
  assert.match(context, /Компрессоры/u);
  assert.match(context, /440 л\/мин/u);
  assert.doesNotMatch(context, /телефон|email|имя клиента/iu);
});
