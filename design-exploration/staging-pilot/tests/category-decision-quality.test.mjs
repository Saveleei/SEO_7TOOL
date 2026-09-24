import assert from "node:assert/strict";
import test from "node:test";
import { getCategoryExpertProfile } from "../app/data/categoryExpertProfiles.mjs";
import {
  getFeedCategoryFamily,
  getFeedCategoryPage,
  getFeedVariantTechnicalSpecs,
  getPromotedFacetOptions,
  getFeedCategorySubsegment,
  getPublishedFeedCatalogSnapshot,
  toFeedProductCardModel,
} from "../app/data/feedCatalog.ts";

test("magnetic drills expose a feed-backed brushless decision path", () => {
  const profile = getCategoryExpertProfile("stanki-sverlilnye");
  const magnetic = profile.assortmentShortcuts.find((shortcut) => shortcut.segment === "drill-magnetic");
  const brushless = magnetic.subsegments.find((subsegment) => subsegment.id === "magnetic-brushless");
  const page = getFeedCategoryPage("stanki-sverlilnye", {
    productType:"equipment",
    segment:"drill-magnetic",
    subsegment:"magnetic-brushless",
    pageSize:48,
  });

  assert.equal(brushless.label, "Бесщёточные");
  assert.equal(page.total, 7);
  assert.ok(page.products.every((product) => getFeedCategorySubsegment("stanki-sverlilnye", product) === "magnetic-brushless"));
});

test("carbide annular cutters include LENZ LZTM and the actual 110 mm length", () => {
  const snapshot = getPublishedFeedCatalogSnapshot();
  const lztm = snapshot.products.find((product) => product.slug === "sverla-koronchatye-lztm");
  assert.ok(lztm);
  assert.equal(getFeedCategoryFamily("koronchatye-sverla", lztm), "carbide");

  const page = getFeedCategoryPage("koronchatye-sverla", { family:"carbide", pageSize:48 });
  const length = page.facets.find((facet) => facet.keyword === "рабочая длина");
  const lenzPage = getFeedCategoryPage("koronchatye-sverla", { family:"carbide", filters:{ brand:["LENZ"] }, pageSize:48 });
  const series = lenzPage.facets.find((facet) => facet.keyword === "серия");
  assert.ok(page.facets.find((facet) => facet.key === "brand")?.options.some((option) => option.value === "LENZ"));
  assert.ok(length?.options.some((option) => option.value === "110 мм"));
  assert.ok(series?.options.some((option) => option.value === "LZTM"));
  assert.ok(getPromotedFacetOptions(length, 6, [], ["110 мм"]).some((option) => option.value === "110 мм"));
});

test("countersinks expose a clean shank facet without mixing diameters and tolerances", () => {
  const page = getFeedCategoryPage("sverla-i-zenkovki", { family:"countersink", pageSize:48 });
  const shank = page.facets.find((facet) => facet.keyword === "посадка хвостовика");
  const values = shank?.options.map((option) => option.value) ?? [];

  assert.equal(shank?.label, "Хвостовик");
  assert.ok(values.includes("Weldon 19"));
  assert.ok(values.includes("КМ2"));
  assert.ok(values.every((value) => !/^\d+(?:[,.]\d+)? мм$/u.test(value)));
  assert.ok(values.every((value) => !/^[fh]\d+$/iu.test(value)));
});

test("tapping manipulators separate drive and operation before technical filtering", () => {
  const expected = {
    electric:29,
    pneumatic:6,
    "drill-tap":11,
    "hydraulic-servo":7,
    workplaces:22,
    collets:2,
  };
  const profile = getCategoryExpertProfile("rezbonareznye-manipulyatory");
  const counts = Object.fromEntries(profile.assortmentShortcuts
    .filter((shortcut) => shortcut.family)
    .map((shortcut) => [shortcut.family, getFeedCategoryPage("rezbonareznye-manipulyatory", { family:shortcut.family, pageSize:48 }).total])
    .filter(([, count]) => count > 0));

  assert.deepEqual(counts, expected);
  assert.equal(Object.values(counts).reduce((sum, count) => sum + count, 0), 77);
});

