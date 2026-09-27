import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadSupplierFeed } from "./lib/feed-source.mjs";
import { buildStalexPreview } from "./lib/stalex-feed-preview.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_CATALOG_URL = "https://stalex.ru/upload/catalog.xml";
const DEFAULT_MODIFICATIONS_URL = "https://stalex.ru/upload/modifications.xml";
const DEFAULT_POLICY_PATH = path.join(ROOT, "config", "stalex-category-policy.json");

function argument(name, args) {
  const prefix = `--${name}=`;
  return args.find((value) => value.startsWith(prefix))?.slice(prefix.length) || null;
}

function isRemote(value) {
  return /^https?:\/\//iu.test(value);
}

function safeSource(value) {
  if (!isRemote(value)) return path.resolve(value);
  const url = new URL(value);
  return `${url.protocol}//${url.host}${url.pathname}`;
}

async function loadInput(source, maxBytes) {
  if (isRemote(source)) {
    return loadSupplierFeed({
      feedUrl: source,
      attempts: 2,
      timeoutMs: 120_000,
      maxBytes,
      allowLocalFallback: false,
    });
  }
  return loadSupplierFeed({
    localFeed: path.resolve(source),
    explicitLocalFile: true,
    maxBytes,
  });
}

export async function runStalexPreview({
  catalogSource = process.env.STALEX_CATALOG_URL || DEFAULT_CATALOG_URL,
  modificationsSource = process.env.STALEX_MODIFICATIONS_URL || DEFAULT_MODIFICATIONS_URL,
  policyPath = process.env.STALEX_POLICY_PATH || DEFAULT_POLICY_PATH,
  outputPath = null,
} = {}) {
  const policy = JSON.parse(fs.readFileSync(path.resolve(policyPath), "utf8"));
  const [catalog, modifications] = await Promise.all([
    loadInput(catalogSource, 96 * 1024 * 1024),
    loadInput(modificationsSource, 32 * 1024 * 1024),
  ]);
  const preview = buildStalexPreview({
    catalogXml: catalog.xml,
    modificationsXml: modifications.xml,
    policy,
  });
  const report = {
    ...preview,
    sources: {
      catalog: safeSource(catalogSource),
      modifications: safeSource(modificationsSource),
      catalogLoadMode: catalog.source,
      modificationsLoadMode: modifications.source,
    },
    safety: {
      writesCatalog: false,
      writesDatabase: false,
      publishesProducts: false,
      sendsExternalRequestsBeyondFeedDownload: false,
    },
  };
  if (outputPath) {
    const resolvedOutput = path.resolve(outputPath);
    fs.mkdirSync(path.dirname(resolvedOutput), { recursive: true });
    fs.writeFileSync(resolvedOutput, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }
  return report;
}

function help() {
  return [
    "Stalex preview-only feed audit (never publishes to the storefront)",
    "",
    "Usage:",
    "  npm run feed:stalex:preview -- [--catalog=URL|FILE] [--modifications=URL|FILE] [--policy=FILE] [--output=FILE]",
  ].join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log(help());
    return;
  }
  const report = await runStalexPreview({
    catalogSource: argument("catalog", args) || process.env.STALEX_CATALOG_URL || DEFAULT_CATALOG_URL,
    modificationsSource: argument("modifications", args) || process.env.STALEX_MODIFICATIONS_URL || DEFAULT_MODIFICATIONS_URL,
    policyPath: argument("policy", args) || process.env.STALEX_POLICY_PATH || DEFAULT_POLICY_PATH,
    outputPath: argument("output", args),
  });
  console.log(JSON.stringify({
    mode: report.mode,
    publicationEnabled: report.publicationEnabled,
    summary: report.summary,
    commercialGate: report.commercialGate,
    reportPath: argument("output", args) ? path.resolve(argument("output", args)) : null,
  }, null, 2));
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error("ОШИБКА ПРЕДПРОСМОТРА STALEX:", error);
    process.exitCode = 1;
  });
}
