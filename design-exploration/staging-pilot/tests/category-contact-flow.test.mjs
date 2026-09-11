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

test("selection criteria align the manager with the first parameter row", async () => {
  const page = await readFile(new URL("../app/catalog/category/[slug]/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(page, /subcategory-layout--selection/u);
  assert.match(styles, /grid-template-areas:"heading \." "criteria manager" "note manager"/u);
  assert.match(styles, /\.selection-criteria-list li \{[^}]*min-height:108px/us);
  assert.match(styles, /\.subcategory-layout--selection \.manager-contact-head \{[^}]*min-height:108px/us);
});

test("positive feed availability uses a dedicated readable green status", async () => {
  const card = await readFile(new URL("../app/ui/FeedProductCard.tsx", import.meta.url), "utf8");
  const table = await readFile(new URL("../app/ui/FeedProductTable.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(card, /feed-availability--positive/u);
  assert.match(table, /feed-availability--positive/u);
  assert.match(styles, /\.feed-availability--positive \{[^}]*color:#087044!important[^}]*font-weight:650!important/us);
  assert.match(styles, /\.feed-table-price>em\.feed-availability \{[^}]*font-size:10px/us);
});

test("product cards use readable actions and a native full-details navigation", async () => {
  const card = await readFile(new URL("../app/ui/FeedProductCard.tsx", import.meta.url), "utf8");
  const table = await readFile(new URL("../app/ui/FeedProductTable.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(card, /<a className="feed-all-characteristics" href=/u);
  assert.match(table, /<a className="feed-all-characteristics" href=/u);
  assert.match(styles, /\.feed-product-actions button,\.feed-product-actions>a \{[^}]*font-size:11px/us);
  assert.match(styles, /\.contact-dialog-panel input,\.contact-dialog-panel textarea \{[^}]*font-size:14px/us);
});