test("compatibility-first items do not masquerade as primary equipment", () => {
  const snapshot = getPublishedFeedCatalogSnapshot();
  const byTitle = (title) => snapshot.products.find((product) => product.title === title);
  const cases = [
    ["kompressory", "Воздушный фильтр Fubag на 4/5,5/7,5/11 кВт", "accessories"],
    ["kromkorezy-po-listu", "25916", "unidentified"],
    ["borfrezy", "Артикул 11.4919U", "sets"],
    ["koronchatye-sverla", "Набор корончатых сверл Ø12-22 мм, 6 шт., арт. LZHS-001", "sets"],
    ["shlifovalnoe-i-zatochnoe-oborudovanie", "Шлифовально-зачистной станок Heden DGR-600SL", "wide-belt"],
    ["shlifovalnoe-i-zatochnoe-oborudovanie", "Мобильный ленточный шлифовальный станок Heden SF-75M", "portable-belt"],
  ];

  for (const [category, title, expectedFamily] of cases) {
    const product = byTitle(title);
    assert.ok(product, title);
    assert.equal(getFeedCategoryFamily(category, product), expectedFamily, title);
  }

  const bevelerProfile = getCategoryExpertProfile("kromkorezy-po-listu");
  const compressorProfile = getCategoryExpertProfile("kompressory");
  assert.equal(bevelerProfile.assortmentShortcuts.find((shortcut) => shortcut.family === "unidentified")?.selectionMode, "engineer");
  assert.equal(compressorProfile.assortmentShortcuts.find((shortcut) => shortcut.family === "accessories")?.selectionMode, "engineer");
});

test("welding positions lead with plain-language meaning and retain exact feed values", () => {
  const page = getFeedCategoryPage("karetki-svarochnye", { pageSize:1000 });
  const positions = page.facets.find((facet) => facet.keyword === "положения сварки");
  assert.ok(positions);
  const labels = new Map(positions.options.map((option) => [option.value, option.label]));

  assert.equal(labels.get("PA/1G"), "Нижнее положение, стыковой шов · PA/1G");
  assert.equal(labels.get("PA/1F"), "Нижнее положение, угловой шов · PA/1F");
  assert.equal(labels.get("PB/2F"), "Горизонтальное положение, угловой шов · PB/2F");
  assert.equal(labels.get("PC/2G"), "Горизонтальное положение, стыковой шов · PC/2G");
  assert.equal(labels.get("PF/3G"), "Вертикальное снизу вверх, стыковой шов · PF/3G");
  assert.equal(labels.get("PF/3F"), "Вертикальное снизу вверх, угловой шов · PF/3F");
  assert.equal(labels.get("PC/2G (стыковой шов трубы)"), "Труба — Горизонтальное положение, стыковой шов · PC/2G");
  assert.equal(labels.get("PB/2F (угловой шов трубы)"), "Труба — Горизонтальное положение, угловой шов · PB/2F");

  const filtered = getFeedCategoryPage("karetki-svarochnye", { filters:{ [positions.key]:["PB/2F"] }, pageSize:1000 });
  assert.ok(filtered.total > 0);
  assert.ok(filtered.total < page.total);

  const product = getPublishedFeedCatalogSnapshot().products.find((entry) => entry.slug === "svarochnaya-karetka-huawei-hk-8snw");
  assert.ok(product);
  const cardPosition = toFeedProductCardModel(product).specs.find((spec) => spec.label === "Положения сварки");
  const variant = product.variants.find((entry) => entry.params.some((parameter) => parameter.name === "Положения сварки" && parameter.value === "PB/2F"));
  assert.match(cardPosition?.value ?? "", /Горизонтальное, угловой шов · PB\/2F/u);
  assert.match(getFeedVariantTechnicalSpecs(product, variant).find((spec) => spec.label === "Положения сварки")?.value ?? "", /Горизонтальное, угловой шов · PB\/2F/u);
});

