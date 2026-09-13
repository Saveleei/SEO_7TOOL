import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import feedSnapshotJson from "../../../7tool-source/src/lib/products.json" with { type:"json" };
import { getCatalogQualityReport } from "../app/data/catalogQuality.ts";
import { canManager } from "../app/data/managerAccess.ts";

const feedSnapshot = feedSnapshotJson;
const publishedCategories = feedSnapshot.categories.filter((category) => category.published);
const publishedSlugs = new Set(publishedCategories.map((category) => category.slug));
const publishedProducts = feedSnapshot.products.filter((product) => publishedSlugs.has(product.category));
const productById = new Map(publishedProducts.map((product) => [product.id, product]));

test("catalog quality report covers the complete published supplier snapshot", () => {
  const report = getCatalogQualityReport();

  assert.equal(report.generatedFrom, "bundled-supplier-feed");
  assert.equal(report.categoryCount, publishedCategories.length);
  assert.equal(report.productCount, publishedProducts.length);
  assert.equal(report.variantCount, publishedProducts.reduce((sum, product) => sum + product.variants.length, 0));
  assert.equal(report.statuses.critical + report.statuses.review + report.statuses.healthy, report.categoryCount);
  assert.equal(report.issueCount, report.issues.length);
  assert.equal(report.affectedProductCount, new Set(report.issues.map((issue) => issue.productId)).size);
  assert.equal(new Set(report.issues.map((issue) => issue.id)).size, report.issueCount);
  assert.equal(getCatalogQualityReport(), report, "the expensive feed audit must be cached per server process");

  for (const category of report.categories) {
    assert.ok(publishedSlugs.has(category.slug));
    assert.ok(category.score >= 0 && category.score <= 100);
    assert.equal(category.issueCount, category.issues.length);
    for (const value of Object.values(category.metrics)) {
      assert.ok(value === null || value >= 0 && value <= 100);
    }
  }
});

test("every catalog quality issue points to evidence in the current feed", () => {
  const report = getCatalogQualityReport();

  for (const issue of report.issues) {
    const product = productById.get(issue.productId);
    assert.ok(product, `${issue.id} references an unknown product`);
    assert.equal(product.category, issue.categorySlug);
    assert.equal(product.slug, issue.productSlug);

    const variant = issue.variantId ? product.variants.find((entry) => entry.id === issue.variantId) : undefined;
    if (issue.variantId) assert.ok(variant, `${issue.id} references an unknown variant`);
    if (issue.code === "missing_sku") assert.equal(String(variant?.sku ?? "").trim(), "");
    if (issue.code === "missing_price") assert.equal(typeof variant?.price === "number" && variant.price > 0, false);
    if (issue.code === "missing_image") {
      assert.equal((product.images ?? []).some(Boolean) || product.variants.some((entry) => (entry.images ?? []).some(Boolean)), false);
    }
  }
});

test("catalog audit is an administrator-only read-only workspace", async () => {
  const page = await readFile(new URL("../app/test/catalog-quality/page.tsx", import.meta.url), "utf8");
  const header = await readFile(new URL("../app/ui/PilotHeader.tsx", import.meta.url), "utf8");
  const authCall = page.indexOf('requireManagerPageAccess("catalog:audit"');
  const reportCall = page.indexOf("getCatalogQualityReport()", authCall);

  assert.equal(canManager({ id:"admin", name:"Admin", role:"admin", source:"local" }, "catalog:audit"), true);
  assert.equal(canManager({ id:"manager", name:"Manager", role:"manager", source:"local" }, "catalog:audit"), false);
  assert.equal(canManager({ id:"approver", name:"Approver", role:"approver", source:"local" }, "catalog:audit"), false);
  assert.ok(authCall >= 0 && reportCall > authCall, "authorization must happen before the feed report is built");
  assert.match(page, /export const dynamic = "force-dynamic"/u);
  assert.match(page, /method="get"/u);
  assert.match(page, /const ISSUE_PAGE_SIZE = 100/u);
  assert.match(page, /aria-label="Страницы замечаний"/u);
  assert.doesNotMatch(page, /method="post"|fetch\(|server action|<button[^>]+name="action"/iu);
  assert.ok(page.includes('href={`/product/${issue.productSlug}`}'));
  assert.match(header, /canManager\(managerActor, "catalog:audit"\)/u);
  assert.match(header, /Качество каталога/u);
});
