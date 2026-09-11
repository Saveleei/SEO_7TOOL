import assert from "node:assert/strict";
import test from "node:test";
import { buildBurrSelectionUrl, getBurrTaskRecommendation, resolveMaterialFacetValue } from "../app/data/burrSelection.mjs";

test("guided selection keeps commercial context and replaces shape and shank filters", () => {
  const url = buildBurrSelectionUrl({
    pathname:"/catalog/category/borfrezy",
    search:"?view=table&availability=in-stock&sort=relevance&q=&f_spec4=A&f_spec3=3&f_spec5=Чугун&page=4",
    shapeFacetKey:"spec4",
    shankFacetKey:"spec3",
    materialFacetKey:"spec5",
    forms:["C", "D", "E"],
    shank:"6",
    material:"Нержавеющие стали",
  });
  const parsed = new URL(url, "https://example.test");
  assert.equal(parsed.hash, "#products");
  assert.equal(parsed.searchParams.get("availability"), "in-stock");
  assert.equal(parsed.searchParams.get("view"), "table");
  assert.equal(parsed.searchParams.get("page"), null);
  assert.deepEqual(parsed.searchParams.getAll("f_spec4"), ["C", "D", "E"]);
  assert.deepEqual(parsed.searchParams.getAll("f_spec3"), ["6"]);
  assert.deepEqual(parsed.searchParams.getAll("f_spec5"), ["Нержавеющие стали"]);
});

test("material choices resolve only to values explicitly present in the feed", () => {
  const values = ["Сталь", "Нержавеющие стали", "Чугун", "Цветные металлы"];
  assert.equal(resolveMaterialFacetValue("Нержавеющая сталь", values), "Нержавеющие стали");
  assert.equal(resolveMaterialFacetValue("Алюминий / цветные металлы", values), "Цветные металлы");
  assert.equal(resolveMaterialFacetValue("Титан", values), "");
});

test("recommendations only use forms that are present in the feed facet", () => {
  const result = getBurrTaskRecommendation("radius", ["A", "C", "D"]);
  assert.deepEqual(result.forms, ["C", "D"]);
});

test("unknown task removes an old shape constraint without inventing a recommendation", () => {
  const result = getBurrTaskRecommendation("unknown", ["A", "B", "C"]);
  assert.deepEqual(result.forms, []);
  const url = buildBurrSelectionUrl({ pathname:"/catalog/category/borfrezy", search:"?f_spec4=A", shapeFacetKey:"spec4", forms:[] });
  assert.equal(url, "/catalog/category/borfrezy#products");
});
