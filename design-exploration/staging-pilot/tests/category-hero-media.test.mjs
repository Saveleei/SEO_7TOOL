import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("category hero stays compact and leaves product photography to direct assortment choices", async () => {
  const page = await read("../app/catalog/category/[slug]/page.tsx");

  assert.match(page, /page-hero--category-compact/u);
  assert.match(page, /className="category-hero-actions"/u);
  assert.match(page, /data-conversion-action="open_category_selector"/u);
  assert.match(page, /category-assortment-shortcut-media/u);
  assert.doesNotMatch(page, /getHomepageContentSettings\(\)/u);
  assert.doesNotMatch(page, /categoryHeroImage/u);
});

test("compact category hero remains readable while assortment media stays uncropped", async () => {
  const [page, media, css] = await Promise.all([
    read("../app/catalog/category/[slug]/page.tsx"),
    read("../app/ui/HomepageCategoryMedia.tsx"),
    read("../app/globals.css"),
  ]);

  assert.match(page, /<section className="page-hero page-hero--category page-hero--category-compact"/u);
  assert.match(page, /<HomepageCategoryMedia src=\{shortcut\.image\}/u);
  assert.match(media, /sizes = "\(max-width: 760px\) 42vw/u);
  assert.match(media, /onError=\{\(\) => setFailed\(true\)\}/u);
  assert.match(css, /\.category-hero-compact \{[^}]*grid-template-columns:minmax\(0,1\.35fr\) minmax\(360px,\.65fr\)/u);
  assert.match(css, /\.category-assortment-shortcut-media img \{[^}]*object-fit:contain!important/u);
  assert.match(css, /@media \(max-width:760px\)[\s\S]*?\.page-hero--category-compact h1 \{[^}]*font-size:30px!important/u);
});

test("category navigation and filters collapse into deliberate mobile controls", async () => {
  const [page, css] = await Promise.all([
    read("../app/catalog/category/[slug]/page.tsx"),
    read("../app/globals.css"),
  ]);

  assert.match(page, /category-sibling-navigation-desktop/u);
  assert.match(page, /<details className="container category-sibling-navigation-mobile">/u);
  assert.match(css, /\.category-sibling-navigation-mobile \{ display:none!important; \}/u);
  assert.match(css, /\.category-sibling-navigation-mobile \{[\s\S]*?display:block!important;/u);
  assert.match(css, /\.feed-filter-toggle:checked~form \{[\s\S]*?position:fixed;[\s\S]*?inset:64px 0 0;/u);
  assert.match(css, /body:has\(\.category-page-shell \.feed-filter-toggle:checked\) \{ overflow:hidden; \}/u);
});