test("drill families expose feed-backed diameter, stated length, shank, material and standard", () => {
  const snapshot = getPublishedFeedCatalogSnapshot();
  const cylindrical = snapshot.products.find((product) => product.slug === "spiralnye-sverla-ruko-ts-h-hss-tin-din-338-seriya-214");
  const taper = snapshot.products.find((product) => product.slug === "sverla-spiralnye-k-h-gost-10903-77");
  const range = snapshot.products.find((product) => product.title.includes("Коническое сверло Ø 8-20 мм"));
  assert.ok(cylindrical);
  assert.ok(taper);
  assert.ok(range);
  assert.equal(getFeedCategoryFamily("sverla-i-zenkovki", cylindrical), "cylindrical-shank");
  assert.equal(getFeedCategoryFamily("sverla-i-zenkovki", taper), "taper-shank");
  assert.equal(getFeedCategoryFamily("sverla-i-zenkovki", range), "range");

  const cylindricalSpecs = getFeedVariantTechnicalSpecs(cylindrical, cylindrical.variants[0]);
  assert.equal(cylindricalSpecs.find((spec) => spec.label === "Диаметр режущей части")?.value, "12 мм");
  assert.equal(cylindricalSpecs.find((spec) => spec.label === "Длина по наименованию")?.value, "101 мм");
  assert.equal(cylindricalSpecs.find((spec) => spec.label === "Хвостовик")?.value, "Цилиндрический");
  assert.equal(cylindricalSpecs.find((spec) => spec.label === "Материал режущей части")?.value, "HSS");
  assert.equal(cylindricalSpecs.find((spec) => spec.label === "Стандарт")?.value, "DIN 338");

  const taperPage = getFeedCategoryPage("sverla-i-zenkovki", { family:"taper-shank", pageSize:1000 });
  const diameter = taperPage.facets.find((facet) => facet.keyword === "диаметр режущей");
  const statedLength = taperPage.facets.find((facet) => facet.keyword === "длина по наименованию");
  assert.ok(diameter?.options.some((option) => option.value === "16 мм"));
  assert.ok(statedLength?.options.some((option) => option.value === "120 мм"));

  const overallDiameter = getFeedCategoryPage("sverla-i-zenkovki", { pageSize:48 }).facets.find((facet) => facet.keyword === "диаметр режущей");
  assert.ok(overallDiameter?.options.length > 0);
  assert.equal(overallDiameter.options.some((option) => /(?:\/\s*[-−]|[-−]\s*\d+\s*\/)/u.test(option.value)), false, "diameter choices must not contain tolerance notation");
});

test("pipe cutters separate orbital saws from split-frame cold-cut machines", () => {
  const snapshot = getPublishedFeedCatalogSnapshot();
  const splitFrame = snapshot.products.find((product) => product.title === "Разъёмный труборез и фаскосниматель ТВС-230 с электроприводом");
  const orbital = snapshot.products.find((product) => product.title === "Орбитальный труборез Lefon Lite4");
  const modelOnly = snapshot.products.find((product) => product.title === "Труборез разъемный ISD-168");
  assert.ok(splitFrame);
  assert.ok(orbital);
  assert.ok(modelOnly);
  assert.equal(getFeedCategoryFamily("truborezy", splitFrame), "split-frame");
  assert.equal(getFeedCategoryFamily("truborezy", orbital), "orbital");

  const specs = getFeedVariantTechnicalSpecs(splitFrame, splitFrame.variants[0]);
  assert.equal(specs.find((spec) => spec.label.startsWith("Мин. диаметр труб"))?.value, "80");
  assert.equal(specs.find((spec) => spec.label.startsWith("Макс. диаметр труб"))?.value, "230");
  assert.equal(specs.find((spec) => spec.label === "Тип привода")?.value, "Электрический");
  assert.equal(specs.find((spec) => spec.label === "Возможности")?.value, "Резка и снятие фаски");

  const splitPage = getFeedCategoryPage("truborezy", { family:"split-frame", pageSize:1000 });
  const drive = splitPage.facets.find((facet) => facet.keyword === "тип привода");
  assert.deepEqual(drive?.options.map((option) => option.value).sort(), ["Гидравлический", "Пневматический", "Электрический"]);
  const filtered = getFeedCategoryPage("truborezy", { family:"split-frame", filters:{ [drive.key]:["Электрический"] }, pageSize:1000 });
  assert.ok(filtered.total > 0);
  assert.ok(filtered.total < splitPage.total);

  const modelOnlySpecs = getFeedVariantTechnicalSpecs(modelOnly, modelOnly.variants[0]);
  assert.equal(modelOnlySpecs.some((spec) => /диаметр труб/iu.test(spec.label)), false, "model code must not masquerade as a tube diameter");
});

