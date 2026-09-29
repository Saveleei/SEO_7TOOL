import path from "node:path";
import process from "node:process";
import {
  publishProductionCatalog,
  rollbackProductionCatalog,
  validateProductionFeedRuntime,
  verifyProductionCatalogCandidate,
  writeProductionFeedStatus,
} from "./lib/production-feed-runtime.mjs";

function argument(name, args) {
  const prefix = `--${name}=`;
  return args.find((value) => value.startsWith(prefix))?.slice(prefix.length) || null;
}

function requiredArgument(name, args) {
  const value = argument(name, args);
  if (!value) throw new Error(`Не указан обязательный аргумент --${name}=PATH`);
  return path.resolve(value);
}

function numberArgument(name, args, fallback) {
  const value = Number(argument(name, args));
  return Number.isFinite(value) ? value : fallback;
}

function main() {
  const [action, ...args] = process.argv.slice(2);
  let result;
  if (action === "check") {
    result = validateProductionFeedRuntime({
      appDir:requiredArgument("app", args),
      sharedRoot:requiredArgument("shared-root", args),
      workDir:requiredArgument("work", args),
      releasesDir:requiredArgument("releases", args),
      currentLink:requiredArgument("current", args),
      reviewedReportPath:requiredArgument("reviewed-report", args),
      statusPath:requiredArgument("status", args),
      lockPath:requiredArgument("lock", args),
      baseCatalogPath:requiredArgument("base-catalog", args),
      baseMetadataPath:requiredArgument("base-metadata", args),
      baseDatabasePath:requiredArgument("base-database", args),
      stalexStatePath:requiredArgument("stalex-state", args),
      stalexStatusPath:requiredArgument("stalex-status", args),
      stalexLockPath:requiredArgument("stalex-lock", args),
      backupDir:requiredArgument("backup-dir", args),
    });
  } else if (action === "verify") {
    result = verifyProductionCatalogCandidate({
      catalogPath:requiredArgument("catalog", args),
      metadataPath:requiredArgument("metadata", args),
      reportPath:requiredArgument("report", args),
      reviewedReportPath:requiredArgument("reviewed-report", args),
      maxAgeMinutes:numberArgument("max-age-minutes", args, 26 * 60),
    });
  } else if (action === "publish") {
    result = publishProductionCatalog({
      sharedRoot:requiredArgument("shared-root", args),
      releasesDir:requiredArgument("releases", args),
      currentLink:requiredArgument("current", args),
      catalogPath:requiredArgument("catalog", args),
      metadataPath:requiredArgument("metadata", args),
      reportPath:requiredArgument("report", args),
      reviewedReportPath:requiredArgument("reviewed-report", args),
      maxAgeMinutes:numberArgument("max-age-minutes", args, 26 * 60),
    });
  } else if (action === "rollback") {
    result = rollbackProductionCatalog({
      sharedRoot:requiredArgument("shared-root", args),
      releasesDir:requiredArgument("releases", args),
      currentLink:requiredArgument("current", args),
      targetPath:requiredArgument("target", args),
    });
  } else if (action === "status") {
    result = writeProductionFeedStatus({
      statusPath:process.env.PRODUCTION_FEED_STATUS_PATH,
      status:process.env.PRODUCTION_FEED_STATUS,
      stage:process.env.PRODUCTION_FEED_STAGE,
      mode:process.env.PRODUCTION_FEED_MODE,
      exitCode:process.env.PRODUCTION_FEED_EXIT_CODE,
      message:process.env.PRODUCTION_FEED_MESSAGE,
      catalogSha256:process.env.PRODUCTION_FEED_CATALOG_SHA,
      catalogCompletedAt:process.env.PRODUCTION_FEED_CATALOG_COMPLETED_AT,
      generationDir:process.env.PRODUCTION_FEED_GENERATION_DIR,
    });
  } else {
    throw new Error("Usage: node scripts/production-feed-runtime.mjs <check|verify|publish|rollback|status>");
  }
  console.log(JSON.stringify(result, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
