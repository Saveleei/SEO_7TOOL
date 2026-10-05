import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import sitemap from "../app/sitemap.ts";
import { getFeedBrandLandings } from "../app/data/brandCatalog.ts";
import { getFeedProductRouteBySlug } from "../app/data/feedCatalog.ts";
import { getCatalogBlockingProductIds } from "../app/data/catalogQuality.ts";
import { getLegacyRetainedProduct, getLegacyRetainedProducts } from "../app/data/legacyRetainedProducts.ts";
import { getLegacySubcategories } from "../app/data/legacySubcategories.ts";
import legacySnapshot from "../app/data/generatedLegacyUrlSnapshot.json" with { type:"json" };
import { proxy } from "../proxy.ts";

test("the frozen live sitemap is completely resolved by canonical routes or an explicit contact redirect", () => {
  assert.equal(legacySnapshot.urls.length, 18_544);
  const paths = legacySnapshot.urls.map((url) => new URL(url).pathname);
  const productPaths = paths.filter((pathname) => pathname.startsWith("/p/"));
  const subcategoryPaths = paths.filter((pathname) => pathname.startsWith("/c/") && pathname.split("/").filter(Boolean).length === 3);
  const brandPaths = paths.filter((pathname) => pathname.startsWith("/brand/"));
  assert.equal(productPaths.length, 18_307);
  assert.equal(subcategoryPaths.length, 121);
  assert.equal(brandPaths.length, 87);

  const missingProducts = productPaths.filter((pathname) => !getFeedProductRouteBySlug(pathname.slice(3)) && !getLegacyRetainedProduct(pathname.slice(3)));
  const subcategories = new Set(getLegacySubcategories().map((entry) => `/c/${entry.categorySlug}/${entry.slug}`));
  const brands = new Set(getFeedBrandLandings().map((entry) => `/brand/${entry.slug}`));
  assert.deepEqual(missingProducts, []);
  assert.deepEqual(subcategoryPaths.filter((pathname) => !subcategories.has(pathname)), []);
  assert.deepEqual(brandPaths.filter((pathname) => !brands.has(pathname)), []);
  assert.equal(getLegacyRetainedProducts().length, 51);
});

test("the historical collapsed HML5 slug deterministically resolves to the product group", () => {
  const route = getFeedProductRouteBySlug("ruchnye-magnitnye-zahvaty-hdlift-hml5");
  assert.equal(route?.product.slug, "ruchnye-magnitnye-zahvaty-hdlift-hml5");
  assert.equal(route?.variant, undefined);
});

test("canonical sitemap preserves legacy indexable paths and never publishes preview aliases", () => {
  const previous = process.env.SEO_INDEXING_ENABLED;
  process.env.SEO_INDEXING_ENABLED = "1";
  try {
    const paths = sitemap().map((entry) => new URL(entry.url).pathname);
    const pathSet = new Set(paths);
    const oldPaths = legacySnapshot.urls.map((url) => new URL(url).pathname);
    const omitted = oldPaths.filter((pathname) => pathname !== "/kontakty" && !pathSet.has(pathname));
    const blockedProductIds = getCatalogBlockingProductIds();
    const unconfirmedLegalPaths = new Set(["/politika-konfidencialnosti", "/soglasie-na-obrabotku"]);
    assert.equal(omitted.length, 7);
    assert.equal(omitted.every((pathname) => {
      if (unconfirmedLegalPaths.has(pathname)) return true;
      const route = pathname.startsWith("/p/") ? getFeedProductRouteBySlug(pathname.slice(3)) : undefined;
      return Boolean(route && blockedProductIds.has(route.product.id));
    }), true);
    assert.equal(pathSet.has("/contacts"), true);
    assert.equal(pathSet.has("/kontakty"), false);
    assert.equal(paths.some((pathname) => pathname.startsWith("/product/") || pathname.startsWith("/catalog/category/")), false);
    assert.equal(pathSet.size, paths.length);
  } finally {
    if (previous === undefined) delete process.env.SEO_INDEXING_ENABLED;
    else process.env.SEO_INDEXING_ENABLED = previous;
  }
});

test("preview-style category and product aliases redirect in one hop and keep the query", () => {
  const product = proxy({ nextUrl:{ hostname:"7tool.ru", pathname:"/product/example", search:"?variant=A1" } });
  const category = proxy({ nextUrl:{ hostname:"7tool.ru", pathname:"/catalog/category/borfrezy", search:"?page=2" } });
  assert.equal(product.status, 308);
  assert.equal(product.headers.get("location"), "https://7tool.ru/p/example?variant=A1");
  assert.equal(category.status, 308);
  assert.equal(category.headers.get("location"), "https://7tool.ru/c/borfrezy?page=2");
});

test("public app sources do not link through preview-style redirects", async () => {
  const appRoot = new URL("../app/", import.meta.url);
  const files = await sourceFiles(appRoot);
  const violations = [];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    const navigationSource = source.replace(/from\s+["'][^"']+["']/gu, "");
    if (/["'`]\/(?:product\/|catalog\/category\/)/u.test(navigationSource)) violations.push(file.pathname);
  }
  assert.deepEqual(violations, []);
});

async function sourceFiles(directoryUrl) {
  const directory = directoryUrl instanceof URL ? directoryUrl : new URL(`file:///${String(directoryUrl).replaceAll("\\", "/")}`);
  const entries = await readdir(directory, { withFileTypes:true });
  const files = [];
  for (const entry of entries) {
    const child = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
    if (entry.isDirectory()) files.push(...await sourceFiles(child));
    else if (/\.(?:ts|tsx|mjs)$/u.test(entry.name)) files.push(child);
  }
  return files;
}
