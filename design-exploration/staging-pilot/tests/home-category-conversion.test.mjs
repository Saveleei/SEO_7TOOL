import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getFeedCategory, getPublishedFeedCategorySlugs } from "../app/data/feedCatalog.ts";
import { DEFAULT_HOMEPAGE_CONTENT_SETTINGS } from "../app/data/homepageContentModel.ts";
import { getCanonicalCatalogGroups, getHomepageKeyCategories, getProductionCategoryGroups, homepageKeyCategorySlugs } from "../app/data/productionCategoryGroups.ts";

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
      assert.match(subcategory.href, new RegExp(`^/c/${subcategory.slug}$`, "u"));
    }
  }
  const keyCategories = getHomepageKeyCategories();
  assert.deepEqual(keyCategories.map((category) => category.slug), [...homepageKeyCategorySlugs]);
  assert.equal(new Set(keyCategories.map((category) => category.slug)).size, keyCategories.length);
  for (const category of keyCategories) {
    assert.ok(category.image, `${category.slug}: homepage category has no image`);
    assert.ok((category.count ?? 0) > 0, `${category.slug}: homepage category has no products`);
    assert.equal(category.href, `/c/${category.slug}`);
  }
});

test("canonical catalog gives every category one authoritative home", () => {
  const published = getPublishedFeedCategorySlugs();
  const groups = getCanonicalCatalogGroups(published);
  const slugs = groups.flatMap((group) => group.subcategories.map((subcategory) => subcategory.slug));
  assert.equal(new Set(slugs).size, slugs.length);
  assert.deepEqual(new Set(slugs), new Set(published));
  assert.equal(groups.find((group) => group.slug === "tooling")?.subcategories.some((item) => item.slug === "koronchatye-sverla"), true);
  assert.equal(groups.find((group) => group.slug === "drilling")?.subcategories.some((item) => item.slug === "koronchatye-sverla"), false);
  for (const group of groups) assert.equal(group.href, `/catalog#direction-${group.slug}`);
});

test("homepage first viewport explains the assortment and separates search from task selection", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(DEFAULT_HOMEPAGE_CONTENT_SETTINGS.hero.title, /Промышленное оборудование и оснастка для металлообработки/u);
  assert.match(DEFAULT_HOMEPAGE_CONTENT_SETTINGS.hero.intro, /Сверление, резка, обработка кромки/u);
  assert.match(page, /Открыть каталог/u);
  assert.match(DEFAULT_HOMEPAGE_CONTENT_SETTINGS.categories.title, /Ключевые разделы каталога/u);
  assert.match(page, /hero-catalog-card/u);
  assert.match(page, /<HomepageCategoryTiles categories=\{homepageKeyCategories\} compact \/>/u);
  assert.match(page, /На главной — 6 основных разделов/u);
  assert.doesNotMatch(page, /assortmentGroups\.map|hero-assortment-map/u);
  assert.match(page, /href="#production-categories"/u);
  assert.match(page, /HomepageCategoryTiles/u);
  assert.match(page, /HomepageTaskPaths/u);
  assert.doesNotMatch(page, /<ProductionCategoryGrid/u);
  assert.ok(page.indexOf('className="hero-catalog-card"') < page.indexOf('id="production-categories"'), "direct category entry should precede task navigation");
  assert.doesNotMatch(page, /<HeroSearch/u);
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
  assert.match(catalogPage, /catalog-direction--compact/u);
  assert.match(catalogPage, /className="catalog-direction-overview"/u);
  assert.match(catalogPage, /subcategory\.count/u);
  assert.match(catalogPage, /subcategory\.image/u);
  assert.match(catalogPage, /catalog-subcategory-media/u);
  assert.match(catalogPage, /getCanonicalCatalogGroups/u);
  assert.match(catalogPage, /formatSeriesCount/u);
  assert.doesNotMatch(catalogPage, /товарных групп/u);
  assert.match(taskPage, /subcategory\.image \?\? group\.image/u);
  assert.match(taskPage, /subcategory\.count/u);
  assert.match(grid, /production-category-card--featured/u);
  assert.doesNotMatch(grid, /subcategory\.count/u);
  assert.match(grid, /group\.subcategories\.slice\(0, 3\)/u);
  assert.match(grid, /production-category-more/u);
  assert.match(grid, /Все категории направления/u);
});

test("homepage catalog tiles lead to real categories without SKU noise", async () => {
  const [grid, tasks] = await Promise.all([
    readFile(new URL("../app/ui/HomepageCategoryTiles.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ui/HomepageTaskPaths.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(grid, /href=\{category\.href\}/u);
  assert.match(grid, /Ключевые разделы каталога/u);
  assert.match(grid, /formatProductCount/u);
  assert.match(grid, /category\.image/u);
  assert.doesNotMatch(grid, /Артикул|sku|Добавить в КП/u);
  assert.doesNotMatch(tasks, /group\.representativeImage/u);
  assert.match(tasks, /HomepageCategoryMedia src=\{category\.image\}/u);
  assert.match(tasks, /group\.subcategories\.slice\(0, 4\)/u);
  assert.match(tasks, /href=\{category\.href\}/u);
  assert.match(tasks, /homepage-task-path__subcategories/u);
  assert.match(tasks, /Подобрать по задаче/u);
  assert.doesNotMatch(tasks, /details|Артикул|Добавить в КП/u);
});
