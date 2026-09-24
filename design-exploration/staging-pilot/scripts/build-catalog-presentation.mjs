import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  getFeedCategory,
  getFeedCategoryFacetSnapshot,
  getFeedCategoryRankingSnapshot,
  getFeedCategoryProducts,
  getFeedProductBySlug,
  getFeedProductImage,
  getPublishedFeedCategorySlugs,
} from "../app/data/feedCatalog.ts";
import { getCatalogQualityReportSnapshot } from "../app/data/catalogQuality.ts";

const FEATURED_PRODUCT_SLUGS = [
  "magnitnyy-sverlilnyy-stanok-lenz-steyr-35",
  "ruchnaya-mashina-dlya-snyatiya-faski-s-trub-tvr-270",
  "elektricheskiy-truborez-dlya-stalnyh-i-plastikovyh-trub-liden-roar-250",
  "svarochnyy-traktor-rail-bull-2",
  "sverla-koronchatye-lzhs",
  "porshnevoy-bezmaslyanyy-2-v-1-kompressor-dc990ad-10l",
];

const feedPath = path.resolve(process.cwd(), "../../7tool-source/src/lib/products.json");
const destination = path.resolve(process.cwd(), "app/data/generatedCatalogPresentation.json");
const facetsDestination = path.resolve(process.cwd(), "app/data/generatedCatalogFacets.json");
const qualityDestination = path.resolve(process.cwd(), "app/data/generatedCatalogQuality.json");
const feedBytes = await readFile(feedPath);
const publishedCategorySlugs = getPublishedFeedCategorySlugs().slice().sort();

const categories = Object.fromEntries(publishedCategorySlugs.map((slug) => {
  const category = getFeedCategory(slug);
  const representative = getFeedCategoryProducts(slug, 1)[0];
  return [slug, {
    count:category?.count ?? 0,
    image:representative ? getFeedProductImage(representative) ?? "" : "",
  }];
}));

const products = Object.fromEntries(FEATURED_PRODUCT_SLUGS.map((slug) => {
  const product = getFeedProductBySlug(slug);
  return [slug, { image:product ? getFeedProductImage(product) ?? "" : "" }];
}));

const presentation = {
  version:1,
  sourceSha256:createHash("sha256").update(feedBytes).digest("hex"),
  publishedCategorySlugs,
  categories,
  products,
};

await writeFile(destination, `${JSON.stringify(presentation, null, 2)}\n`, "utf8");
await writeFile(facetsDestination, `${JSON.stringify({
  version:1,
  sourceSha256:presentation.sourceSha256,
  categories:Object.fromEntries(publishedCategorySlugs.map((slug) => [slug, getFeedCategoryFacetSnapshot(slug)])),
  rankings:Object.fromEntries(publishedCategorySlugs.map((slug) => [slug, getFeedCategoryRankingSnapshot(slug)])),
}, null, 2)}\n`, "utf8");
await writeFile(qualityDestination, `${JSON.stringify({
  version:1,
  sourceSha256:presentation.sourceSha256,
  report:getCatalogQualityReportSnapshot(),
})}\n`, "utf8");
console.log(`Catalog presentation generated: ${publishedCategorySlugs.length} categories.`);
