import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { publicBrandSlug, publicProductSlug } from "../app/data/publicUrls.ts";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = path.resolve(appRoot, "../../7tool-source/src/lib/products.json");
const subcategoriesPath = path.resolve(appRoot, "app/data/generatedLegacySubcategories.json");
const retainedProductsPath = path.resolve(appRoot, "app/data/generatedLegacyRetainedProducts.json");
const sitemapPath = process.argv[2] ?? path.resolve(appRoot, "app/data/generatedLegacyUrlSnapshot.json");

const [catalogSource, sitemapSource, subcategoriesSource, retainedProductsSource] = await Promise.all([
  readFile(catalogPath, "utf8"),
  readFile(path.resolve(sitemapPath), "utf8"),
  readFile(subcategoriesPath, "utf8"),
  readFile(retainedProductsPath, "utf8"),
]);
const snapshot = JSON.parse(catalogSource);
const subcategories = JSON.parse(subcategoriesSource).entries;
const retainedProducts = JSON.parse(retainedProductsSource).entries;
const publishedCategories = new Set(snapshot.categories.filter((category) => category.published).map((category) => category.slug));
const publicProducts = snapshot.products.filter((product) => !product.draft && publishedCategories.has(product.category));
const productRoutes = new Map();

function registerProductRoute(slug, route) {
  const current = productRoutes.get(slug);
  if (!current) {
    productRoutes.set(slug, route);
    return;
  }
  if (current.productId !== route.productId) {
    productRoutes.set(slug, { collision:true });
    return;
  }
  if (!current.variantId) return;
  if (!route.variantId) productRoutes.set(slug, route);
  else if (current.variantId !== route.variantId) productRoutes.set(slug, { collision:true });
}

for (const product of publicProducts) {
  registerProductRoute(product.slug, { productId:product.id, category:product.category });
  if (product.variants.length > 1) {
    for (const variant of product.variants) {
      registerProductRoute(publicProductSlug(product, variant), { productId:product.id, variantId:variant.id, category:product.category });
    }
  }
}
for (const product of retainedProducts) registerProductRoute(product.slug, { productId:`retained:${product.slug}`, retained:true });

const brands = new Set(publicProducts.filter(hasProductImage).map((product) => product.brand).filter((brand) => brand && brand !== "—").map(publicBrandSlug));
const subcategoryPaths = new Set(subcategories.map((subcategory) => `/c/${subcategory.categorySlug}/${subcategory.slug}`));
const sitemapSnapshot = sitemapSource.trimStart().startsWith("{") ? JSON.parse(sitemapSource) : undefined;
const sitemapUrls = sitemapSnapshot?.urls ?? [...sitemapSource.matchAll(/<loc>([^<]+)<\/loc>/gu)].map((match) => match[1].trim());
const locations = sitemapUrls.map((url) => new URL(url).pathname);
const classes = { static:[], categories:[], subcategories:[], brands:[], products:[], unknown:[] };
for (const pathname of locations) {
  if (pathname.startsWith("/p/")) classes.products.push(pathname);
  else if (pathname.startsWith("/brand/")) classes.brands.push(pathname);
  else if (pathname.startsWith("/c/")) (pathname.split("/").filter(Boolean).length === 2 ? classes.categories : classes.subcategories).push(pathname);
  else if (["/", "/kontakty", "/dostavka-i-oplata", "/garantiya-i-vozvrat", "/politika-konfidencialnosti", "/soglasie-na-obrabotku"].includes(pathname)) classes.static.push(pathname);
  else classes.unknown.push(pathname);
}

const missingProducts = classes.products.filter((pathname) => !productRoutes.has(pathname.slice(3)));
const collidedProducts = classes.products.filter((pathname) => productRoutes.get(pathname.slice(3))?.collision);
const missingCategories = classes.categories.filter((pathname) => !publishedCategories.has(pathname.slice(3)));
const missingBrands = classes.brands.filter((pathname) => !brands.has(pathname.slice(7)));
const missingSubcategories = classes.subcategories.filter((pathname) => !subcategoryPaths.has(pathname));
const report = {
  sitemapSha256:sitemapSnapshot?.sourceSha256 ?? createHash("sha256").update(sitemapSource).digest("hex"),
  catalogSha256:createHash("sha256").update(catalogSource).digest("hex"),
  total:locations.length,
  counts:Object.fromEntries(Object.entries(classes).map(([key, values]) => [key, values.length])),
  publicCatalog:{ categories:publishedCategories.size, subcategories:subcategories.length, products:publicProducts.length, retainedProducts:retainedProducts.length, productRoutes:productRoutes.size, brands:brands.size },
  gaps:{
    products:missingProducts,
    productCollisions:collidedProducts,
    categories:missingCategories,
    subcategories:missingSubcategories,
    brands:missingBrands,
    unknown:classes.unknown,
  },
};
console.log(JSON.stringify(report, null, 2));
if (missingProducts.length || collidedProducts.length || missingCategories.length || missingSubcategories.length || missingBrands.length || classes.unknown.length) process.exitCode = 1;

function hasProductImage(product) {
  return Boolean(product.images?.some(Boolean) || product.variants?.some((variant) => variant.images?.some(Boolean)));
}
