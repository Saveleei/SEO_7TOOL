import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { publicProductSlug } from "../app/data/publicUrls.ts";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sitemapPath = process.argv[2];
if (!sitemapPath) throw new Error("Usage: node scripts/capture-legacy-products.mjs <legacy-sitemap.xml>");
const outputPath = path.resolve(appRoot, "app/data/generatedLegacyRetainedProducts.json");
const catalogPath = path.resolve(appRoot, "../../7tool-source/src/lib/products.json");
const [sitemapSource, catalogSource] = await Promise.all([readFile(path.resolve(sitemapPath), "utf8"), readFile(catalogPath, "utf8")]);
const snapshot = JSON.parse(catalogSource);
const publishedCategories = new Set(snapshot.categories.filter((category) => category.published).map((category) => category.slug));
const knownSlugs = new Set();
for (const product of snapshot.products.filter((product) => !product.draft && publishedCategories.has(product.category))) {
  knownSlugs.add(product.slug);
  if (product.variants.length > 1) for (const variant of product.variants) knownSlugs.add(publicProductSlug(product, variant));
}
const liveProductPaths = [...sitemapSource.matchAll(/<loc>(https:\/\/7tool\.ru\/p\/[^<]+)<\/loc>/gu)].map((match) => new URL(match[1]).pathname);
const missingPaths = liveProductPaths.filter((pathname) => !knownSlugs.has(pathname.slice(3)));

const entries = await parallelMap(missingPaths, 8, async (pathname) => {
  const response = await fetch(new URL(pathname, "https://7tool.ru"), { headers:{ "user-agent":"7TOOL migration audit/1.0" } });
  if (!response.ok) throw new Error(`${pathname}: HTTP ${response.status}`);
  const source = await response.text();
  const structured = [...source.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gu)]
    .flatMap((match) => {
      try { return [JSON.parse(match[1])]; } catch { return []; }
    });
  const entity = findProductEntity(structured, pathname);
  if (!entity) throw new Error(`${pathname}: matching Product/ProductGroup JSON-LD was not found`);
  const groupId = entity.isVariantOf?.["@id"] ?? (entity["@type"] === "ProductGroup" ? entity["@id"] : undefined);
  return {
    slug:pathname.slice(3),
    title:String(entity.name || "Снятая с публикации позиция"),
    description:String(entity.description || "").slice(0, 1200),
    brand:String(entity.brand?.name || ""),
    category:String(entity.category || ""),
    sku:String(entity.sku || ""),
    image:Array.isArray(entity.image) ? String(entity.image[0] || "") : String(entity.image || ""),
    groupPath:groupId ? new URL(String(groupId).replace(/#.*$/u, "")).pathname : undefined,
  };
});

const artifact = {
  version:1,
  capturedAt:new Date().toISOString(),
  sitemapSha256:createHash("sha256").update(sitemapSource).digest("hex"),
  catalogSha256:createHash("sha256").update(catalogSource).digest("hex"),
  entries:entries.sort((first, second) => first.slug.localeCompare(second.slug, "ru-RU")),
};
await writeFile(outputPath, `${JSON.stringify(artifact)}\n`, "utf8");
console.log(`Captured ${entries.length} published product URLs absent from the bundled catalog.`);

function findProductEntity(values, pathname) {
  const candidates = [];
  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    if (value["@type"] === "Product" || value["@type"] === "ProductGroup") candidates.push(value);
    if (Array.isArray(value)) for (const item of value) visit(item);
    else for (const item of Object.values(value)) visit(item);
  };
  for (const value of values) visit(value);
  return candidates.find((candidate) => {
    try { return new URL(String(candidate.url || candidate["@id"] || "").replace(/#.*$/u, "")).pathname === pathname; } catch { return false; }
  });
}

async function parallelMap(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length:Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]);
    }
  }));
  return results;
}
