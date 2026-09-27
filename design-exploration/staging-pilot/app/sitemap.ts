import type { MetadataRoute } from "next";
import { getPublishedFeedCatalogSnapshot } from "./data/feedCatalog.ts";
import { getProductionCategoryGroups, pilotFeedCategorySlugs } from "./data/productionCategoryGroups.ts";
import { canonicalUrl } from "./data/seo.ts";
import { isSeoIndexingEnabled } from "./data/seoIndexing.mjs";

const publicPages = ["/", "/catalog", "/company", "/contacts", "/ordering", "/payment", "/delivery", "/warranty"];

export default function sitemap(): MetadataRoute.Sitemap {
  if (!isSeoIndexingEnabled()) return [];
  const snapshot = getPublishedFeedCatalogSnapshot();
  const taskPaths = getProductionCategoryGroups(pilotFeedCategorySlugs).map((group) => `/catalog/task/${group.slug}`);
  const categoryPaths = snapshot.categories.filter((category) => category.published).map((category) => `/catalog/category/${category.slug}`);
  const productPaths = snapshot.products.map((product) => `/product/${product.slug}`);
  const paths = Array.from(new Set([...publicPages, ...taskPaths, ...categoryPaths, ...productPaths]));
  return paths.map((path) => ({
    url:canonicalUrl(path),
    changeFrequency:path === "/" ? "daily" : path.startsWith("/product/") ? "weekly" : "weekly",
    priority:path === "/" ? 1 : path === "/catalog" ? 0.9 : path.startsWith("/product/") ? 0.7 : 0.8,
  }));
}
