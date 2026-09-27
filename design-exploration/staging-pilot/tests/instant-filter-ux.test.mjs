import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("category filters apply changes without a second confirmation click", async () => {
  const [categoryPage, controls, css] = await Promise.all([
    read("../app/catalog/category/[slug]/page.tsx"),
    read("../app/ui/AutoApplyFilters.tsx"),
    read("../app/globals.css"),
  ]);

  assert.match(categoryPage, /<AutoApplyFilterPanel/u);
  assert.match(categoryPage, /<AutoApplySortForm/u);
  assert.doesNotMatch(categoryPage, />Показать товары</u);
  assert.doesNotMatch(categoryPage, />Применить</u);
  assert.match(controls, /onChange=\{queueApply\}/u);
  assert.match(controls, /needsTypingPause \? 520 : 120/u);
  assert.match(controls, /router\.replace\(href, \{ scroll:false \}\)/u);
  assert.match(controls, /Изменения применяются автоматически/u);
  assert.match(controls, /feed-filter-mobile-results/u);
  assert.match(css, /\.feed-filter-mobile-results \{ display:none; \}/u);
  assert.match(css, /@media \(max-width:1180px\)[\s\S]*\.feed-filter-mobile-results \{[^}]*display:flex/u);
  assert.match(css, /@media \(max-width:760px\)[\s\S]*\.feed-filter-actions--auto \{ bottom:62px; \}/u);
});

test("automatic filters keep shareable query state and ignore empty fields", async () => {
  const controls = await read("../app/ui/AutoApplyFilters.tsx");
  assert.match(controls, /new FormData\(form\)\.entries\(\)/u);
  assert.match(controls, /!value\.trim\(\) \|\| key === "page"/u);
  assert.match(controls, /params\.append\(key, value\.trim\(\)\)/u);
  assert.match(controls, /#feed-filter-panel/u);
  assert.match(controls, /#products/u);
  assert.match(controls, /aria-live="polite"/u);
});
