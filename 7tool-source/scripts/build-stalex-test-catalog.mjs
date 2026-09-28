import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildStalexTestCatalog } from "./lib/stalex-test-catalog.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function argument(name, args) {
  const prefix = `--${name}=`;
  return args.find((value) => value.startsWith(prefix))?.slice(prefix.length) || null;
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function writeJsonAtomic(filePath, value) {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  const temporary = `${resolved}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(temporary, resolved);
  return fs.readFileSync(resolved, "utf8");
}

function validatedTimestamp(value) {
  const source = String(value ?? "").trim();
  return Number.isFinite(Date.parse(source)) ? source : null;
}

function oldestTimestamp(...values) {
  const valid = values.map(validatedTimestamp).filter(Boolean);
  return valid.length > 0 ? valid.sort((first, second) => Date.parse(first) - Date.parse(second))[0] : null;
}

function help() {
  return [
    "Build a deduplicated Stalex catalog pilot for test.7tool.ru only",
    "",
    "Usage:",
    "  node scripts/build-stalex-test-catalog.mjs --base=FILE --stalex=FILE --output=FILE [--report=FILE] [--base-meta=FILE --meta-output=FILE] [--limit=24]",
  ].join("\n");
}

export function runStalexTestCatalogBuild({ basePath, stalexPath, outputPath, reportPath, baseMetadataPath, metadataOutputPath, limit = 24 }) {
  const resolvedBase = path.resolve(basePath);
  const resolvedStalex = path.resolve(stalexPath);
  const resolvedOutput = path.resolve(outputPath);
  if (resolvedOutput === resolvedBase || resolvedOutput === resolvedStalex) {
    throw new Error("Пилотный каталог нельзя записывать поверх исходного файла.");
  }
  const baseCatalog = JSON.parse(fs.readFileSync(resolvedBase, "utf8"));
  const stalexSnapshot = JSON.parse(fs.readFileSync(resolvedStalex, "utf8"));
  const result = buildStalexTestCatalog({ baseCatalog, stalexSnapshot, limit });
  const catalogSource = writeJsonAtomic(resolvedOutput, result.catalog);
  if (reportPath) writeJsonAtomic(path.resolve(reportPath), result.report);
  let metadata = null;
  if (metadataOutputPath) {
    if (!baseMetadataPath) throw new Error("Для метаданных пилота требуется --base-meta.");
    const baseMetadata = JSON.parse(fs.readFileSync(path.resolve(baseMetadataPath), "utf8"));
    const completedAt = oldestTimestamp(baseMetadata.completedAt, stalexSnapshot.refreshedAt);
    if (baseMetadata.status !== "complete" || !completedAt) {
      throw new Error("Базовые метаданные или время Stalex snapshot не подтверждены.");
    }
    metadata = {
      status:"complete",
      completedAt,
      sourceId:"test-stalex-pilot",
      catalogSha256:createHash("sha256").update(catalogSource).digest("hex"),
      baseCatalogSha256:baseMetadata.catalogSha256 ?? null,
      stalexRefreshedAt:stalexSnapshot.refreshedAt,
      publicationScope:"test-only",
    };
    writeJsonAtomic(path.resolve(metadataOutputPath), metadata);
  }
  return {
    ...result.report,
    outputPath:resolvedOutput,
    reportPath:reportPath ? path.resolve(reportPath) : null,
    metadataOutputPath:metadataOutputPath ? path.resolve(metadataOutputPath) : null,
    catalogSha256:metadata?.catalogSha256 ?? createHash("sha256").update(catalogSource).digest("hex"),
  };
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log(help());
    return;
  }
  const basePath = argument("base", args) || path.join(ROOT, "src", "lib", "products.json");
  const stalexPath = argument("stalex", args) || process.env.STALEX_STATE_PATH || path.join(ROOT, ".stalex", "last-good-snapshot.json");
  const outputPath = argument("output", args) || path.join(ROOT, ".stalex", "test-catalog-pilot.json");
  const reportPath = argument("report", args) || `${outputPath}.report.json`;
  const baseMetadataPath = argument("base-meta", args);
  const metadataOutputPath = argument("meta-output", args);
  const report = runStalexTestCatalogBuild({
    basePath,
    stalexPath,
    outputPath,
    reportPath,
    baseMetadataPath,
    metadataOutputPath,
    limit: positiveInteger(argument("limit", args) || process.env.STALEX_TEST_PILOT_LIMIT, 24),
  });
  console.log(JSON.stringify(report, null, 2));
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
  try {
    main();
  } catch (error) {
    console.error("ОШИБКА СБОРКИ ТЕСТОВОГО КАТАЛОГА STALEX:", error);
    process.exitCode = 1;
  }
}
