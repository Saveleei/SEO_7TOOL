import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("category hero uses scoped, editor-managed, then feed media in that order", async () => {
  const page = await read("../app/catalog/category/[slug]/page.tsx");

  assert.match(page, /getHomepageContentSettings\(\)/u);
  assert.match(page, /item\.id === slug && item\.imageAssetId/u);
  assert.match(page, /activeShortcut \|\| activeSubsegment[\s\S]*?result\.products\.find\(\(product\) => getFeedProductImage\(product\)\)/u);
  assert.match(page, /const categoryHeroImage = scopedHeroImage[\s\S]*?homepageAssetUrl\(manualHeroMedia\.imageAssetId\)[\s\S]*?subcategory\.image/u);
  assert.match(page, /categoryHeroImage && <figure className="category-hero-media">/u);
  assert.match(page, /Пример выбранного вида/u);
  assert.match(page, /Пример оборудования раздела/u);
});

test("category hero media is uncropped, stable and shares one decision panel", async () => {
  const [page, media, settings, css] = await Promise.all([
    read("../app/catalog/category/[slug]/page.tsx"),
    read("../app/ui/HomepageCategoryMedia.tsx"),
    read("../app/ui/HomepageContentSettingsForm.tsx"),
    read("../app/globals.css"),
  ]);

  assert.match(page, /<div className="category-hero-decision">\{categoryHeroImage/u);
  assert.match(page, /<HomepageCategoryMedia[\s\S]*?sizes="\(max-width: 760px\) 96px, \(max-width: 1180px\) 150px, 180px"/u);
  assert.match(media, /sizes = "\(max-width: 760px\) 42vw/u);
  assert.match(media, /onError=\{\(\) => setFailed\(true\)\}/u);
  assert.match(css, /\.category-hero-media \{[^}]*grid-template-rows:minmax\(150px,1fr\) auto;[^}]*overflow:hidden;/u);
  assert.match(css, /\.category-hero-media-visual img \{[^}]*object-fit:contain!important;[^}]*object-position:center!important;/u);
  assert.match(css, /\.category-hero-decision \{[\s\S]*?grid-template-columns:178px minmax\(0,1fr\)[\s\S]*?overflow:hidden;/u);
  assert.match(css, /@media \(max-width:760px\)[\s\S]*?\.category-hero-copy \{ order:0; \}[\s\S]*?\.category-hero-decision \{ order:1; \}/u);
  assert.match(settings, /Фото используется на главной и в категории/u);
  assert.match(settings, /Товар показывается целиком, без обрезки/u);
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
