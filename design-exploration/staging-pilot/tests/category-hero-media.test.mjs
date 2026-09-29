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

test("category hero media is uncropped, stable and follows the mobile conversion path", async () => {
  const [page, media, settings, css] = await Promise.all([
    read("../app/catalog/category/[slug]/page.tsx"),
    read("../app/ui/HomepageCategoryMedia.tsx"),
    read("../app/ui/HomepageContentSettingsForm.tsx"),
    read("../app/globals.css"),
  ]);

  assert.match(page, /<HomepageCategoryMedia[\s\S]*?sizes="\(max-width: 760px\) calc\(100vw - 56px\)/u);
  assert.match(media, /sizes = "\(max-width: 760px\) 42vw/u);
  assert.match(media, /onError=\{\(\) => setFailed\(true\)\}/u);
  assert.match(css, /\.category-hero-media \{[^}]*grid-template-rows:minmax\(150px,1fr\) auto;[^}]*overflow:hidden;/u);
  assert.match(css, /\.category-hero-media-visual img \{[^}]*object-fit:contain!important;[^}]*object-position:center!important;/u);
  assert.match(css, /@media \(max-width:760px\)[\s\S]*?\.page-hero--category aside \{ grid-column:auto; order:2; \}[\s\S]*?\.category-hero-media \{[^}]*order:3;/u);
  assert.match(settings, /Фото используется на главной и в категории/u);
  assert.match(settings, /Товар показывается целиком, без обрезки/u);
});
