import { getFeedCategory, getFeedProductImage, getFeedProductRouteBySlug, getPublishedFeedCatalogSnapshot } from "./feedCatalog.ts";
import { getLegacyRetainedProduct } from "./legacyRetainedProducts.ts";
import { getLegacySubcategory } from "./legacySubcategories.ts";
import { getProductionSubcategory } from "./productionCategoryGroups.ts";

export const SOCIAL_CARD_WIDTH = 1200;
export const SOCIAL_CARD_HEIGHT = 630;
export const SOCIAL_CARD_CONTENT_TYPE = "image/png";

export type SocialCardKind = "category" | "subcategory" | "product";

export type SocialCardContent = {
  kind: SocialCardKind;
  eyebrow: string;
  title: string;
  context: string;
  image?: string;
  imageAlt: string;
};

const SAFE_SLUG = /^[a-z0-9][a-z0-9-]{0,179}$/u;

export function socialCardMetadataImage(kind: SocialCardKind, imageAlt: string, ...slugs: string[]) {
  return {
    url:`/social-card/${kind}/${slugs.map((slug) => encodeURIComponent(slug)).join("/")}.png`,
    width:SOCIAL_CARD_WIDTH,
    height:SOCIAL_CARD_HEIGHT,
    type:SOCIAL_CARD_CONTENT_TYPE,
    alt:imageAlt,
  };
}

export function resolveSocialCardContent(rawSegments: string[]): SocialCardContent | null {
  const segments = normalizeSegments(rawSegments);
  if (!segments) return null;
  const [kind, ...slugs] = segments;
  if (kind === "category" && slugs.length === 1) return categoryCard(slugs[0]);
  if (kind === "subcategory" && slugs.length === 2) return subcategoryCard(slugs[0], slugs[1]);
  if (kind === "product" && slugs.length === 1) return productCard(slugs[0]);
  return null;
}

function categoryCard(slug: string): SocialCardContent | null {
  const entry = getProductionSubcategory(slug);
  const category = getFeedCategory(slug);
  if (!entry || !category) return null;
  const title = category.h1 ?? entry.subcategory.label;
  return {
    kind:"category",
    eyebrow:"Категория оборудования",
    title,
    context:`${entry.group.title} · подбор по задаче`,
    image:entry.subcategory.image ?? entry.group.representativeImage ?? entry.group.image,
    imageAlt:`${title} в каталоге 7TOOL`,
  };
}

function subcategoryCard(categorySlug: string, subcategorySlug: string): SocialCardContent | null {
  const landing = getLegacySubcategory(categorySlug, subcategorySlug);
  if (!landing) return null;
  const parent = getProductionSubcategory(categorySlug);
  const image = landing.image
    ?? firstProductImage(landing.productIds)
    ?? parent?.subcategory.image
    ?? parent?.group.representativeImage
    ?? parent?.group.image;
  return {
    kind:"subcategory",
    eyebrow:"Подкатегория",
    title:landing.h1 ?? landing.title,
    context:`${landing.categoryTitle} · ${landing.count.toLocaleString("ru-RU")} товарных серий`,
    image,
    imageAlt:landing.imageAlt ?? `${landing.title} в каталоге 7TOOL`,
  };
}

function productCard(slug: string): SocialCardContent | null {
  const route = getFeedProductRouteBySlug(slug);
  if (route) {
    const { product, variant } = route;
    const parent = getProductionSubcategory(product.category);
    return {
      kind:"product",
      eyebrow:"Товар 7TOOL",
      title:product.title,
      context:[product.brand, variant?.sku ? `Артикул ${variant.sku}` : product.sku ? `Артикул ${product.sku}` : ""].filter(Boolean).join(" · "),
      image:variant?.images?.[0] ?? getFeedProductImage(product) ?? parent?.subcategory.image ?? parent?.group.image,
      imageAlt:`${product.title} — фото товара`,
    };
  }
  const retained = getLegacyRetainedProduct(slug);
  if (!retained) return null;
  return {
    kind:"product",
    eyebrow:"Товар 7TOOL",
    title:retained.title,
    context:"Проверка поставки или подбор замены",
    image:retained.image,
    imageAlt:`${retained.title} — фото товара`,
  };
}

function firstProductImage(productIds: string[]): string | undefined {
  const products = new Map(getPublishedFeedCatalogSnapshot().products.map((product) => [product.id, product]));
  for (const id of productIds) {
    const product = products.get(id);
    const image = product ? getFeedProductImage(product) : undefined;
    if (image) return image;
  }
  return undefined;
}

function normalizeSegments(rawSegments: string[]): string[] | null {
  if (!Array.isArray(rawSegments) || rawSegments.length < 2 || rawSegments.length > 3) return null;
  const segments = rawSegments.map((segment, index) => {
    const decoded = safeDecode(segment);
    return index === rawSegments.length - 1 ? decoded.replace(/\.png$/u, "") : decoded;
  });
  if (!["category", "subcategory", "product"].includes(segments[0])) return null;
  if (!segments.slice(1).every((segment) => SAFE_SLUG.test(segment))) return null;
  return segments;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(String(value || "")).trim().toLocaleLowerCase("ru-RU");
  } catch {
    return "";
  }
}
