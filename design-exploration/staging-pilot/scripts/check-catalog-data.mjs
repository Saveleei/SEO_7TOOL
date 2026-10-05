import { getCatalogBlockingProductIds, getCatalogQualityReport } from "../app/data/catalogQuality.ts";
import { getPublishedFeedCatalogSnapshot } from "../app/data/feedCatalog.ts";

const snapshot = getPublishedFeedCatalogSnapshot();
const report = getCatalogQualityReport();
const blockingProductIds = getCatalogBlockingProductIds(report);
const draftProducts = snapshot.products.filter((product) => product.draft);
const unguardedP0 = report.issues.filter((issue) => issue.priority === "p0" && !blockingProductIds.has(issue.productId));

console.log(JSON.stringify({
  status:draftProducts.length === 0 && unguardedP0.length === 0 ? "PASS_WITH_QUARANTINE" : "FAIL",
  categories:report.categoryCount,
  products:report.productCount,
  variants:report.variantCount,
  priorities:report.priorities,
  publicDraftLeaks:draftProducts.length,
  quarantinedP0Products:blockingProductIds.size,
}, null, 2));

if (draftProducts.length > 0) {
  console.error(`DATA_CONFLICT: ${draftProducts.length} draft products entered the public catalog.`);
  process.exitCode = 1;
}
if (unguardedP0.length > 0) {
  console.error(`DATA_CONFLICT: ${unguardedP0.length} P0 findings are not covered by the SEO quarantine.`);
  process.exitCode = 1;
}
if (blockingProductIds.size > 0) {
  console.warn(`DATA_CONFLICT: ${blockingProductIds.size} products remain quarantined from sitemap and Product JSON-LD until source data is corrected.`);
}
