import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("every category exposes one consistent list and grid switch", async () => {
  const [page, list, css] = await Promise.all([
    read("../app/catalog/category/[slug]/page.tsx"),
    read("../app/ui/FeedProductList.tsx"),
    read("../app/globals.css"),
  ]);

  assert.match(page, /requestedView === "grid" \|\| requestedView === "cards" \? "grid" : "list"/u);
  assert.match(page, /aria-label="Вид товаров"/u);
  assert.match(page, />Списком<\/a>/u);
  assert.match(page, />Плиткой<\/a>/u);
  assert.match(page, /view === "list" && canUseTable/u);
  assert.match(list, /feed-product-grid--\$\{layout\}/u);
  assert.match(css, /\.feed-product-grid--grid \{ grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/u);
  assert.match(css, /@media \(max-width:760px\)[\s\S]*?\.feed-product-grid--grid \{ grid-template-columns:1fr; \}/u);
});

test("selection help is inserted once after the first three products", async () => {
  const [page, list, table] = await Promise.all([
    read("../app/catalog/category/[slug]/page.tsx"),
    read("../app/ui/FeedProductList.tsx"),
    read("../app/ui/FeedProductTable.tsx"),
  ]);

  assert.match(page, /result\.page !== 1 \|\| result\.products\.length === 0 \? undefined/u);
  assert.match(page, /after=\{inlineSelectionAssistant\}/u);
  assert.match(list, /Math\.min\(2, products\.length - 1\)/u);
  assert.match(table, /Math\.min\(3, products\.length\)/u);
  assert.equal((table.match(/\{after && <div className="category-feed-assistant">\{after\}<\/div>\}/gu) ?? []).length, 1);
});

test("catalog desktop navigation uses a direction rail and a direct category panel", async () => {
  const [menu, analytics, sanitizer, css] = await Promise.all([
    read("../app/ui/HeaderCatalogMenu.tsx"),
    read("../app/ui/ConversionAnalytics.tsx"),
    read("../app/data/conversionAnalytics.mjs"),
    read("../app/globals.css"),
  ]);

  assert.match(menu, /className="header-catalog-explorer"/u);
  assert.match(menu, /className="header-catalog-directions"/u);
  assert.match(menu, /className="header-catalog-active"/u);
  assert.match(menu, /data-conversion-action="catalog_category_open"/u);
  assert.match(analytics, /category_listing_action/u);
  assert.match(sanitizer, /"catalog_navigation", "category_listing_action"/u);
  assert.match(css, /\.header-catalog-explorer \{ display:grid; grid-template-columns:280px minmax\(0,1fr\)/u);
  assert.match(css, /@media \(max-width:760px\)[\s\S]*?\.header-catalog-explorer \{ display:none; \}/u);
});

