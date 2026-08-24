import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  buildArticleStructuredData,
  buildBreadcrumbList,
  buildOrganizationStructuredData,
  buildProductStructuredData,
  buildVideoObjectStructuredData,
  safeJsonLd,
} from "../src/lib/structured-data.mjs";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function productFixture(overrides = {}) {
  return {
    sellerId: "https://7tool.ru/#organization",
    isGroup: true,
    group: {
      id: "product-1",
      url: "https://7tool.ru/p/magnetic-drill",
      name: "Магнитный сверлильный станок",
      description: "Станок для сверления металла.",
      sku: "GROUP-1",
      brand: "Verified Brand",
      category: "Сверлильные станки",
      images: ["https://7tool.ru/img/drill.webp"],
      variesBy: ["https://schema.org/size"],
    },
    variants: [{
      id: "variant-1",
      url: "https://7tool.ru/p/magnetic-drill--40",
      name: "Магнитный сверлильный станок · 40 мм",
      description: "Модификация с подтверждённым диаметром 40 мм.",
      sku: "DRILL-40",
      gtin: "4601234567893",
      images: ["https://7tool.ru/img/drill-40.webp"],
      brand: "Verified Brand",
      category: "Сверлильные станки",
      additionalProperty: [{ name: "Диаметр", value: "40 мм" }],
      offer: {
        price: 125000,
        priceCurrency: "RUB",
        availability: "https://schema.org/InStock",
        shippingDetails: { addressCountry: "RU", shippingRate: 0, priceCurrency: "RUB" },
        returnPolicy: {
          applicableCountry: "RU",
          returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
          merchantReturnDays: 30,
        },
      },
    }],
    ...overrides,
  };
}

test("Product, Offer and Brand use only complete current commerce fields", () => {
  const product = buildProductStructuredData(productFixture());
  assert.equal(product["@type"], "ProductGroup");
  assert.equal(product.brand["@type"], "Brand");
  assert.equal(product.offers["@type"], "AggregateOffer");
  assert.equal(product.offers.lowPrice, 125000);
  const variant = product.hasVariant[0];
  assert.equal(variant["@type"], "Product");
  assert.equal(variant.sku, "DRILL-40");
  assert.equal(variant.gtin13, "4601234567893");
  assert.equal(variant.mpn, undefined, "SKU must not be copied into an unverified MPN");
  assert.equal(variant.offers.priceCurrency, "RUB");
  assert.equal(variant.offers.availability, "https://schema.org/InStock");
  assert.equal(variant.offers.itemCondition, undefined);
  assert.equal(variant.offers.shippingDetails, undefined, "an unreviewed shipping object must stay private");
  assert.equal(variant.offers.hasMerchantReturnPolicy, undefined, "an unreviewed return policy must stay private");
});

test("optional product policies appear only after explicit complete verification", () => {
  const fixture = productFixture();
  fixture.selectedVariantId = "variant-1";
  fixture.variants[0].mpn = "MANUFACTURER-40";
  fixture.variants[0].offer.itemCondition = "https://schema.org/NewCondition";
  fixture.variants[0].offer.shippingDetails.verified = true;
  fixture.variants[0].offer.returnPolicy.verified = true;
  fixture.variants[0].offer.returnPolicy.returnMethod = "https://schema.org/ReturnByMail";
  fixture.variants[0].offer.returnPolicy.returnFees = "https://schema.org/ReturnFeesCustomerResponsibility";
  const product = buildProductStructuredData(fixture);
  assert.equal(product["@type"], "Product");
  assert.equal(product.mpn, "MANUFACTURER-40");
  assert.equal(product.offers.itemCondition, "https://schema.org/NewCondition");
  assert.equal(product.offers.shippingDetails.shippingDestination.addressCountry, "RU");
  assert.equal(product.offers.hasMerchantReturnPolicy.merchantReturnDays, 30);
  assert.equal(buildProductStructuredData(productFixture({ variants: [{
    id: "bad", url: "https://7tool.ru/p/bad", name: "Без цены", sku: "BAD",
    offer: { price: 0, priceCurrency: "RUB", availability: "https://schema.org/InStock" },
  }] })).hasVariant[0].offers, undefined);
});

