import { getFeedCategory, getFeedProductImage, getFeedProductRouteBySlug, getPublishedFeedCatalogSnapshot } from "./feedCatalog.ts";
import { getLegacyRetainedProduct } from "./legacyRetainedProducts.ts";
import { getLegacySubcategory } from "./legacySubcategories.ts";
import { getProductionSubcategory } from "./productionCategoryGroups.ts";

export const SOCIAL_CARD_WIDTH = 1200;
export const SOCIAL_CARD_HEIGHT = 630;
export const SOCIAL_CARD_CONTENT_TYPE = "image/png";
export const SOCIAL_CARD_DESIGN_VERSION = "20261006.3";

export type SocialCardKind = "category" | "subcategory" | "product";

export type SocialCardContent = {
  kind: SocialCardKind;
  eyebrow: string;
  title: string;
  context: string;
  image?: string;
  imageAlt: string;
};

export type SocialCardRouteResolution = {
  content: SocialCardContent;
  kind: SocialCardKind;
  slugs: string[];
  revision: string;
  requestedRevision?: string;
  isCurrentVersion: boolean;
};

const SAFE_SLUG = /^[a-z0-9][a-z0-9-]{0,179}$/u;
const SAFE_REVISION = /^[a-z0-9]{5,16}$/u;

export function socialCardMetadataImage(kind: SocialCardKind, imageAlt: string, ...slugs: string[]) {
  const content = resolveSocialCardContent([kind, ...slugs]);
  const revision = socialCardRevision(kind, slugs, content);
  return {
    url:versionedSocialCardPath(kind, slugs, revision),
    width:SOCIAL_CARD_WIDTH,
    height:SOCIAL_CARD_HEIGHT,
    type:SOCIAL_CARD_CONTENT_TYPE,
    alt:imageAlt,
  };
}

export function resolveSocialCardContent(rawSegments: string[]): SocialCardContent | null {
  return resolveSocialCardRoute(rawSegments)?.content ?? null;
}

export function resolveSocialCardRoute(rawSegments: string[]): SocialCardRouteResolution | null {
  const parsed = normalizeSegments(rawSegments);
  if (!parsed) return null;
  const [kind, ...slugs] = parsed.segments as [SocialCardKind, ...string[]];
  const content = resolveNormalizedSocialCardContent(kind, slugs);
  if (!content) return null;
  const revision = socialCardRevision(kind, slugs, content);
  return {
    content,
    kind,
    slugs,
    revision,
    requestedRevision:parsed.requestedRevision,
    isCurrentVersion:parsed.requestedRevision === revision,
  };
}

export function versionedSocialCardPath(kind: SocialCardKind, slugs: string[], revision: string): string {
  return `/social-card/v-${revision}/${kind}/${slugs.map((slug) => encodeURIComponent(slug)).join("/")}.png`;
}

function resolveNormalizedSocialCardContent(kind: SocialCardKind, slugs: string[]): SocialCardContent | null {
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

function normalizeSegments(rawSegments: string[]): { segments: string[]; requestedRevision?: string } | null {
  if (!Array.isArray(rawSegments) || rawSegments.length < 2 || rawSegments.length > 4) return null;
  const decodedSegments = rawSegments.map((segment, index) => {
    const decoded = safeDecode(segment);
    return index === rawSegments.length - 1 ? decoded.replace(/\.png$/u, "") : decoded;
  });
  const versionMatch = decodedSegments[0]?.match(/^v-([a-z0-9]+)$/u);
  const requestedRevision = versionMatch?.[1];
  if (requestedRevision && !SAFE_REVISION.test(requestedRevision)) return null;
  const segments = requestedRevision ? decodedSegments.slice(1) : decodedSegments;
  if (!["category", "subcategory", "product"].includes(segments[0])) return null;
  if (!segments.slice(1).every((segment) => SAFE_SLUG.test(segment))) return null;
  return { segments, requestedRevision };
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(String(value || "")).trim().toLocaleLowerCase("ru-RU");
  } catch {
    return "";
  }
}

function stableRevision(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function socialCardRevision(kind: SocialCardKind, slugs: string[], content: SocialCardContent | null): string {
  return stableRevision([
    SOCIAL_CARD_DESIGN_VERSION,
    kind,
    ...slugs,
    content?.title ?? "",
    content?.context ?? "",
    content?.image ?? "",
    content?.imageAlt ?? "",
  ].join("|"));
}
