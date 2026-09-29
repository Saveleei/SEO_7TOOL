import path from "node:path";
import process from "node:process";
import { isDirectExecution, validateStalexCatalogCandidate } from "./validate-stalex-test-catalog-candidate.mjs";

function argument(name, args) {
  const prefix = `--${name}=`;
  return args.find((value) => value.startsWith(prefix))?.slice(prefix.length) || null;
}

function help() {
  return "Usage: node scripts/validate-stalex-production-catalog-candidate.mjs --catalog=FILE --metadata=FILE --report=FILE --reviewed-report=FILE";
}

export function validateStalexProductionCatalogCandidate(options) {
  return validateStalexCatalogCandidate({
    ...options,
    currentReportPath:options.reviewedReportPath,
    expectedScope:"production",
    expectedSourceId:"production-stalex-catalog",
    requireReviewedProductSet:true,
    allowProductSetChange:false,
  });
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
  const reviewedReportPath = argument("reviewed-report", args);
  if (!catalogPath || !metadataPath || !reportPath || !reviewedReportPath) throw new Error(help());
  const result = validateStalexProductionCatalogCandidate({
    catalogPath:path.resolve(catalogPath),
    metadataPath:path.resolve(metadataPath),
    reportPath:path.resolve(reportPath),
    reviewedReportPath:path.resolve(reviewedReportPath),
  });
  console.log(JSON.stringify(result, null, 2));
}

if (isDirectExecution(process.argv[1], import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