test("sheet beveler accessories stay outside machine selection while explicit machine types remain filterable", () => {
  const snapshot = getPublishedFeedCatalogSnapshot();
  const accessory = snapshot.products.find((product) => product.title === "Блок автоматической подачи для кромкорезов AHA с пультом управления");
  const automatic = snapshot.products.find((product) => product.title === "Кромкорез автоматический UZ-47, 400 В");
  const manual = snapshot.products.find((product) => product.title === "Кромкорез ручной пневматический AX207");
  assert.ok(accessory);
  assert.ok(automatic);
  assert.ok(manual);
  assert.equal(getFeedCategoryFamily("kromkorezy-po-listu", accessory), "accessories");
  assert.equal(getFeedCategoryFamily("kromkorezy-po-listu", automatic), "automatic");
  assert.equal(getFeedVariantTechnicalSpecs(automatic, automatic.variants[0]).find((spec) => spec.label === "Тип")?.value, "Автоматический");
  assert.equal(getFeedVariantTechnicalSpecs(manual, manual.variants[0]).find((spec) => spec.label === "Тип")?.value, "Ручной");

  const page = getFeedCategoryPage("kromkorezy-po-listu", { family:"automatic", pageSize:1000 });
  const type = page.facets.find((facet) => facet.keyword === "тип");
  assert.ok(type?.options.some((option) => option.value === "Автоматический"));
});

test("bandsaw execution type is derived only from explicit buyer-facing wording", () => {
  const snapshot = getPublishedFeedCatalogSnapshot();
  const automatic = snapshot.products.find((product) => product.title === "Станок ленточнопильный автоматический колонный Stalex BS-600GA");
  const modelOnly = snapshot.products.find((product) => product.title === "Ленточнопильный станок Heden DBS-170");
  assert.ok(automatic);
  assert.ok(modelOnly);
  assert.equal(getFeedVariantTechnicalSpecs(automatic, automatic.variants[0]).find((spec) => spec.label === "Тип исполнения")?.value, "Автоматический");
  assert.equal(getFeedVariantTechnicalSpecs(modelOnly, modelOnly.variants[0]).some((spec) => spec.label === "Тип исполнения"), false, "model code must not imply automation");

  const page = getFeedCategoryPage("lentochnopilnye-stanki", { productType:"equipment", pageSize:1000 });
  const type = page.facets.find((facet) => facet.keyword === "тип исполнения");
  assert.ok(type?.options.some((option) => option.value === "Автоматический"));
  const filtered = getFeedCategoryPage("lentochnopilnye-stanki", { productType:"equipment", filters:{ [type.key]:["Автоматический"] }, pageSize:1000 });
  assert.ok(filtered.total > 0);
  assert.ok(filtered.total < page.total);
});

test("step drills expose their explicit working range as the primary decision", () => {
  const page = getFeedCategoryPage("sverla-i-zenkovki", { family:"step", pageSize:1000 });
  const maximum = page.facets.find((facet) => facet.keyword === "максимальный диаметр");
  const minimum = page.facets.find((facet) => facet.keyword === "минимальный диаметр");
  assert.ok(maximum?.options.some((option) => option.value === "38 мм"));
  assert.ok(minimum?.options.some((option) => option.value === "4 мм"));
});

test("annular cutter dimensions and shank come only from explicit title tokens", () => {
  const product = getPublishedFeedCatalogSnapshot().products.find((entry) => entry.title === "Сверло корончатое NEO Ø19,5х35 мм, TCT, W19");
  assert.ok(product);
  const specs = getFeedVariantTechnicalSpecs(product, product.variants[0]);
  assert.equal(specs.find((spec) => spec.label === "Диаметр режущей части")?.value, "19,5 мм");
  assert.equal(specs.find((spec) => spec.label === "Рабочая длина")?.value, "35 мм");
  assert.equal(specs.find((spec) => spec.label === "Хвостовик")?.value, "Weldon 19");
  assert.equal(specs.find((spec) => spec.label === "Материал режущей части")?.value, "Твёрдый сплав");
});

test("saw blade dimensions distinguish outer diameter from bore", () => {
  const product = getPublishedFeedCatalogSnapshot().products.find((entry) => entry.title === "Диск пильный по стали Stalex HSS 315х2,5х40, S=2/4мм, Е макс=75мм");
  assert.ok(product);
  const specs = getFeedVariantTechnicalSpecs(product, product.variants[0]);
  assert.equal(specs.find((spec) => spec.label === "Диаметр диска")?.value, "315 мм");
  assert.equal(specs.find((spec) => spec.label === "Посадочное отверстие")?.value, "40 мм");
  assert.equal(specs.find((spec) => spec.label === "Материал")?.value, "HSS");
});
