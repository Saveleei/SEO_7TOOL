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
  const availability = await readFile(new URL("../app/ui/FeedAvailability.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(card, /<FeedAvailability/u);
  assert.match(table, /<FeedAvailability/u);
  assert.match(availability, /feed-availability--positive/u);
  assert.match(availability, /Остаток и срок подтвердим перед оплатой/u);
  assert.match(styles, /\.feed-availability--positive \{[^}]*color:#087044!important[^}]*font-weight:650!important/us);
  assert.match(styles, /\.feed-availability-block>small \{[^}]*font-size:9px/us);
});

test("the shape-help link opens and focuses the guided selector", async () => {
  const page = await readFile(new URL("../app/catalog/category/[slug]/page.tsx", import.meta.url), "utf8");
  const selector = await readFile(new URL("../app/ui/BurrSelectionAssistant.tsx", import.meta.url), "utf8");
  assert.match(page, /href="#burr-selector">Не знаете форму\? Подобрать по задаче/u);
  assert.match(selector, /detailsRef\.current\.open = true/u);
  assert.match(selector, /a\[href="#burr-selector"\]/u);
  assert.match(selector, /firstTaskRef\.current\?\.focus/u);
});

test("burr promoted filters wrap instead of hiding options", async () => {
  const page = await readFile(new URL("../app/catalog/category/[slug]/page.tsx", import.meta.url), "utf8");
  const controls = await readFile(new URL("../app/ui/PromotedFilterControls.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const promotedFilters = page.slice(page.indexOf("feed-promoted-filters"), page.indexOf("<BurrSelectionAssistant"));
  assert.match(promotedFilters, /return <PromotedFilterLink className=\{selected/u);
  assert.doesNotMatch(promotedFilters, /return <Link className=\{selected/u);
  assert.match(controls, /window\.location\.assign\(href\)/u);
  assert.match(controls, /toggle\.checked = true/u);
  assert.match(styles, /\.feed-promoted-filters--burr>div>div \{[^}]*flex-wrap:wrap[^}]*overflow:visible/us);
  assert.match(styles, /\.feed-promoted-filters--burr>div:nth-child\(4\) \{[^}]*grid-column:1\/3/us);
});

test("variant articles link to the exact execution and availability copy cannot collapse inline", async () => {
  const card = await readFile(new URL("../app/ui/FeedProductCard.tsx", import.meta.url), "utf8");
  const table = await readFile(new URL("../app/ui/FeedProductTable.tsx", import.meta.url), "utf8");
  const availability = await readFile(new URL("../app/ui/FeedAvailability.tsx", import.meta.url), "utf8");
  const product = await readFile(new URL("../app/product/[slug]/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(card, /\?variant=\$\{encodeURIComponent\(variant\.id\)\}#variants/u);
  assert.match(table, /\?variant=\$\{encodeURIComponent\(variant\.id\)\}#variants/u);
  assert.match(product, /feed-variant-card--selected/u);
  assert.match(availability, /return <div className="feed-availability-block">/u);
  assert.match(styles, /\.feed-availability-block>small \{[^}]*display:block!important[^}]*margin:0!important/us);
});

test("applied filters and clear-all use reliable navigation", async () => {
  const page = await readFile(new URL("../app/catalog/category/[slug]/page.tsx", import.meta.url), "utf8");
  const appliedFilters = page.slice(page.indexOf('className="feed-applied-filters"'), page.indexOf("{result.products.length"));
  assert.match(appliedFilters, /<PromotedFilterLink className="feed-reset-all"/u);
  assert.match(appliedFilters, /filters\[facet\.key\].*<PromotedFilterLink/us);
  assert.doesNotMatch(appliedFilters, /<Link/u);
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

test("listing actions use a restrained two-level CTA palette", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(styles, /--cta:#c94a12/u);
  assert.match(styles, /--action-dark:#252925/u);
  assert.match(styles, /\.feed-product-actions button,\.feed-table-actions \.feed-variant-toggle[^}]*background:var\(--action-dark\)/us);
  assert.match(styles, /\.button-orange,\.request-cart-trigger[^}]*background:var\(--cta\)/us);
});
