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

test("cut-off saw diameter combines both supplier parameter names", () => {
  const page = getFeedCategoryPage("disko-otreznye-stanki", { pageSize:48 });
  const facets = selectCategoryAssistantFacets("disko-otreznye-stanki", page.facets.filter((facet) => facet.keyword));
  const diameter = facets[0];
  assert.equal(diameter.keyword, "диаметр");
  assert.ok(diameter.options.some((option) => option.value === "275"));
  assert.ok(diameter.options.some((option) => option.value === "355"));
  assert.ok(getFeedCategoryPage("disko-otreznye-stanki", { filters:{ [diameter.key]:["275"] }, pageSize:48 }).total > 0);
  assert.ok(getFeedCategoryPage("disko-otreznye-stanki", { filters:{ [diameter.key]:["355"] }, pageSize:48 }).total > 0);
});

test("mixed diamond drilling assortment exposes complete feed-backed entry points", async () => {
  const profile = categoryExpertProfiles["almaznoe-burenie"];
  const total = getFeedCategoryPage("almaznoe-burenie", { pageSize:48 }).total;
  const counts = profile.assortmentShortcuts.map((shortcut) => getFeedCategoryPage("almaznoe-burenie", { search:shortcut.query, pageSize:48 }).total);
  assert.deepEqual(profile.assortmentShortcuts.map((shortcut) => shortcut.label), ["Установки алмазного бурения", "Ручные дрели", "Алмазные коронки"]);
  assert.ok(counts.every((count) => count > 0));
  assert.equal(counts.reduce((sum, count) => sum + count, 0), total);
  const page = await readFile(new URL("../app/catalog/category/[slug]/page.tsx", import.meta.url), "utf8");
  assert.match(page, /category-assortment-shortcuts/u);
  assert.match(page, /shortcut\.count\.toLocaleString\("ru-RU"\)/u);
});

test("mixed drills and countersinks assortment exposes feed-backed product types", () => {
  const profile = categoryExpertProfiles["sverla-i-zenkovki"];
  const labels = profile.assortmentShortcuts.map((shortcut) => shortcut.label);
  const counts = profile.assortmentShortcuts.map((shortcut) => getFeedCategoryPage("sverla-i-zenkovki", { search:shortcut.query, pageSize:48 }).total);

  assert.deepEqual(labels, ["Свёрла", "Зенковки", "Цековки", "Термосверление Thermdrill", "Зенкеры"]);
  assert.ok(counts.every((count) => count > 0));
  assert.ok(counts[0] > counts[1]);
  assert.ok(counts[1] > counts[2]);
});

test("category search treats Russian spellings with е and ё equally", () => {
  const withE = getFeedCategoryPage("sverla-i-zenkovki", { search:"сверл", pageSize:48 });
  const withYo = getFeedCategoryPage("sverla-i-zenkovki", { search:"свёрл", pageSize:48 });

  assert.ok(withE.total > 0);
  assert.equal(withYo.total, withE.total);
  assert.deepEqual(withYo.products.map((product) => product.id), withE.products.map((product) => product.id));
});

test("bandsaw category separates equipment from options without losing supplier positions", async () => {
  const slug = "lentochnopilnye-stanki";
  const profile = categoryExpertProfiles[slug];
  const all = getFeedCategoryPage(slug, { pageSize:48 });
  const equipment = getFeedCategoryPage(slug, { productType:"equipment", pageSize:48 });
  const accessories = getFeedCategoryPage(slug, { productType:"accessories", pageSize:48 });
  const guided = selectCategoryAssistantFacets(slug, equipment.facets.filter((facet) => facet.keyword));

  assert.equal(profile.defaultProductType, "equipment");
  assert.deepEqual(profile.assortmentShortcuts.map((shortcut) => shortcut.label), ["Ленточнопильные станки", "Оснастка и опции"]);
  assert.equal(equipment.total + accessories.total, all.total);
  assert.equal(equipment.total, 201);
  assert.equal(accessories.total, 100);
  assert.deepEqual(guided.map((facet) => facet.keyword), ["тип исполнения", "макс. диаметр круглого профиля при резке 90", "макс. ширина заготовки"]);
  assert.ok(accessories.facets.every((facet) => !facet.keyword));

  const page = await readFile(new URL("../app/catalog/category/[slug]/page.tsx", import.meta.url), "utf8");
  assert.match(page, /profile\.defaultProductType/u);
  assert.match(page, /name="kind"/u);
  assert.match(page, /getFeedCategoryProductType\(slug, product\) === "accessories"/u);
});

test("laser category separates production tasks without overlaps or invented positions", async () => {
  const slug = "stanki-lazernoy-rezki";
  const profile = categoryExpertProfiles[slug];
  const all = getFeedCategoryPage(slug, { pageSize:48 });
  const counts = Object.fromEntries(profile.assortmentShortcuts.map((shortcut) => [shortcut.segment, getFeedCategoryPage(slug, { segment:shortcut.segment, pageSize:48 }).total]));

  assert.deepEqual(profile.assortmentShortcuts.map((shortcut) => shortcut.label), ["Листовой металл", "Трубы и профиль", "Лист + труба", "Специальные задачи"]);
  assert.deepEqual(counts, { sheet:37, tube:13, combined:6, special:3 });
  assert.equal(Object.values(counts).reduce((sum, count) => sum + count, 0), all.total);
  assert.equal(all.total, 59);

  const page = await readFile(new URL("../app/catalog/category/[slug]/page.tsx", import.meta.url), "utf8");
  assert.match(page, /name="segment"/u);
  assert.match(page, /Сначала выберите тип заготовки/u);
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
