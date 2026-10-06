import { createHash } from "node:crypto";
import { publicProductPath } from "./publicUrls.ts";
import type { FeedCategory, FeedProduct, FeedSnapshot, FeedVariant } from "./feedCatalog.ts";

const DEFAULT_ORIGIN = "https://7tool.ru";
const SHOP_NAME = "7TOOL";
const SHOP_COMPANY = "ООО «К2 ТУЛ»";
const MAX_DESCRIPTION_LENGTH = 2_900;
const MAX_PARAMETERS = 16;

export type YandexAdvertisingFeedSummary = {
  categoryCount: number;
  productCount: number;
  variantCount: number;
  advertisableVariantCount: number;
  excludedBlockedProductCount: number;
  excludedMissingPriceCount: number;
  excludedUnavailableCount: number;
  excludedMissingImageCount: number;
};

export type YandexAdvertisingFeedBuild = {
  xml: string;
  etag: string;
  generatedAt: string;
  summary: YandexAdvertisingFeedSummary;
};

export function buildYandexAdvertisingFeed({
  snapshot,
  blockedProductIds = new Set<string>(),
  origin = DEFAULT_ORIGIN,
  generatedAt = new Date(),
}: {
  snapshot: FeedSnapshot;
  blockedProductIds?: Set<string>;
  origin?: string;
  generatedAt?: Date | string;
}): YandexAdvertisingFeedBuild {
  const normalizedOrigin = normalizeOrigin(origin);
  const publishedCategories = snapshot.categories.filter((category) => category.published);
  const categoriesBySlug = new Map(publishedCategories.map((category) => [category.slug, category]));
  const categoryIds = buildCategoryIds(publishedCategories);
  const products = snapshot.products.filter((product) => !product.draft && categoriesBySlug.has(product.category));
  const seenOfferIds = new Set<string>();
  const offers: string[] = [];

  for (const product of products) {
    if (blockedProductIds.has(product.id)) continue;
    const category = categoriesBySlug.get(product.category)!;
    const categoryId = categoryIds.get(product.category)!;
    for (const variant of product.variants) {
      const picture = resolveYandexAdvertisingPictureUrl(firstImage(product, variant), normalizedOrigin);
      if (!isAdvertisableVariant(variant, picture)) continue;
      const offerId = `k2-${variant.id}`;
      if (!variant.id || seenOfferIds.has(offerId)) throw new Error(`Duplicate or empty Yandex offer id: ${offerId}`);
      seenOfferIds.add(offerId);
      offers.push(buildOffer({ product, variant, category, categoryId, offerId, picture, origin:normalizedOrigin }));
    }
  }

  const date = formatYandexCatalogDate(generatedAt);
  const categories = publishedCategories
    .map((category) => `      <category id="${categoryIds.get(category.slug)}">${xmlText(category.title)}</category>`)
    .join("\n");
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<yml_catalog date="${date}">`,
    "  <shop>",
    `    <name>${xmlText(SHOP_NAME)}</name>`,
    `    <company>${xmlText(SHOP_COMPANY)}</company>`,
    `    <url>${xmlText(normalizedOrigin)}</url>`,
    "    <currencies>",
    '      <currency id="RUR" rate="1"/>',
    "    </currencies>",
    "    <categories>",
    categories,
    "    </categories>",
    "    <offers>",
    offers.join("\n"),
    "    </offers>",
    "  </shop>",
    "</yml_catalog>",
    "",
  ].join("\n");

  const etag = `\"${createHash("sha256").update(xml).digest("hex")}\"`;
  return { xml, etag, generatedAt:date, summary:summarizeYandexAdvertisingCatalog(snapshot, blockedProductIds, normalizedOrigin) };
}

export function summarizeYandexAdvertisingCatalog(snapshot: FeedSnapshot, blockedProductIds = new Set<string>(), origin = DEFAULT_ORIGIN): YandexAdvertisingFeedSummary {
  const publishedCategories = new Set(snapshot.categories.filter((category) => category.published).map((category) => category.slug));
  const products = snapshot.products.filter((product) => !product.draft && publishedCategories.has(product.category));
  const summary: YandexAdvertisingFeedSummary = {
    categoryCount:publishedCategories.size,
    productCount:products.length,
    variantCount:0,
    advertisableVariantCount:0,
    excludedBlockedProductCount:blockedProductIds.size,
    excludedMissingPriceCount:0,
    excludedUnavailableCount:0,
    excludedMissingImageCount:0,
  };
  for (const product of products) {
    for (const variant of product.variants) {
      summary.variantCount += 1;
      if (blockedProductIds.has(product.id)) continue;
      const picture = resolveYandexAdvertisingPictureUrl(firstImage(product, variant), origin);
      if (!(Number.isFinite(variant.price) && Number(variant.price) > 0)) summary.excludedMissingPriceCount += 1;
      else if (!variant.available) summary.excludedUnavailableCount += 1;
      else if (!picture) summary.excludedMissingImageCount += 1;
      else summary.advertisableVariantCount += 1;
    }
  }
  return summary;
}

