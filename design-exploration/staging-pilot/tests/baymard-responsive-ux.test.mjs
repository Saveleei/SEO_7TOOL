import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("responsive type and control contract stays readable across the buying path", async () => {
  const css = await read("../app/globals.css");
  const contract = css.slice(css.lastIndexOf("/* Baymard-informed B2B responsive pass"));

  assert.match(contract, /--type-body:16px/u);
  assert.match(contract, /--type-reading:17px/u);
  assert.match(contract, /text-rendering:optimizeLegibility/u);
  assert.match(contract, /:where\(a,button,input,select,textarea,summary\):focus-visible/u);
  assert.match(contract, /\.feed-product-actions button,\.feed-product-actions>a,[\s\S]*?min-height:44px/u);
  const firstScreen = contract.slice(contract.lastIndexOf("/* Mobile homepage first-screen refinement"));
  assert.match(firstScreen, /\.homepage-main \.hero-primary-actions \{ grid-template-columns:minmax\(0,1\.08fr\) minmax\(0,\.92fr\);/u);
  assert.match(contract, /@media \(max-width:760px\)[\s\S]*?\.feed-mobile-order-actions>button \{ min-height:48px;/u);
  assert.match(contract, /@media \(prefers-reduced-motion:reduce\)/u);
});

test("mobile preserves an overview of trust conditions instead of hiding them in a carousel", async () => {
  const css = await read("../app/globals.css");
  const contract = css.slice(css.lastIndexOf("/* Baymard-informed B2B responsive pass"));

  assert.match(contract, /\.proof-strip \.proof-grid \{[\s\S]*?display:grid;[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\);[\s\S]*?overflow:visible;/u);
  assert.match(contract, /\.proof-grid>div \{ min-width:0; min-height:104px;/u);
});

test("task navigation gives the title priority and starts as a compact mobile overview", async () => {
  const paths = await read("../app/ui/HomepageTaskPaths.tsx");

  assert.match(paths, /useState\(""\)/u);
  assert.match(paths, /homepage-task-path__copy"><h3>[\s\S]*?<\/h3><small>\{group\.accent\}<\/small>/u);
  assert.match(paths, /aria-expanded=\{expanded\}/u);
});

test("catalog labels and filter values remain complete decision data", async () => {
  const css = await read("../app/globals.css");
  const contract = css.slice(css.lastIndexOf("/* Baymard-informed B2B responsive pass"));

  assert.match(contract, /\.header-catalog-grid nav>a>span:nth-child\(2\)>b \{ font-size:15px; line-height:1\.28; \}/u);
  assert.match(contract, /\.feed-filter-panel fieldset label span \{[\s\S]*?overflow:visible;[\s\S]*?white-space:normal;/u);
  assert.match(contract, /\.feed-results-toolbar \{[\s\S]*?min-height:54px;[\s\S]*?background:#fafbf9;/u);
});

test("tablet hero preserves a readable value proposition and direct catalog entrances", async () => {
  const css = await read("../app/globals.css");
  const contract = css.slice(css.lastIndexOf("/* Baymard-informed B2B responsive pass"));

  assert.match(contract, /@media \(min-width:761px\) and \(max-width:960px\)[\s\S]*?\.homepage-main \.hero-grid \{[\s\S]*?grid-template-columns:1fr;/u);
  assert.match(contract, /@media \(min-width:761px\) and \(max-width:960px\)[\s\S]*?\.homepage-main \.hero-grid>\.hero-catalog-card \{ display:none; \}/u);
  assert.match(contract, /\.hero-mobile-catalog-preview \.homepage-category-tiles--hero \{[\s\S]*?grid-template-columns:repeat\(3,minmax\(0,1fr\)\);/u);
});

test("mobile category task prompt wraps without losing deciding words", async () => {
  const css = await read("../app/globals.css");
  const contract = css.slice(css.lastIndexOf("/* Baymard-informed B2B responsive pass"));

  assert.match(contract, /\.category-page-shell \.category-assortment-shortcuts header b \{[\s\S]*?max-width:none;[\s\S]*?overflow:visible;[\s\S]*?text-overflow:clip;[\s\S]*?white-space:normal;/u);
});
