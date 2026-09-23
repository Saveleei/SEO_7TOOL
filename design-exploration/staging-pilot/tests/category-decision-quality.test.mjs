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
