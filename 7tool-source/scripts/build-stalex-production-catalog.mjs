import path from "node:path";
import process from "node:process";
import { isDirectExecution, runStalexCatalogBuild } from "./build-stalex-test-catalog.mjs";

function argument(name, args) {
  const prefix = `--${name}=`;
  return args.find((value) => value.startsWith(prefix))?.slice(prefix.length) || null;
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function help() {
  return [
    "Build the reviewed Stalex selection into a production catalog candidate",
    "",
    "Usage:",
    "  node scripts/build-stalex-production-catalog.mjs --base=FILE --base-meta=FILE --stalex=FILE --output=FILE --meta-output=FILE --report=FILE [--limit=24]",
  ].join("\n");
}

export function runStalexProductionCatalogBuild(options) {
  return runStalexCatalogBuild({
    ...options,
    publicationScope:"production",
    sourceId:"production-stalex-catalog",
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(help());
    return;
  }
  const basePath = argument("base", args);
  const baseMetadataPath = argument("base-meta", args);
  const stalexPath = argument("stalex", args);
  const outputPath = argument("output", args);
  const metadataOutputPath = argument("meta-output", args);
  const reportPath = argument("report", args);
  if (!basePath || !baseMetadataPath || !stalexPath || !outputPath || !metadataOutputPath || !reportPath) {
    throw new Error(help());
  }
  const result = runStalexProductionCatalogBuild({
    basePath:path.resolve(basePath),
    baseMetadataPath:path.resolve(baseMetadataPath),
    stalexPath:path.resolve(stalexPath),
    outputPath:path.resolve(outputPath),
    metadataOutputPath:path.resolve(metadataOutputPath),
    reportPath:path.resolve(reportPath),
    limit:positiveInteger(argument("limit", args) || process.env.STALEX_PRODUCTION_LIMIT, 24),
  });
  console.log(JSON.stringify(result, null, 2));
}

if (isDirectExecution(process.argv[1], import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
