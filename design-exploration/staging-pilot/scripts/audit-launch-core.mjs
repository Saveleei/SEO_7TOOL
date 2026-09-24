import { getLaunchCoreCatalogReport } from "../app/data/launchCoreCatalog.mjs";

const report = getLaunchCoreCatalogReport();

console.log(`Launch core: ${report.scopeCount} направлений, ${report.blockingIssueCount} блокеров, ${report.warningCount} предупреждений.`);
for (const scope of report.scopes) {
  console.log(`\n${scope.title} (${scope.slug})`);
  console.log(`  Товаров: ${scope.totalProducts}; проверено в первом экране: ${scope.visibleProducts}; вариантов в карточках: ${scope.variantChoices}`);
  console.log(`  Фото: ${scope.metrics.imageCoverage}% · характеристики: ${scope.metrics.decisionSpecCoverage}% · цены: ${scope.metrics.pricedCardCoverage}% · точные ссылки: ${scope.metrics.exactVariantLinkCoverage}%`);
  for (const blocker of scope.blockers) console.log(`  BLOCKER: ${blocker}`);
  for (const warning of scope.warnings) console.log(`  WARNING: ${warning}`);
  for (const product of scope.gaps.missingImages) console.log(`    Без фото: ${product.title} — /product/${product.slug}`);
  for (const product of scope.gaps.requestPrices) console.log(`    Цена по запросу: ${product.title} — /product/${product.slug}`);
}

if (report.blockingIssueCount > 0) process.exitCode = 1;
