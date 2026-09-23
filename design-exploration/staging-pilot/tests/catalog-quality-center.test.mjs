import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import feedSnapshotJson from "../../../7tool-source/src/lib/products.json" with { type:"json" };
import { getCategoryFamily, getCategoryFamilyShortcuts } from "../app/data/categoryAssortmentTaxonomy.mjs";
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
  assert.equal(Object.values(report.priorities).reduce((sum, priority) => sum + priority.issueCount, 0), report.issueCount);
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

test("selection quality follows each assortment family and excludes engineer-first groups", () => {
  const report = getCatalogQualityReport();
  const selectionIssues = report.issues.filter((issue) => issue.code === "missing_parameter" || issue.code === "not_filterable");
  const engineerProductIds = new Set();

  for (const product of publishedProducts) {
    const familyId = getCategoryFamily(product.category, product);
    const shortcut = getCategoryFamilyShortcuts(product.category)?.assortmentShortcuts.find((candidate) => candidate.family === familyId);
    if (shortcut?.selectionMode === "engineer") engineerProductIds.add(product.id);
  }

  assert.ok(engineerProductIds.size > 0, "the feed must exercise engineer-first assortment families");
  assert.equal(selectionIssues.some((issue) => engineerProductIds.has(issue.productId)), false);
  assert.equal(selectionIssues.every((issue) => Boolean(issue.scopeHref && issue.scopeLabel)), true);

  const manipulatorSelectionIssues = selectionIssues.filter((issue) => issue.categorySlug === "rezbonareznye-manipulyatory");
  assert.ok(manipulatorSelectionIssues.length < 30, "accessories and project manipulators must not inherit mass-market filters");
});

test("catalog work queues separate blockers, decision defects and enrichment", () => {
  const report = getCatalogQualityReport();
  const expectedPriority = {
    missing_sku:"p0",
    invalid_range:"p0",
    duplicate_sku:"p0",
    malformed_numeric:"p1",
    numeric_outlier:"p1",
    missing_image:"p1",
    not_filterable:"p1",
    missing_price:"p2",
    missing_parameter:"p2",
    duplicate_signature:"p2",
  };

  for (const issue of report.issues) assert.equal(issue.priority, expectedPriority[issue.code], issue.id);
  for (const priority of ["p0", "p1", "p2"]) {
    const matching = report.issues.filter((issue) => issue.priority === priority);
    assert.equal(report.priorities[priority].issueCount, matching.length);
    assert.equal(report.priorities[priority].affectedProductCount, new Set(matching.map((issue) => issue.productId)).size);
  }
  assert.ok(report.priorities.p0.affectedProductCount < report.priorities.p1.affectedProductCount);
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
  assert.match(page, /name="priority"/u);
  assert.match(page, /P0 · идентификация/u);
  assert.match(page, /issue\.scopeHref \?\? `\/catalog\/category\/\$\{issue\.categorySlug\}`/u);
  assert.doesNotMatch(page, /method="post"|fetch\(|server action|<button[^>]+name="action"/iu);
  assert.ok(page.includes('href={`/product/${issue.productSlug}`}'));
  assert.match(header, /canManager\(managerActor, "catalog:audit"\)/u);
  assert.match(header, /Качество каталога/u);
});
