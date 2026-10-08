import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("categories select the default mobile layout by product archetype", async () => {
  const [page, archetypes, viewSwitch, list, table, css] = await Promise.all([
    read("../app/catalog/category/[slug]/page.tsx"),
    read("../app/data/categoryCardArchetypes.mjs"),
    read("../app/ui/CatalogViewSwitch.tsx"),
    read("../app/ui/FeedProductList.tsx"),
    read("../app/ui/FeedProductTable.tsx"),
    read("../app/globals.css"),
  ]);

  assert.match(page, /requestedView === "grid" \|\| requestedView === "cards" \? "grid" : requestedView === "list" \? "list" : "auto"/u);
  assert.match(page, /const desktopView = view === "auto" \? canUseTable \? "list" : "grid" : view/u);
  assert.match(page, /const mobileView = view === "auto" \? getDefaultMobileCatalogView\(slug\) : view/u);
  assert.match(archetypes, /getDefaultMobileCatalogView/u);
  assert.match(archetypes, /archetype\.id === "machine" \|\| archetype\.id === "mobile-processing" \|\| archetype\.id === "project-system"/u);
  assert.match(page, /<CatalogViewSwitch mode="desktop"/u);
  assert.match(page, /<CatalogViewSwitch mode="mobile"/u);
  assert.match(viewSwitch, /aria-label="Вид товаров"/u);
  assert.match(viewSwitch, /mode === "desktop" \? "Таблица" : "Список"/u);
  assert.match(viewSwitch, /<span>Плиткой<\/span>/u);
  assert.match(viewSwitch, /7tool:catalog-view:v1/u);
  assert.match(viewSwitch, /window\.location\.replace/u);
  assert.match(page, /desktopView === "list" && canUseTable/u);
  assert.match(page, /mobileLayout=\{mobileView\}/u);
  assert.match(list, /feed-product-grid--\$\{layout\} feed-product-grid--mobile-\$\{mobileLayout\}/u);
  assert.match(table, /mobileLayout = "list"/u);
  assert.match(table, /feed-product-grid--mobile-grid/u);
  assert.match(table, /mobileLayout === "grid" \? 4 : 3/u);
  assert.match(css, /\.category-page-shell \.feed-product-grid--grid \{[\s\S]*?grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/u);
  assert.match(css, /@media \(max-width:760px\)[\s\S]*?\.feed-product-grid--grid \{ grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/u);
  assert.match(css, /\.category-page-shell \.feed-product-grid--mobile-list \{[\s\S]*?grid-template-columns:1fr!important/u);
  assert.match(css, /\.category-page-shell \.feed-product-grid--mobile-grid \.feed-product-card--precision-tooling \.feed-product-specs/u);
  assert.match(css, /\.category-page-shell \.feed-view-switch--mobile \{ display:none; \}/u);
  assert.match(css, /@media \(max-width:760px\)[\s\S]*?\.category-page-shell \.feed-view-switch--desktop \{ display:none; \}[\s\S]*?\.category-page-shell \.feed-view-switch--mobile \{ display:flex; \}/u);
});

test("selection help is inserted after a complete first row", async () => {
  const [page, list, table] = await Promise.all([
    read("../app/catalog/category/[slug]/page.tsx"),
    read("../app/ui/FeedProductList.tsx"),
    read("../app/ui/FeedProductTable.tsx"),
  ]);

  assert.match(page, /result\.page !== 1 \|\| result\.products\.length === 0 \? undefined/u);
  assert.match(page, /after=\{inlineSelectionAssistant\}/u);
  assert.match(list, /Math\.min\(layout === "grid" \? 3 : 2, products\.length - 1\)/u);
  assert.match(table, /Math\.min\(mobileLayout === "grid" \? 4 : 3, products\.length\)/u);
  assert.equal((table.match(/\{after && <div className="category-feed-assistant">\{after\}<\/div>\}/gu) ?? []).length, 1);
});

test("catalog desktop navigation exposes every direction while mobile keeps compact disclosure", async () => {
  const [menu, header, groups, analytics, sanitizer, css] = await Promise.all([
    read("../app/ui/HeaderCatalogMenu.tsx"),
    read("../app/ui/PilotHeader.tsx"),
    read("../app/data/productionCategoryGroups.ts"),
    read("../app/ui/ConversionAnalytics.tsx"),
    read("../app/data/conversionAnalytics.mjs"),
    read("../app/globals.css"),
  ]);

  assert.match(menu, /className="header-catalog-explorer"/u);
  assert.match(menu, /className="header-catalog-section"/u);
  assert.match(menu, /className="header-catalog-grid header-catalog-grid--mobile"/u);
  assert.doesNotMatch(menu, /role="tab"|role="tabpanel"|header-catalog-directions|header-catalog-active/u);
  assert.match(menu, /data-conversion-action="catalog_category_open"/u);
  assert.match(header, /getProductionCategoryGroups\(pilotFeedCategorySlugs\)/u);
  assert.match(groups, /slug:"drilling"[\s\S]*?slug:"koronchatye-sverla"[\s\S]*?slug:"sverla-i-zenkovki"[\s\S]*?slug:"metchiki"/u);
  assert.match(analytics, /category_listing_action/u);
  assert.match(sanitizer, /"catalog_navigation", "category_listing_action"/u);
  assert.match(css, /\.header-catalog-explorer \{ display:grid; grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/u);
  assert.match(css, /@media \(max-width:1180px\) and \(min-width:761px\)[\s\S]*?\.header-catalog-explorer \{ grid-template-columns:repeat\(2,minmax\(0,1fr\)\); \}/u);
  assert.match(css, /@media \(max-width:760px\)[\s\S]*?\.header-catalog-explorer \{ display:none; \}/u);
});

