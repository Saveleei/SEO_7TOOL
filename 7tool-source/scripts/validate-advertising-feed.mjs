import fs from "node:fs";
import path from "node:path";

const feedPath = process.env.ADVERTISING_FEED_PATH || path.join(process.cwd(), "public", "feeds", "yandex-dynamic.xml");
const reportPath = process.env.ADVERTISING_FEED_REMOTE_REPORT_PATH || path.join(process.cwd(), ".analysis", "yandex-advertising-feed-remote.json");
const requestedLimit = Number(process.env.AD_FEED_REMOTE_LIMIT || 200);
const concurrency = Math.max(1, Math.min(Number(process.env.AD_FEED_REMOTE_CONCURRENCY || 8), 20));

function decodeXml(value) {
  return value.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

function tags(source, name) {
  return Array.from(source.matchAll(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`, "g")), (match) => decodeXml(match[1].trim()));
}

async function reachable(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    let response = await fetch(url, { method: "HEAD", redirect: "follow", signal: controller.signal });
    if (response.status === 405 || response.status === 403) {
      response = await fetch(url, { headers: { Range: "bytes=0-0" }, redirect: "follow", signal: controller.signal });
    }
    return { ok: response.status >= 200 && response.status < 400, status: response.status };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timeout);
  }
}

async function pool(items, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]);
    }
  }));
  return results;
}

const source = fs.readFileSync(feedPath, "utf8");
const offerIds = Array.from(source.matchAll(/<offer\s+id="([^"]+)"/g), (match) => decodeXml(match[1]));
const urls = tags(source, "url").filter((url) => url.includes("/p/"));
const pictures = tags(source, "picture");
const prices = tags(source, "price").map(Number);
const structuralErrors = [];
if (!offerIds.length) structuralErrors.push("feed_has_no_offers");
if (offerIds.length !== new Set(offerIds).size) structuralErrors.push("duplicate_offer_id");
if (offerIds.length !== urls.length || offerIds.length !== pictures.length || offerIds.length !== prices.length) structuralErrors.push("offer_field_count_mismatch");
if (urls.some((url) => !url.startsWith("https://"))) structuralErrors.push("non_https_product_url");
if (pictures.some((url) => !url.startsWith("https://"))) structuralErrors.push("non_https_picture_url");
if (prices.some((price) => !Number.isFinite(price) || price <= 0)) structuralErrors.push("invalid_price");
if (/<condition\b[^>]*\btype=["']new["'][^>]*\/?>/i.test(source)) structuralErrors.push("invalid_condition_type_new");

const limit = requestedLimit <= 0 ? offerIds.length : Math.min(offerIds.length, Math.max(1, requestedLimit));
const indexes = Array.from({ length: limit }, (_, index) => Math.floor(index * offerIds.length / limit));
const sample = indexes.map((index) => ({ offerId: offerIds[index], productUrl: urls[index], pictureUrl: pictures[index] }));
const checked = await pool(sample, async (item) => {
  const [product, picture] = await Promise.all([reachable(item.productUrl), reachable(item.pictureUrl)]);
  return { ...item, product, picture };
});
const failures = checked.filter((item) => !item.product.ok || !item.picture.ok);
const report = {
  checkedAt: new Date().toISOString(), feedPath, offers: offerIds.length, sampled: checked.length,
  structuralErrors, failures,
};
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
if (structuralErrors.length || failures.length) {
  console.error(`advertising-feed remote check failed: structural=${structuralErrors.length}; remote=${failures.length}`);
  process.exitCode = 1;
} else {
  console.log(`advertising-feed remote check: ${offerIds.length} offers; ${checked.length} product/image pairs OK`);
}
