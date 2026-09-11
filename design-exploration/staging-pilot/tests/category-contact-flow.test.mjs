import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("burr quick filters prioritize manufacturer and omit the duplicated shape row", async () => {
  const source = await readFile(new URL("../app/catalog/category/[slug]/page.tsx", import.meta.url), "utf8");
  assert.match(source, /\? \[brandFacet, technicalFacets\.find\(\(facet\) => facet\.keyword === "материал"\)/u);
  assert.doesNotMatch(source, /\? \[technicalFacets\.find\(\(facet\) => facet\.keyword === "форма"\)/u);
  assert.match(source, /if \(key === "brand"\) return 0/u);
});

test("guided selection asks for a phone after the preliminary result", async () => {
  const source = await readFile(new URL("../app/ui/BurrSelectionAssistant.tsx", import.meta.url), "utf8");
  assert.match(source, /primaryContact="phone"/u);
  assert.match(source, /Заказать звонок инженера/u);
});

test("send parameters opens a local callback form instead of composing an email", async () => {
  const page = await readFile(new URL("../app/catalog/category/[slug]/page.tsx", import.meta.url), "utf8");
  const dialog = await readFile(new URL("../app/ui/ContactRequestDialog.tsx", import.meta.url), "utf8");
  assert.match(page, /<ContactRequestDialog categoryTitle=/u);
  assert.match(dialog, /Телефон для связи/u);
  assert.match(dialog, /defaultChecked required/u);
  assert.match(dialog, /event\.preventDefault\(\)/u);
  assert.doesNotMatch(dialog, /mailto:/u);
});
