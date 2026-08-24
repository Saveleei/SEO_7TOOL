import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://7tool.ru").replace(/\/$/, "");
const DB_PATH = process.env.SQLITE_PATH || path.join(process.cwd(), "data.db");
const OUTPUT_PATH = process.env.ADVERTISING_FEED_PATH || path.join(process.cwd(), "public", "feeds", "yandex-dynamic.xml");
const REPORT_PATH = process.env.ADVERTISING_FEED_REPORT_PATH || path.join(process.cwd(), ".analysis", "yandex-advertising-feed.json");
const HARD_EXCLUDED_PRODUCT_IDS = new Set(["G1031"]);
const CHECK_ONLY = process.argv.includes("--check");

export function advertisingOfferId(variantId) {
  const clean = String(variantId || "").trim().replace(/[^A-Za-z0-9_.:-]/g, "-").slice(0, 96);
  if (!clean) throw new Error("EMPTY_ADVERTISING_VARIANT_ID");
  return `k2-${clean}`;
}

function xml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function plain(value) {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 2_900);
}

function parseArray(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string" && item.trim()) : [];
  } catch { return []; }
}

function absoluteImage(value) {
  if (!value) return null;
  try {
    const url = new URL(value, SITE_URL);
    return url.protocol === "https:" ? url.toString() : null;
  } catch { return null; }
}

function stableCategoryId(slug) {
  let hash = 2166136261;
  for (const char of slug) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return String(1_000_000 + (hash >>> 0) % 1_000_000_000);
}