test("Article and BreadcrumbList match visible reviewed article data", () => {
  const article = buildArticleStructuredData({
    url: "https://7tool.ru/articles/kak-vybrat-stanok",
    headline: "Как выбрать магнитный сверлильный станок",
    description: "Проверенные критерии выбора станка.",
    images: ["https://7tool.ru/media/article/1200.webp", "javascript:alert(1)"],
    datePublished: 1_700_000_000_000,
    dateModified: 1_700_086_400_000,
    author: "Иван Инженеров",
    reviewer: "Пётр Экспертов",
    publisherId: "https://7tool.ru/#organization",
    websiteId: "https://7tool.ru/#website",
    articleSection: "Сверлильные станки",
    keywords: ["магнитный станок", "магнитный станок", "выбор станка"],
  });
  assert.equal(article["@type"], "Article");
  assert.equal(article.mainEntityOfPage["@id"], "https://7tool.ru/articles/kak-vybrat-stanok");
  assert.equal(article.author["@type"], "Person");
  assert.equal(article.reviewedBy.name, "Пётр Экспертов");
  assert.deepEqual(article.image, ["https://7tool.ru/media/article/1200.webp"]);
  assert.deepEqual(article.keywords, ["магнитный станок", "выбор станка"]);
  const breadcrumb = buildBreadcrumbList([
    { name: "Главная", url: "https://7tool.ru/" },
    { name: "База знаний", url: "https://7tool.ru/articles" },
    { name: article.headline, url: article.mainEntityOfPage["@id"] },
  ], "https://7tool.ru/articles/kak-vybrat-stanok#breadcrumb");
  assert.deepEqual(breadcrumb.itemListElement.map((item) => item.position), [1, 2, 3]);
});

test("Organization is typed, JSON-LD is script-safe and VideoObject is content-gated", () => {
  const organization = buildOrganizationStructuredData({
    id: "https://7tool.ru/#organization",
    url: "https://7tool.ru",
    name: "7TOOL",
    address: { streetAddress: "Рябиновая улица, 63, стр. 4", addressLocality: "Москва", addressCountry: "RU" },
    contactPoints: [{
      contactType: "sales", telephone: "+7 962 611-24-19", availableLanguage: ["ru"],
      hoursAvailable: { dayOfWeek: ["Monday", "Tuesday"], opens: "09:00", closes: "19:00" },
    }],
    returnPolicy: { applicableCountry: "RU", returnPolicyCategory: "https://schema.org/MerchantReturnNotPermitted" },
  });
  assert.equal(organization.contactPoint[0].hoursAvailable["@type"], "OpeningHoursSpecification");
  assert.equal(organization.hasMerchantReturnPolicy, undefined);
  assert.equal(safeJsonLd({ value: "</script><script>alert(1)</script>&" }).includes("</script>"), false);
  assert.equal(buildVideoObjectStructuredData({
    name: "Демонстрация", description: "Проверенное видео", thumbnailUrl: ["https://7tool.ru/video.webp"], uploadDate: "2026-01-01",
  }), null, "VideoObject must not exist without a watchable video URL");
  assert.equal(buildVideoObjectStructuredData({
    name: "Демонстрация", description: "Проверенное видео", thumbnailUrl: ["https://7tool.ru/video.webp"],
    uploadDate: "2026-01-01", contentUrl: "https://7tool.ru/video.mp4", duration: "PT2M10S",
  })["@type"], "VideoObject");
});

test("public routes use the centralized safe renderer and canonical entity context", () => {
  const articlePage = read("src/app/articles/[slug]/page.tsx");
  const productPage = read("src/app/p/[slug]/page.tsx");
  const productJsonLd = read("src/components/ProductJsonLd.tsx");
  assert.match(articlePage, /buildArticleStructuredData/);
  assert.match(articlePage, /buildBreadcrumbList/);
  assert.match(productPage, /ProductJsonLd product=\{product\} variant=\{r\.variant\}/);
  assert.match(productJsonLd, /buildProductStructuredData/);
  assert.doesNotMatch(productJsonLd, /mpn:\s*item\.sku/);
  assert.match(read("src/app/brand/[slug]/page.tsx"), /about:\s*\{\s*"@type":\s*"Brand"/);
  assert.match(read("src/components/SiteJsonLd.tsx"), /contactPoints:\s*\[/);
  assert.match(read("src/app/dostavka-i-oplata/page.tsx"), /needsOwnerConfirmation/);
  assert.match(read("src/app/garantiya-i-vozvrat/page.tsx"), /needsOwnerConfirmation/);

  const structuredRenderer = path.join(root, "src", "components", "StructuredData.tsx");
  for (const directory of [path.join(root, "src", "app"), path.join(root, "src", "components")]) {
    for (const file of walk(directory)) {
      if (file === structuredRenderer || !/\.tsx$/.test(file)) continue;
      assert.doesNotMatch(fs.readFileSync(file, "utf8"), /type="application\/ld\+json"/, `${file} bypasses StructuredData`);
    }
  }
});

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}
