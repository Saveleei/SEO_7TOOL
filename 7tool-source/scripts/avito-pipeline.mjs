import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildAnalyticsReport, parseCsv } from "../src/lib/avito/analytics.mjs";
import { buildAvitoPipeline } from "../src/lib/avito/core.mjs";
import { parseSupplierFeed } from "./lib/supplier-feed-parser.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function args(argv) {
  const result = { dryRun: true };
  for (let index = 0; index < argv.length; index++) {
    const value = argv[index];
    if (value === "--publish-local") result.dryRun = false;
    else if (value === "--dry-run") result.dryRun = true;
    else if (value.startsWith("--")) {
      const key = value.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      const next = argv[index + 1];
      if (!next || next.startsWith("--")) throw new Error(`ARGUMENT_VALUE_REQUIRED:${value}`);
      result[key] = next;
      index++;
    } else if (!result.feed) result.feed = value;
    else throw new Error(`UNKNOWN_ARGUMENT:${value}`);
  }
  return result;
}

function readJson(filePath, fallback = null) {
  if (!filePath || !fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function resolveInsideRoot(value, label) {
  const target = path.resolve(ROOT, value);
  if (!target.startsWith(`${ROOT}${path.sep}`) && target !== ROOT) throw new Error(`${label}_OUTSIDE_PROJECT`);
  return target;
}

function atomicWrite(target, content) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temp, content);
  fs.renameSync(temp, target);
}

async function readLimitedResponse(response, maxBytes) {
  if (!response.body) throw new Error("FEED_BODY_MISSING");
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new Error("FEED_TOO_LARGE");
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) { await reader.cancel(); throw new Error("FEED_TOO_LARGE"); }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function loadFeed(source, config, { configuredSecretSource = false } = {}) {
  if (!source) throw new Error("FEED_SOURCE_REQUIRED: use --feed, AVITO_FEED_FILE or AVITO_FEED_URL");
  if (!/^https?:\/\//i.test(source)) {
    const target = path.resolve(ROOT, source);
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) throw new Error(`FEED_FILE_NOT_FOUND:${target}`);
    const size = fs.statSync(target).size;
    if (size > Number(config.source?.maxBytes ?? 100 * 1024 * 1024)) throw new Error("FEED_TOO_LARGE");
    return { xml: fs.readFileSync(target, "utf8"), label: path.relative(ROOT, target) };
  }
  const url = new URL(source);
  if (url.protocol !== "https:") throw new Error("FEED_URL_HTTPS_REQUIRED");
  const allowedHosts = new Set((config.source?.allowedHosts ?? []).map((host) => String(host).toLocaleLowerCase("en-US")));
  if (configuredSecretSource && config.source?.trustConfiguredFeedHost === true) {
    allowedHosts.add(url.hostname.toLocaleLowerCase("en-US"));
  }
  if (!allowedHosts.has(url.hostname.toLocaleLowerCase("en-US"))) throw new Error("FEED_HOST_NOT_ALLOWLISTED");
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(Number(config.source?.timeoutMs ?? 30_000)) });
  if (!response.ok) throw new Error(`FEED_HTTP_${response.status}`);
  return { xml: await readLimitedResponse(response, Number(config.source?.maxBytes ?? 100 * 1024 * 1024)), label: `${url.protocol}//${url.host}${url.pathname}` };
}

function validateConfig(config) {
  const errors = [];
  if (!config.company?.warehouseAddress) errors.push("company.warehouseAddress");
  if (!config.company?.warehouseCity) errors.push("company.warehouseCity");
  if (!config.categories || !Object.keys(config.categories).length) errors.push("categories");
  if (!Number.isFinite(Number(config.selection?.limit))) errors.push("selection.limit");
  if (errors.length) throw new Error(`AVITO_CONFIG_REQUIRED:${errors.join(",")}`);
}

function firstNonEmpty(...values) {
  return values.find((value) => typeof value === "string" && value.trim())?.trim();
}

async function main() {
  const options = args(process.argv.slice(2));
  const configPath = resolveInsideRoot(options.config ?? process.env.AVITO_CONFIG ?? "config/avito.example.json", "CONFIG");
  const config = readJson(configPath);
  if (!config) throw new Error(`AVITO_CONFIG_NOT_FOUND:${configPath}`);
  validateConfig(config);
  const outputDir = resolveInsideRoot(options.output ?? process.env.AVITO_OUTPUT_DIR ?? ".avito", "OUTPUT");
  const statePath = resolveInsideRoot(options.state ?? process.env.AVITO_STATE_PATH ?? ".avito/last-good-state.json", "STATE");
  const explicitSource = firstNonEmpty(options.feed, process.env.AVITO_FEED_FILE, process.env.AVITO_FEED_URL);
  const sharedSupplierSource = firstNonEmpty(process.env.FEED_FILE, process.env.FEED_URL);
  const source = explicitSource ?? sharedSupplierSource;
  const loaded = await loadFeed(source, config, { configuredSecretSource: !explicitSource && Boolean(sharedSupplierSource) });
  const offers = parseSupplierFeed(loaded.xml, { maxPictures: Number(config.images?.maxProductImages ?? 9) });
  const previousState = readJson(statePath);
  const result = buildAvitoPipeline({ offers, config, previousState });
  result.report.dryRun = options.dryRun;
  result.report.source = loaded.label;
  result.report.config = path.relative(ROOT, configPath);

  atomicWrite(path.join(outputDir, "candidate-avito.xml"), result.xml);
  atomicWrite(path.join(outputDir, "report.json"), `${JSON.stringify(result.report, null, 2)}\n`);
  atomicWrite(path.join(outputDir, "preview.html"), result.html);
  atomicWrite(path.join(outputDir, "candidate-state.json"), `${JSON.stringify(result.state)}\n`);

  const analyticsPath = options.analytics ? resolveInsideRoot(options.analytics, "ANALYTICS") : null;
  if (analyticsPath) {
    const csv = fs.readFileSync(analyticsPath, "utf8");
    const delimiter = csv.split("\n", 1)[0].includes(";") ? ";" : ",";
    atomicWrite(path.join(outputDir, "analytics-report.json"), `${JSON.stringify(buildAnalyticsReport(parseCsv(csv, delimiter)), null, 2)}\n`);
  }

  if (!options.dryRun) {
    if (!result.report.selected) throw new Error("AVITO_LOCAL_PUBLISH_EMPTY_BLOCKED");
    const publicFeed = resolveInsideRoot(config.output?.publicFeedPath ?? "public/feeds/avito.xml", "PUBLIC_FEED");
    atomicWrite(publicFeed, result.xml);
    atomicWrite(statePath, `${JSON.stringify(result.state)}\n`);
  }
  console.log(JSON.stringify({
    mode: options.dryRun ? "dry-run" : "local-publish",
    source: loaded.label,
    selected: result.report.selected,
    excluded: result.report.excluded,
    failed: result.report.failed,
    preview: path.relative(ROOT, path.join(outputDir, "preview.html")),
    xml: path.relative(ROOT, path.join(outputDir, "candidate-avito.xml")),
  }, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  const errorDir = path.resolve(ROOT, ".avito");
  fs.mkdirSync(errorDir, { recursive: true });
  fs.appendFileSync(path.join(errorDir, "errors.log"), `${new Date().toISOString()} ${message}\n`, "utf8");
  console.error(message);
  process.exitCode = 1;
});
