import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const catalog = JSON.parse(fs.readFileSync(path.join(root, "src", "lib", "products.json"), "utf8"));
const publicCategorySlugs = new Set(catalog.categories.filter((category) => category.published !== false).map((category) => category.slug));
const hasImage = (product) => (product.images || []).some(Boolean) || (product.variants || []).some((variant) => (variant.images || []).some(Boolean));
const products = catalog.products.filter((product) => !product.draft && publicCategorySlugs.has(product.category) && hasImage(product));

function validPrice(value) {
  return Number.isFinite(value) && value > 0;
}

function state(product) {
  const variants = product.variants || [];
  const inStock = variants.filter((variant) => variant.available !== false && (variant.quantity || 0) > 0);
  const orderable = variants.filter((variant) => variant.available !== false);
  const source = inStock.length ? inStock : orderable;
  const prices = source.map((variant) => variant.price).filter(validPrice);
  const priority = inStock.length === variants.length && variants.length
    ? 0
    : inStock.length
      ? 1
      : orderable.length
        ? 2
        : variants.length
          ? 3
          : 4;
  return { priority, hasPrice: prices.length > 0, minPrice: prices.length ? Math.min(...prices) : Infinity };
}

function compare(a, b) {
  const aa = state(a);
  const bb = state(b);
  return aa.priority - bb.priority
    || Number(bb.hasPrice) - Number(aa.hasPrice)
    || aa.minPrice - bb.minPrice
    || a.title.localeCompare(b.title, "ru")
    || a.id.localeCompare(b.id);
}

test("публичный каталог содержит базовые направления и не публикует пустые категории", () => {
  const categories = catalog.categories.filter((category) => category.published !== false);
  assert.ok(categories.length >= 9);
  const known = new Set(categories.map((category) => category.slug));
  for (const required of [
    "borfrezy", "stanki-sverlilnye", "koronchatye-sverla", "truborezy",
    "kromkorezy-dlya-trub", "kromkorezy-po-listu", "karetki-svarochnye",
    "rezbonareznye-manipulyatory", "karetki-termicheskoy-rezki",
    "sverla-i-zenkovki", "stanki-lazernoy-rezki", "svarochnye-roboty", "stanochnaya-osnastka",
  ]) assert.ok(known.has(required), `missing base category: ${required}`);
  for (const category of categories) {
    assert.ok(products.some((product) => product.category === category.slug), `empty category: ${category.slug}`);
  }
  for (const product of products) assert.ok(known.has(product.category), `unknown category: ${product.category}`);
});

