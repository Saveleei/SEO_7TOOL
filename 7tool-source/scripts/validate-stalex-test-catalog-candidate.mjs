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

export function validateStalexTestCatalogCandidate({ catalogPath, metadataPath, reportPath, currentReportPath, allowProductSetChange = false }) {
  const catalogFile = readJson(catalogPath, "Каталог-кандидат");
  const metadataFile = readJson(metadataPath, "Метаданные кандидата");
  const reportFile = readJson(reportPath, "Отчёт кандидата");
  const catalog = JSON.parse(catalogFile.source);
  const metadata = JSON.parse(metadataFile.source);
  const report = JSON.parse(reportFile.source);

  if (metadata.status !== "complete" || metadata.sourceId !== "test-stalex-pilot" || metadata.publicationScope !== "test-only") {
    throw new Error("Метаданные кандидата не подтверждают test-only публикацию.");
  }
  const catalogSha256 = createHash("sha256").update(catalogFile.source).digest("hex");
  if (metadata.catalogSha256 !== catalogSha256 || report.catalogSha256 !== catalogSha256) {
    throw new Error("SHA-256 кандидата не совпадает с метаданными и отчётом.");
  }
  if (report.mode !== "test-only" || !Array.isArray(catalog.products)) {
    throw new Error("Кандидат не является тестовым каталогом ожидаемой структуры.");
  }

  const ids = exactProductIds(report);
  const productsById = new Map(catalog.products.map((product) => [product.id, product]));
  for (const id of ids) {
    const product = productsById.get(id);
    if (!product || product.sourceSupplier !== "stalex" || product.publicationScope !== "test-only" || !Array.isArray(product.variants) || product.variants.length === 0) {
      throw new Error(`Товар ${id} не прошёл test-only проверку публикации.`);
    }
  }

  if (currentReportPath && fs.existsSync(path.resolve(currentReportPath))) {
    const currentReport = JSON.parse(fs.readFileSync(path.resolve(currentReportPath), "utf8"));
    const currentIds = exactProductIds(currentReport);
    if (!allowProductSetChange && JSON.stringify(currentIds) !== JSON.stringify(ids)) {
      throw new Error("Состав Stalex-пилота изменился; требуется ручная проверка и новая сборка test-релиза.");
    }
  }

  return { catalogSha256, selected:ids.length, productIds:ids };
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
