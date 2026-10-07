import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("homepage presents the four commercial trust conditions with honest qualifiers", async () => {
  const page = await read("../app/page.tsx");
  for (const text of ["Доставка по России", "Отсрочка платежа", "Счёт с НДС", "Гарантия"]) {
    assert.match(page, new RegExp(text, "u"));
  }
  assert.match(page, /УПД и закрывающие документы/u);
  for (const href of ["/delivery", "/payment", "/ordering", "/warranty"]) {
    assert.match(page, new RegExp(`href="${href}"`, "u"));
  }
  assert.match(page, /возможна для организаций после согласования/u);
});

test("header menu keeps directions textual and gives concrete subcategories uncropped media", async () => {
  const [menu, tiles, settings, css] = await Promise.all([
    read("../app/ui/HeaderCatalogMenu.tsx"),
    read("../app/ui/HomepageCategoryTiles.tsx"),
    read("../app/ui/HomepageContentSettingsForm.tsx"),
    read("../app/globals.css"),
  ]);

  assert.match(menu, /HomepageCategoryMedia/u);
  assert.match(menu, /header-catalog-subcategory-media/u);
  assert.match(menu, /subcategory\.image/u);
  assert.doesNotMatch(menu, /group\.representativeImage \|\| group\.image/u);
  assert.match(tiles, /compact \? "contain"/u);
  assert.match(tiles, /compact \? "center"/u);
  assert.match(settings, /Для разделов первого экрана обрезка отключена/u);
  assert.match(css, /\.homepage-category-tiles--hero \.homepage-category-tile-media img[\s\S]*?object-fit:contain!important/u);
  assert.match(css, /\.header-catalog-subcategory-media img[^}]*object-fit:contain/u);
  assert.match(css, /\.header-catalog-panel \{ max-height:calc\(100dvh - 112px\)/u);
});

test("homepage uses a wider but bounded desktop canvas", async () => {
  const css = await read("../app/globals.css");
  assert.match(css, /@media \(min-width:1600px\)[\s\S]*?\.site-header \.header-row,[\s\S]*?\.homepage-main \.container \{ width:min\(1560px,calc\(100% - 96px\)\)/u);
});
