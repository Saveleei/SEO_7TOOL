import productsJson from "./products.json";
import {
  compareCatalogProducts,
  cleanParamName,
  getProductAvailability,
  type Category,
  type CategoryIcon,
  type Product,
  type Variant,
} from "./catalog";

export type { Category, CategoryIcon, Product, ProductParam, Variant } from "./catalog";
export {
  compareCatalogProducts,
  cleanParamName,
  fmtPrice,
  getProductAvailability,
  priceLabel,
  variantSlug,
  variantTitle,
} from "./catalog";
import { variantSlug } from "./catalog";
export { company, manager } from "./site-config";

type Raw = {
  categories: { slug: string; title: string; icon: string; count: number }[];
  products: Omit<Product, "icon"> & { icon: string }[];
  subcategories?: Record<string, unknown>[];
};

const raw = productsJson as unknown as Raw;
export const subcategoryOverrides = raw.subcategories ?? [];

function availableCatalogImage(src?: string) {
  if (!src || !src.startsWith("/img/")) return src;
  if (src.includes("..")) return undefined;
  return src;
}

function hasCatalogImage(product: Product): boolean {
  return (product.images ?? []).some((src) => Boolean(availableCatalogImage(src)))
    || (product.variants ?? []).some((variant) => (variant.images ?? []).some((src) => Boolean(availableCatalogImage(src))));
}

// Пересчитаем count по живым продуктам (без draft), чтобы метрики на сайте
// отражали публикуемое.
const liveCountByCat: Record<string, number> = {};
for (const p of (raw.products as unknown as Product[])) {
  if (p.draft || !hasCatalogImage(p)) continue;
  liveCountByCat[p.category] = (liveCountByCat[p.category] || 0) + 1;
}
export const categories: Category[] = raw.categories
  .map((c) => {
    const ext = c as unknown as Record<string, unknown>;
    return {
      slug: c.slug,
      title: c.title,
      icon: c.icon as CategoryIcon,
      count: liveCountByCat[c.slug] ?? 0,
      subtitle: typeof ext.subtitle === "string" ? (ext.subtitle as string) : undefined,
      ctaText: typeof ext.ctaText === "string" ? (ext.ctaText as string) : undefined,
      coverImage: typeof ext.coverImage === "string" ? availableCatalogImage(ext.coverImage as string) : undefined,
      imageAlt: typeof ext.imageAlt === "string" ? (ext.imageAlt as string) : undefined,
      h1: typeof ext.h1 === "string" ? (ext.h1 as string) : undefined,
      intro: typeof ext.intro === "string" ? (ext.intro as string) : undefined,
      seoText: typeof ext.seoText === "string" ? (ext.seoText as string) : undefined,
      metaTitle: typeof ext.metaTitle === "string" ? (ext.metaTitle as string) : undefined,
      metaDescription: typeof ext.metaDescription === "string" ? (ext.metaDescription as string) : undefined,
      published: typeof ext.published === "boolean" ? (ext.published as boolean) : true,
      sortOrder: typeof ext.sortOrder === "number" ? (ext.sortOrder as number) : undefined,
    };
  })
  .filter((c) => c.count > 0 && c.published !== false)
  .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

// Из публикации исключаем draft=true. Серверная выдача сразу формируется в
// коммерческом порядке: наличие → валидная доступная цена → стабильное имя/id.
export const products: Product[] = (raw.products as unknown as Product[])
  .filter((p) => !p.draft && hasCatalogImage(p))
  .map((p) => {
    const variants = (p.variants ?? []).map((variant) => ({
      ...variant,
      params: (variant.params ?? []).map((param) => ({
        ...param,
        name: cleanParamName(param.name),
      })),
    }));
    const product = {
      ...p,
      icon: p.icon as CategoryIcon,
      images: (p.images ?? []).filter((src) => availableCatalogImage(src) != null),
      variants,
      paramAxes: Array.from(new Set((p.paramAxes ?? []).map(cleanParamName))),
    };
    const availability = getProductAvailability(product);
    return {
      ...product,
      stock: product.variants.reduce((sum, variant) => sum + Math.max(0, variant.quantity ?? 0), 0),
      priceFrom: availability.minPrice,
      priceTo: availability.maxPrice,
    };
  })
  .sort(compareCatalogProducts);

