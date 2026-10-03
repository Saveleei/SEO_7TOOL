import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("catalog navigation media uses one uncropped containment contract", async () => {
  const [menu, category, css] = await Promise.all([
    read("../app/ui/HeaderCatalogMenu.tsx"),
    read("../app/catalog/category/[slug]/page.tsx"),
    read("../app/globals.css"),
  ]);

  assert.match(menu, /header-catalog-subcategory-media/u);
  assert.match(category, /category-assortment-shortcut-media/u);
  assert.match(css, /\.header-catalog-subcategory-media img \{[^}]*inset:6px!important;[^}]*object-fit:contain!important;[^}]*padding:0!important;/u);
  assert.match(css, /\.homepage-task-path__subcategory-media img \{[^}]*inset:6px!important;[^}]*object-fit:contain!important;[^}]*padding:0!important;/u);
  assert.match(css, /\.category-assortment-shortcut-media img \{[^}]*inset:7px!important;[^}]*object-fit:contain!important;[^}]*padding:0!important;/u);
});

test("homepage task navigation keeps readable type and removes the accidental third row", async () => {
  const [paths, css] = await Promise.all([
    read("../app/ui/HomepageTaskPaths.tsx"),
    read("../app/globals.css"),
  ]);

  assert.match(paths, /group\.subcategories\.slice\(0, 4\)/u);
  assert.doesNotMatch(paths, /homepage-task-path__more/u);
  assert.match(paths, /Все \{group\.subcategories\.length\} категорий/u);
  assert.match(css, /\.homepage-task-path \{[^}]*min-height:332px;[^}]*height:100%;/u);
  assert.match(css, /\.homepage-task-path__subcategory-copy>b \{ font-size:15px;/u);
  assert.match(css, /\.homepage-task-path__subcategory-copy>small \{[^}]*font-size:12px;/u);
  assert.match(css, /\.homepage-task-path__action>span>small \{[^}]*font-size:var\(--type-caption\);/u);
});

test("desktop tablet and mobile layouts preserve legible media and hit targets", async () => {
  const css = await read("../app/globals.css");

  assert.match(css, /\.header-catalog-grid nav>a \{ min-height:74px; grid-template-columns:64px minmax\(0,1fr\) 14px;/u);
  assert.match(css, /\.category-page-shell \.category-assortment-shortcuts>\.container>div>a,[\s\S]*?min-height:96px;[\s\S]*?grid-template-columns:76px minmax\(0,1fr\) 38px;/u);
  assert.match(css, /@media \(max-width:1050px\)[\s\S]*?\.homepage-task-paths \{ grid-template-columns:1fr 1fr; \}/u);
  assert.match(css, /@media \(max-width:760px\)[\s\S]*?\.homepage-task-paths \{ grid-template-columns:1fr;/u);
  assert.match(css, /@media \(max-width:760px\)[\s\S]*?\.homepage-task-path\[data-expanded="true"\] \.homepage-task-path__subcategories>a:nth-child\(n\) \{ min-height:92px;/u);
  assert.match(css, /@media \(max-width:760px\)[\s\S]*?\.header-catalog-grid>section\[data-expanded="true"\]>nav>a \{ min-height:76px;/u);
  assert.match(css, /@media \(max-width:760px\)[\s\S]*?\.category-page-shell \.category-assortment-shortcuts>\.container>div>a,[\s\S]*?min-height:92px;/u);
});