test("идентификаторы и публичные URL товаров уникальны", () => {
  assert.equal(new Set(products.map((product) => product.id)).size, products.length);
  assert.equal(new Set(products.map((product) => product.slug)).size, products.length);
  const variantIds = products.flatMap((product) => product.variants.map((variant) => variant.id));
  assert.equal(new Set(variantIds).size, variantIds.length);
  for (const product of products) {
    assert.match(product.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(product.variants.length > 0, `product without variants: ${product.id}`);
    assert.equal(new Set(product.variants.map((variant) => variant.id)).size, product.variants.length);
  }
});

test("семейства корончатых свёрл из дилерского фида не теряются при релизе", () => {
  const ids = new Set(products.map((product) => product.id));
  assert.ok(ids.has("G3652"), "missing BDS HKL feed group");
  assert.ok(ids.has("G3655"), "missing Ravic 220.2 feed group");
});

test("актуальный snapshot публикует полный товарный уровень дилерского фида", () => {
  assert.ok(products.length >= 1770, `published only ${products.length} products`);
  const represented = new Set();
  for (const product of products) {
    represented.add(product.id);
    for (const variant of product.variants) represented.add(variant.id);
  }
  assert.ok(represented.size >= 7091, `represented only ${represented.size} feed offers`);
});

test("каталог не публикует нулевые и отрицательные цены", () => {
  for (const product of products) {
    for (const variant of product.variants) {
      if (variant.price != null) assert.ok(validPrice(variant.price), `${variant.id}: ${variant.price}`);
      if (variant.oldPrice != null) assert.ok(validPrice(variant.oldPrice), `${variant.id}: old ${variant.oldPrice}`);
    }
  }
});

test("коммерческая сортировка детерминирована: наличие, цена, название", () => {
  const sorted = [...products].sort(compare);
  for (let index = 1; index < sorted.length; index++) {
    assert.ok(compare(sorted[index - 1], sorted[index]) <= 0);
  }
  assert.ok(state(sorted[0]).priority <= state(sorted.at(-1)).priority);
});

test("критические UX и эксплуатационные контуры присутствуют", () => {
  const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
  const layout = read("src/app/layout.tsx");
  const leadApi = read("src/app/api/lead/route.ts");
  const categoryFilters = read("src/app/c/[slug]/CategoryFilters.tsx");
  const categoryPage = read("src/app/c/[slug]/page.tsx");
  const subcategoryPage = read("src/app/c/[slug]/[subslug]/page.tsx");
  const categoryGrid = read("src/components/CategoryGrid.tsx");
  const selectionForm = read("src/components/CategorySelectionForm.tsx");
  const categoryContent = read("src/lib/category-content.ts");
  const leadClient = read("src/lib/lead-client.ts");
  const managerFloating = read("src/components/ManagerFloating.tsx");
  const subcategories = read("src/lib/subcategories.ts");
  const subcategoryGrid = read("src/components/SubcategoryGrid.tsx");
  const cardLive = read("src/components/CardLive.tsx");
  const productView = read("src/app/p/[slug]/ProductView.tsx");
  const productPage = read("src/app/p/[slug]/page.tsx");
  const productFaq = read("src/components/ProductFaq.tsx");
  const productJsonLd = read("src/components/ProductJsonLd.tsx");
  const productSeo = read("src/lib/product-seo.ts");
  const productSeoGenerator = read("scripts/generate-product-seo.mjs");
  const fallbackSeoGenerator = read("scripts/generate-programmatic-seo.mjs");
  const homePage = read("src/app/page.tsx");
  const feedSync = read("scripts/refresh-feed.mts");
  const categoryMigration = read("scripts/apply-category-priority.mjs");
  const upload = read("src/lib/upload-storage.ts");
  assert.doesNotMatch(layout, /LiveOrders|ExitIntent/);
  assert.match(leadApi, /429/);
  assert.match(leadApi, /body\.website/);
  assert.match(leadApi, /x-forwarded-host/);
  assert.match(categoryFilters, /index === 5/);
  assert.match(categoryGrid, /c\.coverImage \?\?/);
  assert.match(categoryGrid, /hasManualCover \? "object-cover"/);
  assert.match(categoryFilters, /#selection-form/);
  assert.match(categoryPage, /dynamicParams = true/);
  assert.match(subcategoryPage, /dynamicParams = true/);
  assert.match(selectionForm, /id="selection-form"/);
  assert.match(selectionForm, /name="requisites"/);
  assert.match(selectionForm, /fields\.slice\(0, 3\)/);
  assert.match(selectionForm, /productReference/);
  assert.match(leadClient, /body\.set\("requisites"/);
  assert.match(leadClient, /new FormData\(\)/);
  assert.match(managerFloating, /bottom-\[88px\]/);
  assert.match(subcategories, /"beschetochnye"/);
  assert.match(subcategories, /"avtomaticheskie"/);
  assert.match(subcategories, /"osnastka"/);
  const categorySlugs = [
    "borfrezy", "stanki-sverlilnye", "koronchatye-sverla", "truborezy",
    "kromkorezy-dlya-trub", "kromkorezy-po-listu", "karetki-svarochnye",
    "rezbonareznye-manipulyatory", "karetki-termicheskoy-rezki", "pilnye-diski",
    "kompressory", "metchiki", "lentochnopilnye-stanki",
    "shlifovalnoe-i-zatochnoe-oborudovanie", "magnitnaya-osnastka", "almaznoe-burenie",
    "svarochnye-vrashchateli-i-pozitsionery", "zahvaty-dlya-gruzov", "sozh-i-sots",
    "disko-otreznye-stanki", "vibroopory", "verstaki",
    "sverla-i-zenkovki", "stanki-lazernoy-rezki", "svarochnye-roboty", "stanochnaya-osnastka",
  ];
  for (const categorySlug of categorySlugs) {
    assert.match(subcategories, new RegExp(`define\\("${categorySlug}"`), `missing quick choices for ${categorySlug}`);
    assert.match(categoryContent, new RegExp(`(?:"${categorySlug}"|${categorySlug}):\\s*\\{`), `missing selection profile for ${categorySlug}`);
  }
  for (const task of ["Монтажный рез на объекте", "Оснастить рабочее место", "Пескоструйная обработка", "Снизить вибрацию станка", "Слесарные работы"]) {
    assert.match(categoryContent, new RegExp(task), `missing expanded task: ${task}`);
  }
  assert.match(subcategories, /field: "feedCategory", values: \["148"\]/);
  assert.match(subcategoryGrid, /title: "Все товары категории"/);
  assert.ok(
    subcategoryGrid.indexOf('title: "Все товары категории"') < subcategoryGrid.indexOf("...items"),
    "all products must be the first quick choice",
  );
  assert.match(cardLive, /intent="quote"/);
  assert.match(productView, /CategorySelectionForm/);
  assert.doesNotMatch(productView, /<StickyTabs/);
  assert.ok(
    productView.indexOf('id="p-info"') < productView.lastIndexOf("<CategorySelectionForm")
      && productView.lastIndexOf("<CategorySelectionForm") < productView.lastIndexOf("<ProductFaq"),
    "product content order must be description, selection form, FAQ",
  );
  assert.match(productFaq, /<details/);
  assert.match(productPage, /buildProductSeo/);
  assert.match(productFaq, /Москве и Санкт-Петербурге/);
  assert.match(productJsonLd, /additionalProperty/);
  assert.match(productJsonLd, /ProductGroup/);
  assert.match(productJsonLd, /hasVariant/);
  assert.match(productJsonLd, /isVariantOf/);
  assert.match(productSeo, /name} купить/);
  assert.match(productSeo, /Москве и Санкт-Петербурге/);
  assert.match(productSeo, /titleNeedsSku/);
  assert.match(productSeo, /descriptionNeedsSku/);
  assert.match(productSeoGenerator, /product\.seoSource !== "manual"/);
  assert.match(fallbackSeoGenerator, /product\.seoSource === "manual"/);
  assert.match(fallbackSeoGenerator, /programmatic:v/);
  assert.match(homePage, /canonical: "\/"/);
  assert.match(feedSync, /addedProducts/);
  assert.match(feedSync, /representedFeedOffers/);
  assert.match(feedSync, /MIN_EXPECTED_OFFERS/);
  assert.match(feedSync, /CATALOG_JSON_PATH/);
  assert.match(feedSync, /pilnye-diski/);
  assert.match(feedSync, /ensureFeedCategories/);
  assert.match(feedSync, /"148": "kromkorezy-po-listu"/);
  assert.match(feedSync, /product\.feedCategoryId = categoryId/);
  assert.match(feedSync, /const OBSOLETE_CATEGORY_SLUGS = new Set\(\["osnastka-dlya-kromkorezov"\]\)/);
  for (const newCategory of ["sverla-i-zenkovki", "stanki-lazernoy-rezki", "svarochnye-roboty", "stanochnaya-osnastka"]) {
    assert.match(feedSync, new RegExp(newCategory), `missing feed mapping for ${newCategory}`);
  }
  assert.match(categoryMigration, /SOURCE_CATEGORY = "osnastka-dlya-kromkorezov"/);
  assert.match(categoryMigration, /TARGET_CATEGORY = "kromkorezy-po-listu"/);
  assert.match(upload, /UPLOAD_DIR/);
  assert.ok(fs.existsSync(path.join(root, "src", "app", "c", "[slug]", "[subslug]", "page.tsx")));
});

test("все опубликованные товарные группы имеют уникальное предметное SEO", () => {
  const titles = new Set();
  const descriptions = new Set();
  for (const product of products) {
    assert.ok(product.metaTitle, `missing meta title: ${product.id}`);
    assert.ok(product.metaDescription, `missing meta description: ${product.id}`);
    assert.ok(product.seoText, `missing SEO text: ${product.id}`);
    assert.ok(product.metaTitle.length <= 80, `${product.id}: title ${product.metaTitle.length}`);
    assert.ok(product.metaDescription.length >= 120 && product.metaDescription.length <= 200, `${product.id}: description ${product.metaDescription.length}`);
    assert.ok(!titles.has(product.metaTitle), `duplicate meta title: ${product.metaTitle}`);
    assert.ok(!descriptions.has(product.metaDescription), `duplicate meta description: ${product.metaDescription}`);
    titles.add(product.metaTitle);
    descriptions.add(product.metaDescription);
  }
});

test("SEO pipeline защищён от конфликтов данных и перезаписи категорий", () => {
  const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
  assert.match(read("scripts/hourly-refresh.sh"), /npm run data:check/);
  assert.match(read("scripts/nightly-rebuild.sh"), /npm run data:check/);
  assert.match(read("scripts/generate-programmatic-seo.mjs"), /SEO_DATA_CONFLICT/);
  assert.match(read("scripts/generate-programmatic-seo.mjs"), /--category/);
  assert.match(read("src/app/p/[slug]/page.tsx"), /resolvePublicProductSlug/);
  assert.match(read("src/app/p/[slug]/page.tsx"), /dynamic = "force-dynamic"/);
});

test("публичные SEO-тексты не содержат неподтверждённых коммерческих обещаний", () => {
  const combined = products.map((product) => `${product.metaTitle}\n${product.metaDescription}\n${product.seoText}`).join("\n");
  assert.doesNotMatch(combined, /постоплат|30 банковских|официальн(?:ый|ого) дилер|гарантия от 12|возврат в течение 14/i);
});
