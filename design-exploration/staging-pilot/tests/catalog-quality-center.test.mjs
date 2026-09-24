import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import feedSnapshotJson from "../../../7tool-source/src/lib/products.json" with { type:"json" };
import { getCategoryFamily, getCategoryFamilyShortcuts } from "../app/data/categoryAssortmentTaxonomy.mjs";
import { getCategoryExpertProfile } from "../app/data/categoryExpertProfiles.mjs";
import { getCatalogEnrichmentQueue, getCatalogQualityReport } from "../app/data/catalogQuality.ts";
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
    if ((shortcut?.selectionMode ?? getCategoryExpertProfile(product.category).selectionMode) === "engineer") engineerProductIds.add(product.id);
  }

  assert.ok(engineerProductIds.size > 0, "the feed must exercise engineer-first assortment families");
  assert.equal(selectionIssues.some((issue) => engineerProductIds.has(issue.productId)), false);
  assert.equal(selectionIssues.every((issue) => Boolean(issue.scopeHref && issue.scopeLabel)), true);

  const manipulatorSelectionIssues = selectionIssues.filter((issue) => issue.categorySlug === "rezbonareznye-manipulyatory");
  assert.ok(manipulatorSelectionIssues.length < 30, "accessories and project manipulators must not inherit mass-market filters");
});

test("P1 excludes tolerance notation and compatibility-first accessory groups", () => {
  const report = getCatalogQualityReport();
  const numericIssues = report.issues.filter((issue) => issue.code === "malformed_numeric" || issue.code === "numeric_outlier");
  const filterIssues = report.issues.filter((issue) => issue.code === "not_filterable");

  assert.equal(numericIssues.some((issue) => /допуск|квалитет|отклонени/iu.test(issue.detail)), false);
  assert.equal(numericIssues.filter((issue) => issue.categorySlug === "svarochnye-vrashchateli-i-pozitsionery" && /скорость вращения/iu.test(issue.detail)).every((issue) => /мин\. скорость/iu.test(issue.detail)), true);
  assert.equal(filterIssues.filter((issue) => issue.categorySlug === "shlifovalnoe-i-zatochnoe-oborudovanie").every((issue) => ["wide-belt", "portable-belt", "belt", "drill"].includes(issue.familyId)), true);
  assert.equal(filterIssues.some((issue) => issue.scopeLabel === "Оснастка и опции" || issue.scopeLabel === "Патроны и оснастка" || issue.scopeLabel === "Оснастка и комплектующие"), false);
});

