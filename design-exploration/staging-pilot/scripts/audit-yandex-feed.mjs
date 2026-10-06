import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { getCatalogBlockingProductIds } from "../app/data/catalogQuality.ts";
import { getPublishedFeedCatalogSnapshot } from "../app/data/feedCatalog.ts";
import { publicProductPath } from "../app/data/publicUrls.ts";
import { resolveYandexAdvertisingPictureUrl } from "../app/data/yandexAdvertisingFeed.ts";

const DEFAULT_FEED_URL = "https://7tool.ru/feeds/yandex-dynamic.xml";
const DEFAULT_ORIGIN = "https://7tool.ru";
const SAMPLE_LIMIT = 20;

export function parseYandexFeed(xml) {
  const catalogMatch = xml.match(/<yml_catalog\b([^>]*)>/iu);
  const catalogAttributes = parseAttributes(catalogMatch?.[1] ?? "");
  const shop = readTag(xml, "shop", false);
  const categories = new Map();
  for (const match of xml.matchAll(/<category\b([^>]*)>([\s\S]*?)<\/category>/giu)) {
    const attributes = parseAttributes(match[1]);
    if (attributes.id) categories.set(attributes.id, decodeXmlText(match[2]));
  }

  const offers = [];
  for (const match of xml.matchAll(/<offer\b([^>]*)>([\s\S]*?)<\/offer>/giu)) {
    const attributes = parseAttributes(match[1]);
    const body = match[2];
    const parameters = new Map();
    for (const parameter of body.matchAll(/<param\b([^>]*)>([\s\S]*?)<\/param>/giu)) {
      const parameterAttributes = parseAttributes(parameter[1]);
      if (parameterAttributes.name) parameters.set(parameterAttributes.name, decodeXmlText(parameter[2]));
    }
    offers.push({
      id:attributes.id ?? "",
      available:attributes.available === "true",
      url:readTag(body, "url"),
      price:readNumberTag(body, "price"),
      oldPrice:readNumberTag(body, "oldprice"),
      currencyId:readTag(body, "currencyId"),
      categoryId:readTag(body, "categoryId"),
      picture:readTag(body, "picture"),
      name:readTag(body, "name"),
      vendor:readTag(body, "vendor"),
      vendorCode:readTag(body, "vendorCode"),
      groupId:parameters.get("Внутренний ID группы") ?? "",
      variantId:parameters.get("ID варианта") ?? attributes.id?.replace(/^k2-/u, "") ?? "",
    });
  }
  return {
    metadata:{ generatedAt:catalogAttributes.date ?? "", name:readTag(shop, "name"), company:readTag(shop, "company"), url:readTag(shop, "url") },
    categories,
    offers,
  };
}

