import type { MetadataRoute } from "next";
import { getFeedProductImage, getPublishedFeedCatalogSnapshot } from "./data/feedCatalog.ts";
import { getFeedBrandLandings } from "./data/brandCatalog.ts";
import { getLegacySubcategories } from "./data/legacySubcategories.ts";
import { getProductionCategoryGroups, pilotFeedCategorySlugs } from "./data/productionCategoryGroups.ts";
import { canonicalUrl } from "./data/seo.ts";
import { isSeoIndexingEnabled } from "./data/seoIndexing.mjs";
import { getCatalogBlockingProductIds } from "./data/catalogQuality.ts";
import { publicBrandPath, publicCategoryPath, publicProductPath } from "./data/publicUrls.ts";
import { getLegacyRetainedProducts } from "./data/legacyRetainedProducts.ts";

const publicPages = ["/", "/catalog", "/company", "/contacts", "/ordering", "/payment", "/delivery", "/warranty", "/dostavka-i-oplata", "/garantiya-i-vozvrat", "/politika-konfidencialnosti", "/soglasie-na-obrabotku"];

export default function sitemap(): MetadataRoute.Sitemap {
  if (!isSeoIndexingEnabled()) return [];
  const snapshot = getPublishedFeedCatalogSnapshot();
  const blockedProductIds = getCatalogBlockingProductIds();
  const taskPaths = getProductionCategoryGroups(pilotFeedCategorySlugs).map((group) => `/catalog/task/${group.slug}`);
  const categoryPaths = snapshot.categories.filter((category) => category.published).map((category) => publicCategoryPath(category.slug));
  const subcategoryPaths = getLegacySubcategories().map((subcategory) => `/c/${subcategory.categorySlug}/${subcategory.slug}`);
  const brandPaths = getFeedBrandLandings().map((brand) => publicBrandPath(brand.brand));
  const products = snapshot.products.filter((product) => !blockedProductIds.has(product.id));
  const productEntries = products.flatMap((product) => [
    { path:publicProductPath(product), images:[getFeedProductImage(product)].filter((image): image is string => Boolean(image)) },
    ...(product.variants.length > 1 ? product.variants.map((variant) => ({ path:publicProductPath(product, variant), images:[variant.images?.[0] ?? getFeedProductImage(product)].filter((image): image is string => Boolean(image)) })) : []),
  ]);
  const retainedProductEntries = getLegacyRetainedProducts().map((product) => ({ path:`/p/${product.slug}`, images:[product.image].filter(Boolean) }));
  const allProductEntries = [...productEntries, ...retainedProductEntries];
  const productImagesByPath = new Map(allProductEntries.map((entry) => [entry.path, entry.images]));
  const paths = Array.from(new Set([...publicPages, ...taskPaths, ...categoryPaths, ...subcategoryPaths, ...brandPaths, ...allProductEntries.map((entry) => entry.path)]));
  return paths.map((path) => ({
    url:canonicalUrl(path),
    changeFrequency:path === "/" ? "daily" : "weekly",
    priority:path === "/" ? 1 : path === "/catalog" ? 0.9 : path.startsWith("/p/") ? 0.7 : 0.8,
    ...(productImagesByPath.get(path)?.length ? { images:productImagesByPath.get(path) } : {}),
  }));
}