test("catalog work queues separate blockers, decision defects and enrichment", () => {
  const report = getCatalogQualityReport();
  const expectedPriority = {
    missing_identifier:"p0",
    duplicate_identifier:"p0",
    missing_sku:"p2",
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

test("parameter enrichment queue turns every unfilterable product into a bounded admin task", () => {
  const report = getCatalogQualityReport();
  const queue = getCatalogEnrichmentQueue(report);
  const unfilterable = report.issues.filter((issue) => issue.code === "not_filterable");

  assert.equal(queue.productCount, new Set(unfilterable.map((issue) => issue.productId)).size);
  assert.equal(queue.productCount, 359);
  assert.equal(queue.groupCount, queue.groups.length);
  assert.equal(queue.groups.reduce((sum, group) => sum + group.productCount, 0), queue.productCount);
  assert.ok(queue.groups.length > 10);
  assert.ok(queue.groups.some((group) => group.missingParameters.length > 0));
  assert.ok(queue.groups.some((group) => group.missingParameters.length === 0 && /технический паспорт/iu.test(group.action)));

  for (let index = 0; index < queue.groups.length; index += 1) {
    const group = queue.groups[index];
    assert.ok(group.productCount > 0);
    assert.ok(group.sampleProducts.length > 0 && group.sampleProducts.length <= 3);
    assert.match(group.queueHref, /^\/test\/catalog-quality\?priority=p1&category=[^&]+&issue=not_filterable$/u);
    assert.match(group.scopeHref, /^\/catalog\/category\//u);
    if (index > 0) assert.ok(queue.groups[index - 1].productCount >= group.productCount);
  }
});

test("P0 identity checks use the stable feed id and scope public articles by brand", () => {
  const report = getCatalogQualityReport();
  const variants = publishedProducts.flatMap((product) => product.variants.map((variant) => ({ product, variant })));
  const normalize = (value) => String(value ?? "").trim().toLocaleLowerCase("ru-RU").replace(/\s+/gu, " ");
  const publicSku = (product, variant) => normalize(variant.sku) || (product.variants.length === 1 ? normalize(product.sku) : "");
  const missingPublicSkuCount = variants.filter(({ product, variant }) => !publicSku(product, variant)).length;
  const identifiers = variants.map(({ variant }) => normalize(variant.id)).filter(Boolean);
  const duplicateIdentityCount = Object.values(Object.groupBy(identifiers, (identifier) => identifier)).filter((group) => group.length > 1).reduce((sum, group) => sum + group.length, 0);

  assert.equal(report.issues.filter((issue) => issue.code === "missing_sku").length, missingPublicSkuCount);
  assert.equal(report.issues.some((issue) => issue.code === "missing_sku" && issue.priority === "p0"), false);
  assert.equal(report.issues.filter((issue) => issue.code === "missing_identifier").length, variants.filter(({ variant }) => !normalize(variant.id)).length);
  assert.equal(report.issues.filter((issue) => issue.code === "duplicate_identifier").length, duplicateIdentityCount);

  for (const issue of report.issues.filter((entry) => entry.code === "duplicate_sku")) {
    const product = productById.get(issue.productId);
    const matching = variants.filter(({ product: candidateProduct, variant }) => normalize(candidateProduct.brand) === normalize(product.brand) && publicSku(candidateProduct, variant) === normalize(issue.sku));
    assert.ok(matching.length > 1, `${issue.id} is only a cross-brand model-code collision`);
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
    if (issue.code === "missing_identifier") assert.equal(String(variant?.id ?? "").trim(), "");
    if (issue.code === "missing_sku") assert.equal(String(variant?.sku ?? "").trim() || (product.variants.length === 1 ? String(product.sku ?? "").trim() : ""), "");
    if (issue.code === "missing_price") assert.equal(typeof variant?.price === "number" && variant.price > 0, false);
    if (issue.code === "missing_image") {
      assert.equal((product.images ?? []).some(Boolean) || product.variants.some((entry) => (entry.images ?? []).some(Boolean)), false);
    }
  }
});

test("catalog audit is an administrator-only read-only workspace", async () => {
  const page = await readFile(new URL("../app/test/catalog-quality/page.tsx", import.meta.url), "utf8");
  const header = await readFile(new URL("../app/ui/PilotHeader.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
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
  assert.match(page, /Очередь обогащения параметров/u);
  assert.match(page, /getCatalogEnrichmentQueue\(report\)/u);
  assert.match(page, /group\.missingParameters/u);
  assert.match(page, /Все товары очереди/u);
  assert.match(css, /\.catalog-enrichment-groups \{ display:grid; grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/u);
  assert.match(css, /@media \(max-width:720px\)[\s\S]*\.catalog-enrichment-groups \{ grid-template-columns:1fr; \}/u);
  assert.match(page, /issue\.scopeHref \?\? `\/catalog\/category\/\$\{issue\.categorySlug\}`/u);
  assert.doesNotMatch(page, /method="post"|fetch\(|server action|<button[^>]+name="action"/iu);
  assert.ok(page.includes('href={`/product/${issue.productSlug}`}'));
  assert.match(header, /canManager\(managerActor, "catalog:audit"\)/u);
  assert.match(header, /Качество каталога/u);
});