export function auditYandexFeed({ xml, snapshot, blockedProductIds = new Set(), origin = DEFAULT_ORIGIN }) {
  const parsed = parseYandexFeed(xml);
  const publishedCategories = new Map(snapshot.categories.filter((category) => category.published).map((category) => [category.slug, category]));
  const publicProducts = snapshot.products.filter((product) => !product.draft && publishedCategories.has(product.category));
  const productsById = new Map(publicProducts.map((product) => [product.id, product]));
  const variantOwners = new Map();
  for (const product of publicProducts) {
    for (const variant of product.variants) variantOwners.set(variant.id, [...(variantOwners.get(variant.id) ?? []), { product, variant }]);
  }

  const result = {
    generatedAt:new Date().toISOString(),
    feed:{ ...parsed.metadata, offerCount:parsed.offers.length, categoryCount:parsed.categories.size },
    catalog:{ productCount:publicProducts.length, variantCount:publicProducts.reduce((sum, product) => sum + product.variants.length, 0), blockedProductCount:blockedProductIds.size },
    coverage:{ advertisableVariantCount:0, offeredAdvertisableVariantCount:0, missingAdvertisableVariantCount:0 },
    mismatches:{
      duplicateOfferIds:[], unknownOffers:[], blockedOffers:[], invalidUrls:[], nonCanonicalUrls:[], price:[], availability:[], currency:[], category:[], picture:[], name:[], vendor:[], vendorCode:[], missingAdvertisableVariants:[],
    },
  };
  const seenOfferIds = new Set();
  const offeredVariantKeys = new Set();

  for (const offer of parsed.offers) {
    if (!offer.id || seenOfferIds.has(offer.id)) pushSample(result.mismatches.duplicateOfferIds, offer.id || "(empty)");
    seenOfferIds.add(offer.id);

    const owner = resolveCatalogOwner(offer, productsById, variantOwners, blockedProductIds);
    if (!owner) {
      pushSample(result.mismatches.unknownOffers, summarizeOffer(offer));
      continue;
    }
    const { product, variant } = owner;
    const variantKey = `${product.id}:${variant.id}`;
    offeredVariantKeys.add(variantKey);
    if (blockedProductIds.has(product.id)) pushSample(result.mismatches.blockedOffers, summarizeOffer(offer, product, variant));

    const expectedUrl = new URL(publicProductPath(product, product.variants.length > 1 ? variant : undefined), origin).href;
    const actualUrl = safeUrl(offer.url);
    if (!actualUrl || actualUrl.origin !== new URL(origin).origin) {
      pushSample(result.mismatches.invalidUrls, { ...summarizeOffer(offer, product, variant), actual:offer.url, expected:expectedUrl });
    } else if (actualUrl.href !== expectedUrl) {
      pushSample(result.mismatches.nonCanonicalUrls, { ...summarizeOffer(offer, product, variant), actual:actualUrl.href, expected:expectedUrl });
    }

    compareNumber(result.mismatches.price, offer, product, variant, offer.price, variant.price);
    if (offer.available !== Boolean(variant.available)) pushSample(result.mismatches.availability, { ...summarizeOffer(offer, product, variant), actual:offer.available, expected:Boolean(variant.available) });
    if (offer.currencyId !== "RUR") pushSample(result.mismatches.currency, { ...summarizeOffer(offer, product, variant), actual:offer.currencyId, expected:"RUR" });

    const expectedCategory = publishedCategories.get(product.category)?.title ?? "";
    const actualCategory = parsed.categories.get(offer.categoryId) ?? "";
    compareText(result.mismatches.category, offer, product, variant, actualCategory, expectedCategory);
    compareText(result.mismatches.picture, offer, product, variant, offer.picture, resolveYandexAdvertisingPictureUrl(firstImage(product, variant), origin), false);
    compareText(result.mismatches.name, offer, product, variant, offer.name, variant.name || product.title);
    compareText(result.mismatches.vendor, offer, product, variant, offer.vendor, product.brand);
    compareText(result.mismatches.vendorCode, offer, product, variant, offer.vendorCode, variant.sku || (product.variants.length === 1 ? product.sku : ""));
  }

  const advertisableVariants = [];
  for (const product of publicProducts) {
    if (blockedProductIds.has(product.id)) continue;
    for (const variant of product.variants) {
      // The production dynamic feed intentionally advertises only orderable offers.
      // Keep request-price and unavailable variants on the storefront, not in paid ads.
      if (!(Number.isFinite(variant.price) && variant.price > 0 && variant.available && firstImage(product, variant))) continue;
      advertisableVariants.push({ product, variant });
      if (!offeredVariantKeys.has(`${product.id}:${variant.id}`)) pushSample(result.mismatches.missingAdvertisableVariants, summarizeOffer({}, product, variant));
    }
  }
  result.coverage.advertisableVariantCount = advertisableVariants.length;
  result.coverage.offeredAdvertisableVariantCount = advertisableVariants.filter(({ product, variant }) => offeredVariantKeys.has(`${product.id}:${variant.id}`)).length;
  result.coverage.missingAdvertisableVariantCount = result.coverage.advertisableVariantCount - result.coverage.offeredAdvertisableVariantCount;

  result.counts = Object.fromEntries(Object.entries(result.mismatches).map(([key, values]) => [key, values.total ?? values.length]));
  result.criticalMismatchCount = ["duplicateOfferIds", "unknownOffers", "blockedOffers", "invalidUrls", "price", "availability", "currency", "category"]
    .reduce((sum, key) => sum + result.counts[key], 0);
  result.warningMismatchCount = ["nonCanonicalUrls", "picture", "name", "vendor", "vendorCode", "missingAdvertisableVariants"]
    .reduce((sum, key) => sum + result.counts[key], 0);
  result.status = result.criticalMismatchCount > 0 ? "FAIL" : result.warningMismatchCount > 0 ? "PASS_WITH_WARNINGS" : "PASS";
  return result;
}

