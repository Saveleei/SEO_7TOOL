import assert from "node:assert/strict";
import test from "node:test";
import { buildDrillSelectionUrl, resolveReverseFacetValue } from "../app/data/drillSelection.mjs";

test("drill selection preserves commercial context and applies a real minimum diameter", () => {
  const url = buildDrillSelectionUrl({
    pathname:"/catalog/category/stanki-sverlilnye",
    search:"?view=cards&availability=in-stock&sort=price-asc&page=3&f_brand=LENZ&min_spec2=16&f_spec4=Нет",
    diameterFacetKey:"spec2",
    reverseFacetKey:"spec4",
    diameter:35,
    reverse:"Да",
    work:"installation",
  });
  const parsed = new URL(url, "https://example.test");
  assert.equal(parsed.hash, "#products");
  assert.equal(parsed.searchParams.get("view"), "cards");
  assert.equal(parsed.searchParams.get("availability"), "in-stock");
  assert.equal(parsed.searchParams.get("sort"), "price-asc");
  assert.equal(parsed.searchParams.get("f_brand"), "LENZ");
  assert.equal(parsed.searchParams.get("page"), null);
  assert.equal(parsed.searchParams.get("min_spec2"), "35");
  assert.deepEqual(parsed.searchParams.getAll("f_spec4"), ["Да"]);
  assert.equal(parsed.searchParams.get("q"), null);
  assert.equal(parsed.searchParams.get("segment"), "drill-magnetic");
});

test("workshop selection removes an old installation query", () => {
  const url = buildDrillSelectionUrl({
    pathname:"/catalog/category/stanki-sverlilnye",
    search:"?q=магнитн&view=table",
    diameterFacetKey:"spec2",
    diameter:50,
    work:"workshop",
  });
  const parsed = new URL(url, "https://example.test");
  assert.equal(parsed.searchParams.get("q"), null);
  assert.equal(parsed.searchParams.get("segment"), "drill-stationary");
  assert.equal(parsed.searchParams.get("drill_type"), null);
  assert.equal(parsed.searchParams.get("min_spec2"), "50");
  assert.equal(parsed.searchParams.get("view"), "table");
});

test("reverse is applied only when the feed exposes an exact affirmative value", () => {
  assert.equal(resolveReverseFacetValue(true, ["Да", "Нет"]), "Да");
  assert.equal(resolveReverseFacetValue(true, ["Есть", "Нет"]), "");
  assert.equal(resolveReverseFacetValue(false, ["Да", "Нет"]), "");
});
