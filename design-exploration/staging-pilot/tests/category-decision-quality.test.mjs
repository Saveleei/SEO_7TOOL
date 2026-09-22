import assert from "node:assert/strict";
import test from "node:test";
import { getCategoryExpertProfile } from "../app/data/categoryExpertProfiles.mjs";
import {
  getFeedCategoryFamily,
  getFeedCategoryPage,
  getPromotedFacetOptions,
  getFeedCategorySubsegment,
  getPublishedFeedCatalogSnapshot,
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