function resolveCatalogOwner(offer, productsById, variantOwners, blockedProductIds) {
  const exactProduct = productsById.get(offer.groupId);
  const exactVariant = exactProduct?.variants.find((variant) => variant.id === offer.variantId);
  if (exactProduct && exactVariant) return { product:exactProduct, variant:exactVariant };
  const owners = variantOwners.get(offer.variantId) ?? [];
  if (owners.length === 1) return owners[0];
  const safeOwners = owners.filter(({ product }) => !blockedProductIds.has(product.id));
  return safeOwners.length === 1 ? safeOwners[0] : undefined;
}

function firstImage(product, variant) {
  return variant.images?.find(Boolean) ?? product.images?.find(Boolean) ?? product.variants.find((entry) => entry.images?.some(Boolean))?.images?.find(Boolean) ?? "";
}

function compareNumber(target, offer, product, variant, actual, expected) {
  if (Number(actual) === Number(expected)) return;
  pushSample(target, { ...summarizeOffer(offer, product, variant), actual, expected:expected ?? null });
}

function compareText(target, offer, product, variant, actual, expected, normalize = true) {
  const actualValue = normalize ? normalizeText(actual) : String(actual ?? "").trim();
  const expectedValue = normalize ? normalizeText(expected) : String(expected ?? "").trim();
  if (actualValue === expectedValue) return;
  pushSample(target, { ...summarizeOffer(offer, product, variant), actual:actual ?? "", expected:expected ?? "" });
}

function summarizeOffer(offer, product, variant) {
  return {
    offerId:offer.id ?? `k2-${variant?.id ?? "unknown"}`,
    groupId:product?.id ?? offer.groupId ?? "",
    variantId:variant?.id ?? offer.variantId ?? "",
  };
}

function pushSample(target, value) {
  target.total = (target.total ?? 0) + 1;
  if (target.length < SAMPLE_LIMIT) target.push(value);
}

function parseAttributes(source) {
  return Object.fromEntries([...source.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/gu)].map((match) => [match[1], decodeXmlText(match[3])]));
}

function readTag(source, tag, decode = true) {
  const match = source.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "iu"));
  if (!match) return "";
  return decode ? decodeXmlText(match[1]) : match[1];
}

function readNumberTag(source, tag) {
  const value = readTag(source, tag);
  if (!value) return undefined;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function decodeXmlText(value) {
  return String(value ?? "")
    .replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/u, "$1")
    .replace(/&#x([0-9a-f]+);/giu, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/gu, (_match, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&(amp|lt|gt|quot|apos);/gu, (_match, entity) => ({ amp:"&", lt:"<", gt:">", quot:'"', apos:"'" })[entity])
    .trim();
}

function normalizeText(value) {
  return String(value ?? "").normalize("NFKC").toLocaleLowerCase("ru-RU").replace(/ё/gu, "е").replace(/\s+/gu, " ").trim();
}

function safeUrl(value) {
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

async function readFeedSource(input) {
  if (/^https?:\/\//iu.test(input)) {
    const response = await fetch(input, { headers:{ Accept:"application/xml,text/xml;q=0.9,*/*;q=0.1", "User-Agent":"7tool-feed-audit/1.0" }, signal:AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`Feed returned HTTP ${response.status}.`);
    return response.text();
  }
  return readFile(path.resolve(input), "utf8");
}

async function main() {
  const input = process.argv[2] ?? DEFAULT_FEED_URL;
  const xml = await readFeedSource(input);
  const report = auditYandexFeed({ xml, snapshot:getPublishedFeedCatalogSnapshot(), blockedProductIds:getCatalogBlockingProductIds() });
  console.log(JSON.stringify(report, (_key, value) => value instanceof Set ? [...value] : value, 2));
  if (report.status === "FAIL") process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
