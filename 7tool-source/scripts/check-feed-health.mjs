import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dbPath = path.resolve(process.env.SQLITE_PATH || path.join(root, "data.db"));
const statePath = path.resolve(process.env.FEED_STATE_PATH || `${dbPath}.feed-state.json`);
const advertisingFeedPath = path.resolve(
  process.env.ADVERTISING_FEED_PATH || path.join(root, "public", "feeds", "yandex-dynamic.xml"),
);
const advertisingReportPath = path.resolve(
  process.env.ADVERTISING_FEED_REPORT_PATH || path.join(root, ".analysis", "yandex-advertising-feed.json"),
);
const maxAgeHours = Math.max(1, Number(process.env.FEED_HEALTH_MAX_AGE_HOURS || 3));
const minOffers = Math.max(1, Number(process.env.AD_FEED_MIN_OFFERS || 1_000));
const checkRemote = process.env.FEED_HEALTH_REMOTE_CHECK === "1";
const publicUrl = process.env.ADVERTISING_FEED_PUBLIC_URL
  || `${(process.env.NEXT_PUBLIC_SITE_URL || "https://7tool.ru").replace(/\/$/, "")}/feeds/yandex-dynamic.xml`;

function readJson(file, label) {
  if (!fs.existsSync(file)) throw new Error(`${label}_MISSING:${file}`);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    throw new Error(`${label}_INVALID_JSON:${file}`);
  }
}

function assertFresh(value, label) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error(`${label}_INVALID_DATE`);
  const ageHours = (Date.now() - timestamp) / 3_600_000;
  if (ageHours < -0.25) throw new Error(`${label}_FROM_FUTURE`);
  if (ageHours > maxAgeHours) throw new Error(`${label}_STALE:${ageHours.toFixed(2)}h`);
  return ageHours;
}

function inspectXml(source, label) {
  if (!/^<\?xml[\s\S]*?<yml_catalog\b/.test(source.slice(0, 500))) throw new Error(`${label}_NOT_YML`);
  if (!/<\/yml_catalog>\s*$/.test(source)) throw new Error(`${label}_TRUNCATED`);
  const offers = (source.match(/<offer\s+id="[^"]+"/g) || []).length;
  if (offers < minOffers) throw new Error(`${label}_TOO_FEW_OFFERS:${offers}`);
  return offers;
}

async function main() {
  const state = readJson(statePath, "FEED_STATE");
  const report = readJson(advertisingReportPath, "AD_FEED_REPORT");
  const stateAgeHours = assertFresh(state.completedAt, "FEED_STATE");
  const sourceAgeHours = assertFresh(state.sourceUpdatedAt, "FEED_SOURCE");
  if (!["remote", "local", "explicit-local", "fallback-local"].includes(state.sourceType)) {
    throw new Error(`FEED_SOURCE_TYPE_INVALID:${String(state.sourceType)}`);
  }
  const reportAgeHours = assertFresh(report.generatedAt, "AD_FEED_REPORT");
  if (!fs.existsSync(advertisingFeedPath)) throw new Error(`AD_FEED_MISSING:${advertisingFeedPath}`);
  const localXml = fs.readFileSync(advertisingFeedPath, "utf8");
  const localOffers = inspectXml(localXml, "AD_FEED");
  if (Number(report.offers) !== localOffers) throw new Error(`AD_FEED_REPORT_MISMATCH:${report.offers}/${localOffers}`);

  let remoteOffers = null;
  if (checkRemote) {
    const response = await fetch(publicUrl, { signal: AbortSignal.timeout(30_000), cache: "no-store" });
    if (!response.ok) throw new Error(`AD_FEED_REMOTE_HTTP_${response.status}`);
    const contentType = response.headers.get("content-type") || "";
    if (!/(xml|octet-stream|text\/plain)/i.test(contentType)) throw new Error(`AD_FEED_REMOTE_CONTENT_TYPE:${contentType}`);
    remoteOffers = inspectXml(await response.text(), "AD_FEED_REMOTE");
    if (remoteOffers !== localOffers) throw new Error(`AD_FEED_REMOTE_MISMATCH:${remoteOffers}/${localOffers}`);
  }

  console.log(JSON.stringify({
    ok: true,
    stateCompletedAt: state.completedAt,
    stateAgeHours: Number(stateAgeHours.toFixed(3)),
    sourceType: state.sourceType,
    sourceUpdatedAt: state.sourceUpdatedAt,
    sourceAgeHours: Number(sourceAgeHours.toFixed(3)),
    advertisingGeneratedAt: report.generatedAt,
    advertisingAgeHours: Number(reportAgeHours.toFixed(3)),
    localOffers,
    remoteOffers,
    remoteChecked: checkRemote,
  }, null, 2));
}

main().catch((error) => {
  console.error(`FEED_HEALTH_FAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
