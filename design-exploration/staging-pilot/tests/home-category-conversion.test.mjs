import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getFeedCategory, getPublishedFeedCategorySlugs } from "../app/data/feedCatalog.ts";
import { getProductionCategoryGroups } from "../app/data/productionCategoryGroups.ts";

test("homepage production tasks expose every published category with feed-backed counts", () => {
  const published = getPublishedFeedCategorySlugs();
  const groups = getProductionCategoryGroups(published);
  const discoverable = new Set(groups.flatMap((group) => group.subcategories.map((subcategory) => subcategory.slug)));

  assert.equal(groups.length, 6);
  for (const slug of published) assert.ok(discoverable.has(slug), `${slug} is missing from production-task discovery`);
  for (const group of groups) {
    assert.ok(group.productCount > 0, `${group.slug}: empty task count`);
    for (const subcategory of group.subcategories) {
      assert.equal(subcategory.count, getFeedCategory(subcategory.slug)?.count, `${subcategory.slug}: count drift`);
      assert.match(subcategory.href, new RegExp(`^/catalog/category/${subcategory.slug}$`, "u"));
    }
  }
});

test("homepage first viewport explains the assortment and separates search from task selection", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /Промышленное оборудование и оснастка для металлообработки/u);
  assert.match(page, /Магнитные и ленточнопильные станки/u);
  assert.match(page, /Знаете, что искать\?/u);
  assert.match(page, /Что поставляет 7TOOL/u);
  assert.match(page, /categoryGroups\.map/u);
  assert.match(page, /group\.subcategories\[0\]\?\.image/u);
  assert.match(page, /Основные направления каталога/u);
  assert.match(page, /Не знаете модель\? Подобрать по задаче/u);
  assert.match(page, /href="#production-categories"/u);
  assert.match(page, /data-contact-placement="homepage_hero"/u);
  assert.match(page, /siteContact\.phoneHref/u);
  assert.match(page, /mailto:\$\{siteContact\.email\}/u);
  assert.doesNotMatch(page, /Популярные позиции пилотного каталога/u);
  assert.doesNotMatch(page, /href="\/catalog\/sverlenie"/u);
});

test("buyers can switch sibling categories before entering product filters", async () => {
  const categoryPage = await readFile(new URL("../app/catalog/category/[slug]/page.tsx", import.meta.url), "utf8");
  const navigationPosition = categoryPage.indexOf("category-sibling-navigation");
  const listingPosition = categoryPage.indexOf("feed-category-listing");
  assert.ok(navigationPosition > 0);
  assert.ok(listingPosition > navigationPosition);
  assert.match(categoryPage, /aria-current=\{item\.slug === slug \? "page"/u);
  assert.match(categoryPage, /item\.count/u);
});

test("catalog and task pages lead with category identity instead of repeated task artwork", async () => {
  const [catalogPage, taskPage, grid] = await Promise.all([
    readFile(new URL("../app/catalog/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/catalog/task/[task]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ui/ProductionCategoryGrid.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(catalogPage, /<article className="catalog-direction"/u);
  assert.match(catalogPage, /subcategory\.count/u);
  assert.match(taskPage, /subcategory\.image \?\? group\.image/u);
  assert.match(taskPage, /subcategory\.count/u);
  assert.match(grid, /production-category-card--featured/u);
  assert.match(grid, /subcategory\.count/u);
});
