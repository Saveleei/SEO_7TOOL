import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadSupplierFeed } from "./lib/feed-source.mjs";
import {
  acquireStalexLock,
  persistValidatedStalexSnapshot,
  writeStalexRefreshFailure,
} from "./lib/stalex-feed-refresh.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_CATALOG_URL = "https://stalex.ru/upload/catalog.xml";
const DEFAULT_MODIFICATIONS_URL = "https://stalex.ru/upload/modifications.xml";
const DEFAULT_POLICY_PATH = path.join(ROOT, "config", "stalex-category-policy.json");
const DEFAULT_STATE_PATH = path.join(ROOT, ".stalex", "last-good-snapshot.json");

function argument(name, args) {
  const prefix = `--${name}=`;
  return args.find((value) => value.startsWith(prefix))?.slice(prefix.length) || null;
}

function boundedInteger(value, min, max, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

function boundedRatio(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0.5 && parsed <= 1 ? parsed : fallback;
}

function isRemote(value) {
  return /^https?:\/\//iu.test(value);
}

function safeSource(value) {
  if (!isRemote(value)) return path.resolve(value);
  const url = new URL(value);
  return `${url.protocol}//${url.host}${url.pathname}`;
}

async function loadInput(source, { attempts, timeoutMs, maxBytes }) {
  if (isRemote(source)) {
    return loadSupplierFeed({
      feedUrl: source,
      attempts,
      timeoutMs,
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

export async function runStalexRefresh({
  catalogSource = process.env.STALEX_CATALOG_URL || DEFAULT_CATALOG_URL,
  modificationsSource = process.env.STALEX_MODIFICATIONS_URL || DEFAULT_MODIFICATIONS_URL,
  policyPath = process.env.STALEX_POLICY_PATH || DEFAULT_POLICY_PATH,
  outputPath = process.env.STALEX_STATE_PATH || DEFAULT_STATE_PATH,
  lockPath = process.env.STALEX_LOCK_PATH || `${outputPath}.lock`,
  statusPath = process.env.STALEX_STATUS_PATH || `${outputPath}.status.json`,
  minModifications = boundedInteger(process.env.STALEX_MIN_MODIFICATIONS, 1, 100_000, 800),
  minRetainedRatio = boundedRatio(process.env.STALEX_MIN_RETAINED_RATIO, 0.9),
  attempts = boundedInteger(process.env.STALEX_FETCH_ATTEMPTS, 1, 5, 2),
  timeoutMs = boundedInteger(process.env.STALEX_FETCH_TIMEOUT_MS, 1_000, 300_000, 120_000),
  catalogMaxBytes = boundedInteger(process.env.STALEX_CATALOG_MAX_BYTES, 1_024, 512 * 1024 * 1024, 96 * 1024 * 1024),
  modificationsMaxBytes = boundedInteger(process.env.STALEX_MODIFICATIONS_MAX_BYTES, 1_024, 512 * 1024 * 1024, 32 * 1024 * 1024),
} = {}) {
  const resolvedOutput = path.resolve(outputPath);
  const resolvedStatus = path.resolve(statusPath);
  const resolvedLock = path.resolve(lockPath);
  let release = () => {};
  try {
    release = acquireStalexLock(resolvedLock);
    const policy = JSON.parse(fs.readFileSync(path.resolve(policyPath), "utf8"));
    const [catalog, modifications] = await Promise.all([
      loadInput(catalogSource, { attempts, timeoutMs, maxBytes: catalogMaxBytes }),
      loadInput(modificationsSource, { attempts, timeoutMs, maxBytes: modificationsMaxBytes }),
    ]);
    return persistValidatedStalexSnapshot({
      catalogXml: catalog.xml,
      modificationsXml: modifications.xml,
      policy,
      outputPath: resolvedOutput,
      lockPath: resolvedLock,
      statusPath: resolvedStatus,
      minModifications,
      minRetainedRatio,
      lockAlreadyHeld: true,
      sources: {
        catalog: safeSource(catalogSource),
        modifications: safeSource(modificationsSource),
        catalogLoadMode: catalog.source,
        modificationsLoadMode: modifications.source,
      },
    });
  } catch (error) {
    if (error?.code !== "STALEX_LOCKED") writeStalexRefreshFailure(resolvedStatus, error, resolvedOutput);
    throw error;
  } finally {
    release();
  }
}

function help() {
  return [
    "Daily Stalex feed refresh into a validated, non-publishing last-good snapshot",
    "",
    "Usage:",
    "  npm run feed:stalex:refresh -- [--catalog=URL|FILE] [--modifications=URL|FILE] [--policy=FILE] [--output=FILE]",
  ].join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log(help());
    return;
  }
  const outputPath = argument("output", args) || process.env.STALEX_STATE_PATH || DEFAULT_STATE_PATH;
  const snapshot = await runStalexRefresh({
    catalogSource: argument("catalog", args) || process.env.STALEX_CATALOG_URL || DEFAULT_CATALOG_URL,
    modificationsSource: argument("modifications", args) || process.env.STALEX_MODIFICATIONS_URL || DEFAULT_MODIFICATIONS_URL,
    policyPath: argument("policy", args) || process.env.STALEX_POLICY_PATH || DEFAULT_POLICY_PATH,
    outputPath,
  });
  console.log(JSON.stringify({
    status: snapshot.status,
    publicationEnabled: snapshot.publicationEnabled,
    refreshedAt: snapshot.refreshedAt,
    summary: snapshot.summary,
    changes: snapshot.changes,
    snapshotPath: path.resolve(outputPath),
  }, null, 2));
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error("ОШИБКА ЕЖЕДНЕВНОГО ОБНОВЛЕНИЯ STALEX:", error);
    process.exitCode = 1;
  });
}
