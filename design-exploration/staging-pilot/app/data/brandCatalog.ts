import { getFeedProductImage, getPublishedFeedCatalogSnapshot, type FeedProduct } from "./feedCatalog.ts";
import { publicBrandSlug } from "./publicUrls.ts";

export type FeedBrandLanding = {
  brand: string;
  slug: string;
  products: FeedProduct[];
  categories: Array<{ slug: string; title: string; count: number }>;
};

function buildBrandLandings(): FeedBrandLanding[] {
  const snapshot = getPublishedFeedCatalogSnapshot();
  const categories = new Map(snapshot.categories.map((category) => [category.slug, category.title]));
  const grouped = new Map<string, { brands: Set<string>; products: FeedProduct[] }>();
  for (const product of snapshot.products) {
    const brand = product.brand.trim();
    if (!brand || brand === "—" || !getFeedProductImage(product)) continue;
    const slug = publicBrandSlug(brand);
    const group = grouped.get(slug) ?? { brands:new Set(), products:[] };
    group.brands.add(brand);
    group.products.push(product);
    grouped.set(slug, group);
  }
  return Array.from(grouped.entries()).flatMap(([slug, group]) => {
    if (group.brands.size !== 1) return [];
    const brand = Array.from(group.brands)[0];
    const categoryCounts = new Map<string, number>();
    for (const product of group.products) categoryCounts.set(product.category, (categoryCounts.get(product.category) ?? 0) + 1);
    return [{
      brand,
      slug,
      products:group.products,
      categories:Array.from(categoryCounts, ([categorySlug, count]) => ({ slug:categorySlug, title:categories.get(categorySlug) ?? categorySlug, count }))
        .sort((first, second) => second.count - first.count || first.title.localeCompare(second.title, "ru-RU")),
    }];
  }).sort((first, second) => first.brand.localeCompare(second.brand, "ru-RU"));
}

export function getFeedBrandLandings(): FeedBrandLanding[] {
  return buildBrandLandings();
}

export function getFeedBrandLanding(slug: string): FeedBrandLanding | undefined {
  return buildBrandLandings().find((landing) => landing.slug === slug);
}

export function getFeedBrandAliasTarget(slug: string): string | undefined {
  const normalized = decodeURIComponent(slug).toLocaleLowerCase("ru-RU");
  return buildBrandLandings().find((landing) => landing.brand.toLocaleLowerCase("ru-RU") === normalized)?.slug;
}
