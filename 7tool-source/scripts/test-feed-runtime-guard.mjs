import process from "node:process";
import { validateTestFeedRuntime, writeTestFeedRefreshStatus } from "./lib/test-feed-runtime-guard.mjs";

function argument(name, args) {
  const prefix = `--${name}=`;
  return args.find((value) => value.startsWith(prefix))?.slice(prefix.length) || null;
}

function main() {
  const [action, ...args] = process.argv.slice(2);
  if (action === "check") {
    const result = validateTestFeedRuntime({
      appDir:argument("app", args) || process.cwd(),
      storefrontBuildDir:argument("build", args) || "",
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (action === "status") {
    const result = writeTestFeedRefreshStatus({
      statusPath:process.env.FEED_REFRESH_STATUS_PATH,
      status:process.env.FEED_REFRESH_STATUS,
      stage:process.env.FEED_REFRESH_STAGE,
      exitCode:process.env.FEED_REFRESH_EXIT_CODE,
      message:process.env.FEED_REFRESH_MESSAGE,
      catalogPath:process.env.FEED_REFRESH_CATALOG_PATH,
      metadataPath:process.env.FEED_REFRESH_METADATA_PATH,
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  throw new Error("Usage: node scripts/test-feed-runtime-guard.mjs <check|status>");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
