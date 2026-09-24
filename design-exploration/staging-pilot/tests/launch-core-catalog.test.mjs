import assert from "node:assert/strict";
import test from "node:test";
import { getLaunchCoreCatalogReport, launchCoreScopes } from "../app/data/launchCoreCatalog.mjs";

test("launch catalog core has no conversion-blocking identity, link, price or shipping defects", () => {
  const report = getLaunchCoreCatalogReport();

  assert.equal(report.scopeCount, launchCoreScopes.length);
  assert.equal(report.blockingIssueCount, 0, report.scopes.flatMap((scope) => scope.blockers.map((blocker) => `${scope.title}: ${blocker}`)).join("\n"));
  for (const scope of report.scopes) {
    assert.ok(scope.totalProducts > 0, scope.title);
    assert.ok(scope.visibleProducts > 0, scope.title);
    assert.equal(scope.metrics.exactVariantLinkCoverage, 100, scope.title);
    assert.ok(scope.metrics.decisionSpecCoverage >= 75, `${scope.title}: ${scope.metrics.decisionSpecCoverage}%`);
  }
});

test("launch catalog audit keeps missing photos and request prices visible without converting them into false claims", () => {
  const report = getLaunchCoreCatalogReport();

  for (const scope of report.scopes) {
    assert.ok(scope.metrics.imageCoverage >= 0 && scope.metrics.imageCoverage <= 100);
    assert.ok(scope.metrics.pricedCardCoverage >= 0 && scope.metrics.pricedCardCoverage <= 100);
    assert.equal(scope.samples.every((product) => Boolean(product.price)), true);
    assert.equal(scope.samples.every((product) => !/сегодня/iu.test(product.shipping) || /в наличии/iu.test(product.shipping)), true);
  }
});