export function resolveYandexAdvertisingPictureUrl(value: string, origin = DEFAULT_ORIGIN): string {
  const source = String(value || "").trim();
  if (!source) return "";
  try {
    const url = new URL(source, normalizeOrigin(origin));
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function buildOffer({
  product,
  variant,
  category,
  categoryId,
  offerId,
  picture,
  origin,
}: {
  product: FeedProduct;
  variant: FeedVariant;
  category: FeedCategory;
  categoryId: string;
  offerId: string;
  picture: string;
  origin: string;
}): string {
  const title = variant.name?.trim() || product.title.trim();
  const vendorCode = variant.sku?.trim() || (product.variants.length === 1 ? product.sku.trim() : "");
  const description = cleanText(product.description || `${title}. ${category.title}. Цена с НДС, актуальное наличие и доставка по России.`).slice(0, MAX_DESCRIPTION_LENGTH);
  const oldPrice = Number(variant.oldPrice);
  const lines = [
    `      <offer id="${xmlAttribute(offerId)}" available="true">`,
    `        <url>${xmlText(new URL(publicProductPath(product, product.variants.length > 1 ? variant : undefined), origin).href)}</url>`,
    `        <price>${formatPrice(variant.price!)}</price>`,
  ];
  if (Number.isFinite(oldPrice) && oldPrice > Number(variant.price)) lines.push(`        <oldprice>${formatPrice(oldPrice)}</oldprice>`);
  lines.push(
    "        <currencyId>RUR</currencyId>",
    `        <categoryId>${categoryId}</categoryId>`,
    `        <picture>${xmlText(picture)}</picture>`,
    `        <name>${xmlText(title)}</name>`,
    `        <typePrefix>${xmlText(category.title)}</typePrefix>`,
  );
  if (product.brand.trim()) lines.push(`        <vendor>${xmlText(product.brand)}</vendor>`);
  if (vendorCode) lines.push(`        <vendorCode>${xmlText(vendorCode)}</vendorCode>`);
  if (validBarcode(variant.barcode)) lines.push(`        <barcode>${xmlText(variant.barcode!)}</barcode>`);
  lines.push(`        <description>${xmlText(description)}</description>`);
  if (Number.isFinite(variant.quantity) && Number(variant.quantity) >= 0) lines.push(`        <count>${Math.floor(Number(variant.quantity))}</count>`);
  lines.push(
    `        <param name="Внутренний ID группы">${xmlText(product.id)}</param>`,
    `        <param name="ID варианта">${xmlText(variant.id)}</param>`,
  );
  for (const parameter of uniqueParameters(variant).slice(0, MAX_PARAMETERS)) {
    const unit = parameter.unit ? ` unit="${xmlAttribute(parameter.unit)}"` : "";
    lines.push(`        <param name="${xmlAttribute(parameter.name)}"${unit}>${xmlText(parameter.value)}</param>`);
  }
  lines.push("      </offer>");
  return lines.join("\n");
}

function buildCategoryIds(categories: FeedCategory[]): Map<string, string> {
  const result = new Map<string, string>();
  const used = new Set<number>();
  for (const category of [...categories].sort((first, second) => first.slug.localeCompare(second.slug, "en"))) {
    let value = 100_000_000 + (stableHash(category.slug) % 800_000_000);
    while (used.has(value)) value = value === 899_999_999 ? 100_000_000 : value + 1;
    used.add(value);
    result.set(category.slug, String(value));
  }
  return result;
}

function stableHash(value: string): number {
  let hash = 2_166_136_261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function firstImage(product: FeedProduct, variant: FeedVariant): string {
  return variant.images?.find(Boolean)
    ?? product.images?.find(Boolean)
    ?? product.variants.find((entry) => entry.images?.some(Boolean))?.images?.find(Boolean)
    ?? "";
}

function isAdvertisableVariant(variant: FeedVariant, picture: string): boolean {
  return Boolean(Number.isFinite(variant.price) && Number(variant.price) > 0 && variant.available && picture);
}

function uniqueParameters(variant: FeedVariant): FeedVariant["params"] {
  const seen = new Set<string>();
  return (variant.params ?? []).filter((parameter) => {
    const name = cleanText(parameter.name);
    const value = cleanText(parameter.value);
    const key = `${name.toLocaleLowerCase("ru-RU")}\u0000${value.toLocaleLowerCase("ru-RU")}`;
    if (!name || !value || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeOrigin(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("Yandex feed origin must use HTTPS.");
  return url.origin;
}

function formatYandexCatalogDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("Yandex feed generation date is invalid.");
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone:"Europe/Moscow",
    year:"numeric",
    month:"2-digit",
    day:"2-digit",
    hour:"2-digit",
    minute:"2-digit",
    hourCycle:"h23",
  }).formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

function formatPrice(value: number): string {
  return Number(value).toFixed(2).replace(/\.00$/u, "").replace(/(\.\d)0$/u, "$1");
}

function validBarcode(value?: string): boolean {
  return /^\d{8,14}$/u.test(String(value || "").trim());
}

function cleanText(value: string): string {
  return String(value || "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, " ").replace(/\s+/gu, " ").trim();
}

function xmlText(value: string): string {
  return cleanText(value).replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;");
}

function xmlAttribute(value: string): string {
  return xmlText(value).replace(/"/gu, "&quot;").replace(/'/gu, "&apos;");
}
