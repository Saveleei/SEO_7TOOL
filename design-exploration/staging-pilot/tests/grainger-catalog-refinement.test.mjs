import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("category pages use a visual taxonomy before immediate product results", async () => {
  const [page, css] = await Promise.all([
    read("../app/catalog/category/[slug]/page.tsx"),
    read("../app/globals.css"),
  ]);

  const taxonomy = page.indexOf("category-assortment-shortcuts");
  const products = page.indexOf('id="products"');
  assert.ok(taxonomy >= 0 && products > taxonomy, "visual taxonomy must precede the product list");
  assert.match(page, /Разделы категории/u);
  assert.match(page, />Все товары</u);
  assert.match(page, /shortcut\.count\.toLocaleString\("ru-RU"\).*pluralizeProductGroups\(shortcut\.count\)/u);
  assert.doesNotMatch(page.slice(taxonomy, products), /<small>\{shortcut\.copy\}<\/small>/u);
  assert.match(css, /Grainger-inspired catalog hierarchy/u);
  const parity = css.slice(css.indexOf("Grainger-parity refinement"));
  assert.match(parity, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/u);
  assert.match(parity, /grid-template-rows:126px auto/u);
  assert.match(parity, /border-radius:0/u);
});

test("catalog controls use a compact Grainger-like switch without losing Russian B2B actions", async () => {
  const [viewSwitch, table, card, list, css] = await Promise.all([
    read("../app/ui/CatalogViewSwitch.tsx"),
    read("../app/ui/FeedProductTable.tsx"),
    read("../app/ui/FeedProductCard.tsx"),
    read("../app/ui/FeedProductList.tsx"),
    read("../app/globals.css"),
  ]);

  assert.match(viewSwitch, /aria-hidden="true">☷<\/i>/u);
  assert.match(viewSwitch, /aria-hidden="true">▦<\/i><span>Плиткой<\/span>/u);
  assert.match(table, /с НДС · зависит от исполнения/u);
  assert.match(card, /с НДС · зависит от исполнения/u);
  assert.match(list, /layout === "grid" \? 3 : 2/u);
  assert.match(css, /\.category-page-shell \.feed-product-grid--grid \{[\s\S]*?grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/u);
  assert.match(css, /\.category-page-shell \.feed-table-price>\.feed-availability-block>small \{ display:none!important; \}/u);
  assert.match(css, /\.feed-product-grid--grid \.feed-product-actions>\.quick-order-trigger \{ display:none; \}/u);
});

test("homepage and menu state the Russian B2B document package", async () => {
  const [home, menu, trust] = await Promise.all([
    read("../app/page.tsx"),
    read("../app/ui/HeaderCatalogMenu.tsx"),
    read("../app/ui/TrustSection.tsx"),
  ]);

  for (const source of [home, menu, trust]) assert.match(source, /УПД/u);
  assert.match(home, /закрывающие документы/u);
  assert.match(menu, /закрывающими документами/u);
  assert.match(trust, /закрывающие документы/u);
});

test("trust cards remain image and caption only", async () => {
  const section = await read("../app/ui/TrustSection.tsx");
  const card = section.slice(section.indexOf("assurance-photo-card"), section.indexOf("assurance-summary"));
  assert.match(card, /assurance-photo-card__media/u);
  assert.match(card, /<h3>\{card\.title\}<\/h3>/u);
  assert.doesNotMatch(card, /card\.text|card\.outcome|<ul|<Link/u);
});