function previousOfferIds() {
  if (!fs.existsSync(OUTPUT_PATH)) return new Set();
  const source = fs.readFileSync(OUTPUT_PATH, "utf8");
  return new Set(Array.from(source.matchAll(/<offer\s+id="([^"]+)"/g), (match) => match[1]));
}

export function generateFeed() {
  const database = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  try {
    const rows = database.prepare(`
      SELECT p.id AS product_id, p.slug, p.title, p.brand, p.category, p.description,
        p.images AS product_images, p.draft, c.title AS category_title, c.published,
        v.id AS variant_id, v.sku AS variant_sku, v.name AS variant_name,
        v.price, v.old_price, v.quantity, v.available, v.images AS variant_images
      FROM products p
      JOIN categories c ON c.slug = p.category
      JOIN variants v ON v.product_id = p.id
      ORDER BY p.category, p.id, v.sort_order, v.id
    `).all();

    const categoryIds = new Map();
    const categoryIdOwners = new Map();
    const offers = [];
    const conflicts = [];
    const offerIds = new Set();
    const skuOwners = new Map();
    for (const row of rows) {
      const sku = plain(row.variant_sku);
      if (sku && row.variant_id) skuOwners.set(sku, [...(skuOwners.get(sku) || []), advertisingOfferId(row.variant_id)]);
    }
    for (const row of rows) {
      const exclusion = [];
      if (row.draft || !row.published) exclusion.push("not_public");
      if (HARD_EXCLUDED_PRODUCT_IDS.has(row.product_id)) exclusion.push("known_data_conflict");
      if (!row.available) exclusion.push("not_orderable");
      if (!Number.isFinite(row.price) || row.price <= 0) exclusion.push("invalid_price");
      const image = absoluteImage(parseArray(row.variant_images)[0] || parseArray(row.product_images)[0]);
      if (!image) exclusion.push("missing_image");
      if (!row.slug || !row.title || !row.variant_id) exclusion.push("missing_identity");
      const offerId = row.variant_id ? advertisingOfferId(row.variant_id) : "";
      if (offerIds.has(offerId)) exclusion.push("duplicate_offer_id");
      if (exclusion.length) {
        conflicts.push({ productId: row.product_id, variantId: row.variant_id, sku: row.variant_sku, reasons: exclusion });
        continue;
      }

      const categoryId = stableCategoryId(row.category);
      const owner = categoryIdOwners.get(categoryId);
      if (owner && owner !== row.category) throw new Error(`CATEGORY_ID_COLLISION:${owner}:${row.category}`);
      categoryIdOwners.set(categoryId, row.category);
      categoryIds.set(row.category, { id: categoryId, title: row.category_title || row.category });
      offerIds.add(offerId);

      const name = plain(row.variant_name) || `${plain(row.title)}${row.variant_sku ? ` · арт. ${plain(row.variant_sku)}` : ""}`;
      const url = `${SITE_URL}/p/${encodeURIComponent(row.slug)}?variant=${encodeURIComponent(row.variant_id)}`;
      const oldPrice = Number.isFinite(row.old_price) && row.old_price > row.price ? row.old_price : null;
      const description = plain(row.description) || name;
      offers.push([
        `    <offer id="${xml(offerId)}" available="true">`,
        `      <url>${xml(url)}</url>`,
        `      <price>${row.price}</price>`,
        ...(oldPrice ? [`      <oldprice>${oldPrice}</oldprice>`] : []),
        "      <currencyId>RUR</currencyId>",
        `      <categoryId>${categoryId}</categoryId>`,
        `      <picture>${xml(image)}</picture>`,
        `      <name>${xml(name)}</name>`,
        ...(row.brand && row.brand !== "—" ? [`      <vendor>${xml(plain(row.brand))}</vendor>`] : []),
        ...(row.variant_sku ? [`      <vendorCode>${xml(plain(row.variant_sku))}</vendorCode>`] : []),
        `      <description>${xml(description)}</description>`,
        `      <param name="Внутренний ID группы">${xml(row.product_id)}</param>`,
        `      <param name="ID варианта">${xml(row.variant_id)}</param>`,
        "    </offer>",
      ].join("\n"));
    }

    const duplicateSkus = Array.from(skuOwners.entries()).filter(([, ids]) => ids.length > 1).map(([sku, ids]) => ({ sku, offerIds: ids }));
    const previous = previousOfferIds();
    const removed = previous.size ? Array.from(previous).filter((id) => !offerIds.has(id)) : [];
    if (previous.size >= 100 && removed.length / previous.size > 0.25 && process.env.AD_FEED_ALLOW_LARGE_CHANGE !== "1") {
      throw new Error(`AD_FEED_LARGE_REMOVAL:${removed.length}/${previous.size}`);
    }

    const categoriesXml = Array.from(categoryIds.values()).sort((left, right) => left.id.localeCompare(right.id))
      .map((category) => `      <category id="${category.id}">${xml(category.title)}</category>`).join("\n");
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const content = [
      '<?xml version="1.0" encoding="UTF-8"?>', `<yml_catalog date="${date}">`, "  <shop>",
      "    <name>7TOOL</name>", "    <company>ООО «К2 ТУЛ»</company>", `    <url>${xml(SITE_URL)}</url>`,
      "    <currencies><currency id=\"RUR\" rate=\"1\"/></currencies>", "    <categories>", categoriesXml,
      "    </categories>", "    <offers>", offers.join("\n"), "    </offers>", "  </shop>", "</yml_catalog>", "",
    ].join("\n");
    const report = {
      generatedAt: new Date().toISOString(), source: DB_PATH, output: OUTPUT_PATH,
      offers: offers.length, categories: categoryIds.size, excluded: conflicts.length,
      duplicateOfferIds: 0, duplicateSkus, removedSincePrevious: removed,
      hardExcludedProducts: Array.from(HARD_EXCLUDED_PRODUCT_IDS), conflicts,
    };
    return { content, report };
  } finally { database.close(); }
}

function atomicWrite(target, content) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temp, content, "utf8");
  fs.renameSync(temp, target);
}

try {
  const { content, report } = generateFeed();
  if (!report.offers) throw new Error("AD_FEED_EMPTY");
  if (!CHECK_ONLY) atomicWrite(OUTPUT_PATH, content);
  atomicWrite(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`advertising-feed: ${CHECK_ONLY ? "checked" : "published"} ${report.offers} offers; excluded ${report.excluded}`);
} catch (error) {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.appendFileSync(`${REPORT_PATH}.errors.log`, `${new Date().toISOString()} ${message}\n`, "utf8");
  console.error(message);
  process.exitCode = 1;
}
