import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

function argument(name, args) {
  const prefix = `--${name}=`;
  return args.find((value) => value.startsWith(prefix))?.slice(prefix.length) || null;
}

function readJson(filePath, label) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved) || fs.statSync(resolved).size === 0) throw new Error(`${label} отсутствует или пуст.`);
  return { resolved, source:fs.readFileSync(resolved, "utf8") };
}

function exactProductIds(report) {
  if (!Array.isArray(report.productIds) || !report.productIds.every((value) => typeof value === "string" && value.trim())) {
    throw new Error("Отчёт пилота не содержит корректный список productIds.");
  }
  const ids = [...new Set(report.productIds)].sort();
  if (ids.length !== report.productIds.length || report.selected !== ids.length) {
    throw new Error("Количество выбранных товаров не совпадает с уникальным списком productIds.");
  }
  return ids;
}

export function validateStalexCatalogCandidate({
  catalogPath,
  metadataPath,
  reportPath,
  currentReportPath,
  allowProductSetChange = false,
  expectedScope = "test-only",
  expectedSourceId = expectedScope === "production" ? "production-stalex-catalog" : "test-stalex-pilot",
  requireReviewedProductSet = false,
}) {
  const catalogFile = readJson(catalogPath, "Каталог-кандидат");
  const metadataFile = readJson(metadataPath, "Метаданные кандидата");
  const reportFile = readJson(reportPath, "Отчёт кандидата");
  const catalog = JSON.parse(catalogFile.source);
  const metadata = JSON.parse(metadataFile.source);
  const report = JSON.parse(reportFile.source);

  if (metadata.status !== "complete" || metadata.sourceId !== expectedSourceId || metadata.publicationScope !== expectedScope) {
    throw new Error(`Метаданные кандидата не подтверждают публикацию ${expectedScope}.`);
  }
  const catalogSha256 = createHash("sha256").update(catalogFile.source).digest("hex");
  if (metadata.catalogSha256 !== catalogSha256 || report.catalogSha256 !== catalogSha256) {
    throw new Error("SHA-256 кандидата не совпадает с метаданными и отчётом.");
  }
  if (report.mode !== expectedScope || !Array.isArray(catalog.products)) {
    throw new Error(`Кандидат не является каталогом ${expectedScope} ожидаемой структуры.`);
  }

  const ids = exactProductIds(report);
  const productsById = new Map(catalog.products.map((product) => [product.id, product]));
  for (const id of ids) {
    const product = productsById.get(id);
    if (!product || product.sourceSupplier !== "stalex" || product.publicationScope !== expectedScope || !Array.isArray(product.variants) || product.variants.length === 0) {
      throw new Error(`Товар ${id} не прошёл проверку публикации ${expectedScope}.`);
    }
  }

  const resolvedCurrentReport = currentReportPath ? path.resolve(currentReportPath) : null;
  if (requireReviewedProductSet && (!resolvedCurrentReport || !fs.existsSync(resolvedCurrentReport))) {
    throw new Error("Для production требуется рассмотренный список Stalex productIds.");
  }
  if (resolvedCurrentReport && fs.existsSync(resolvedCurrentReport)) {
    const currentReport = JSON.parse(fs.readFileSync(resolvedCurrentReport, "utf8"));
    const currentIds = exactProductIds(currentReport);
    if (!allowProductSetChange && JSON.stringify(currentIds) !== JSON.stringify(ids)) {
      throw new Error("Состав Stalex-каталога изменился; требуется ручная проверка productIds.");
    }
  }

  return { catalogSha256, selected:ids.length, productIds:ids };
}

export function validateStalexTestCatalogCandidate(options) {
  return validateStalexCatalogCandidate({
    ...options,
    expectedScope:"test-only",
    expectedSourceId:"test-stalex-pilot",
  });
}

function help() {
  return "Usage: node scripts/validate-stalex-test-catalog-candidate.mjs --catalog=FILE --metadata=FILE --report=FILE [--current-report=FILE]";
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(help());
    return;
  }
  const catalogPath = argument("catalog", args);
  const metadataPath = argument("metadata", args);
  const reportPath = argument("report", args);
  if (!catalogPath || !metadataPath || !reportPath) throw new Error(help());
  const result = validateStalexTestCatalogCandidate({
    catalogPath,
    metadataPath,
    reportPath,
    currentReportPath:argument("current-report", args),
    allowProductSetChange:process.env.STALEX_ALLOW_PRODUCT_SET_CHANGE === "1",
  });
  console.log(JSON.stringify(result, null, 2));
}

export function isDirectExecution(argvPath, moduleUrl = import.meta.url) {
  if (!argvPath) return false;
  const resolvedPath = path.resolve(argvPath);
  let canonicalPath = resolvedPath;
  try {
    canonicalPath = fs.realpathSync(resolvedPath);
  } catch {
    // Keep the resolved path so a normal missing-entrypoint error remains visible.
  }
  return pathToFileURL(canonicalPath).href === moduleUrl;
}

if (isDirectExecution(process.argv[1])) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
