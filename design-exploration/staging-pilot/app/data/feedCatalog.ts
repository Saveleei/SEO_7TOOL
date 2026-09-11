import feedSnapshotJson from "../../../../7tool-source/src/lib/products.json";

export type FeedParameter = {
  name: string;
  value: string;
  unit?: string;
};

export type FeedVariant = {
  id: string;
  sku: string;
  name?: string;
  price?: number;
  quantity?: number;
  available: boolean;
  params: FeedParameter[];
  images?: string[];
};

export type FeedProduct = {
  id: string;
  slug: string;
  title: string;
  brand: string;
  sku: string;
  category: string;
  images: string[];
  variants: FeedVariant[];
  stock: number;
  paramAxes: string[];
  priceFrom?: number;
  priceTo?: number;
  manualSortOrder?: number;
};

export type FeedCategory = {
  slug: string;
  title: string;
  count: number;
  h1?: string;
  intro?: string;
  published: boolean;
};

type FeedSnapshot = {
  categories: FeedCategory[];
  products: FeedProduct[];
};

const feedSnapshot = feedSnapshotJson as unknown as FeedSnapshot;

const categoriesBySlug = new Map(
  feedSnapshot.categories
    .filter((category) => category.published)
    .map((category) => [category.slug, category]),
);

const productsByCategory = new Map<string, FeedProduct[]>();
const productsBySlug = new Map<string, FeedProduct>();

for (const product of feedSnapshot.products) {
  if (!categoriesBySlug.has(product.category)) continue;
  productsBySlug.set(product.slug, product);
  const categoryProducts = productsByCategory.get(product.category) ?? [];
  categoryProducts.push(product);
  productsByCategory.set(product.category, categoryProducts);
}

export function getFeedCategory(slug: string): FeedCategory | undefined {
  return categoriesBySlug.get(slug);
}

export function getPublishedFeedCategorySlugs(): string[] {
  return Array.from(categoriesBySlug.keys());
}

export function getFeedCategoryProducts(slug: string, limit = 6): FeedProduct[] {
  const products = productsByCategory.get(slug) ?? [];
  return products.filter((product) => Boolean(getFeedProductImage(product))).slice(0, limit);
}

export function getFeedCategoryProductCount(slug: string): number {
  return productsByCategory.get(slug)?.length ?? 0;
}

export function getFeedProductBySlug(slug: string): FeedProduct | undefined {
  return productsBySlug.get(slug);
}

export function getFeedProductImage(product: FeedProduct): string | undefined {
  return product.images.find(Boolean) ?? product.variants.find((variant) => variant.images?.some(Boolean))?.images?.find(Boolean);
}

export function formatFeedPrice(value?: number): string | undefined {
  if (!value || value <= 0) return undefined;
  return `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;
}

export function getFeedProductPriceLabel(product: FeedProduct): string {
  const from = formatFeedPrice(product.priceFrom);
  const to = formatFeedPrice(product.priceTo);
  if (!from) return "Цена по запросу";
  if (to && to !== from) return `${from}–${to}`;
  return from;
}