const productBySlugIdx = new Map(products.map((p) => [p.slug, p]));
const productByIdIdx = new Map(products.map((p) => [p.id, p]));
const categoryIdx = new Map(categories.map((c) => [c.slug, c]));

// Index variant id → { product, variant }
const variantByIdIdx = new Map<string, { product: Product; variant: Variant }>();
// Index variant slug → { product, variant }
const variantBySlugIdx = new Map<string, { product: Product; variant: Variant }>();
for (const p of products) {
  for (const v of p.variants) {
    variantByIdIdx.set(v.id, { product: p, variant: v });
    variantBySlugIdx.set(variantSlug(p, v), { product: p, variant: v });
  }
}

export const productBySlug = (slug: string) => productBySlugIdx.get(slug);
export const productById = (id: string) => productByIdIdx.get(id);
export const categoryBySlug = (slug: string) => categoryIdx.get(slug);
export const productsByCategory = (slug: string) => products.filter((p) => p.category === slug);
export const variantById = (id: string) => variantByIdIdx.get(id);

export type ResolvedSlug = {
  product: Product;
  variant?: Variant; // если slug ведёт на конкретный вариант
  isVariant: boolean;
};
export function resolveProductSlug(slug: string): ResolvedSlug | undefined {
  const direct = productBySlugIdx.get(slug);
  if (direct) return { product: direct, isVariant: false };
  const v = variantBySlugIdx.get(slug);
  if (v) return { product: v.product, variant: v.variant, isVariant: true };
  return undefined;
}

export function allProductSlugs(): string[] {
  const out = new Set<string>();
  for (const p of products) {
    out.add(p.slug);
    for (const v of p.variants) {
      out.add(variantSlug(p, v));
    }
  }
  return Array.from(out);
}

// Round-robin по категориям: берём топ-1 из каждой, потом топ-2 и т.д.,
// чтобы блок «Что есть в наличии» не превращался в монокультуру одной категории.
export const bestsellers: Product[] = (() => {
  const buckets = new Map<string, Product[]>();
  for (const p of products) {
    if (p.stock <= 0) continue;
    if (!p.images?.length) continue;
    const arr = buckets.get(p.category) ?? [];
    arr.push(p);
    buckets.set(p.category, arr);
  }
  // приоритет категорий: те, у которых больше живых товаров со склада идут раньше
  const order = Array.from(buckets.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .map(([slug]) => slug);
  const out: Product[] = [];
  let round = 0;
  while (out.length < 8) {
    let added = 0;
    for (const slug of order) {
      const arr = buckets.get(slug)!;
      if (round < arr.length) {
        out.push(arr[round]);
        added++;
        if (out.length >= 8) break;
      }
    }
    if (!added) break;
    round++;
  }
  // если не набрали 8 — добивам любыми со склада
  if (out.length < 8) {
    for (const p of products) {
      if (p.stock > 0 && !out.includes(p)) {
        out.push(p);
        if (out.length >= 8) break;
      }
    }
  }
  return out;
})();

// Товар-герой для hero-баннера: фиксированно — LENZ Steyr-35.
export const featuredDeal: Product | undefined = (() => {
  const pinned = products.find((p) => p.slug === "magnitnyy-sverlilnyy-stanok-lenz-steyr-35");
  if (pinned) return pinned;
  // fallback: лучшая скидка с фото и ценой
  const candidates = products
    .filter((p) => p.discountPct && p.priceFrom != null && p.images && p.images.length > 0)
    .sort((a, b) => (b.discountPct ?? 0) - (a.discountPct ?? 0));
  return candidates[0];
})();
