import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("рекламный offer id строится только из стабильного variant id", () => {
  const catalog = JSON.parse(read("src/lib/products.json"));
  const ids = catalog.products.flatMap((product) => product.variants.map((variant) => `k2-${variant.id}`));
  assert.equal(ids.length, new Set(ids).size, "advertising offer ids must be unique");
  assert.ok(ids.every((id) => /^k2-[A-Za-z0-9_.:-]{1,96}$/.test(id)));

  const contract = read("src/lib/advertising.ts");
  const generator = read("scripts/generate-advertising-feed.mjs");
  assert.match(contract, /return `\$\{OFFER_NAMESPACE\}\$\{clean\}`/);
  assert.match(generator, /return `k2-\$\{clean\}`/);
  assert.match(generator, /\?variant=\$\{encodeURIComponent\(row\.variant_id\)\}/);
  assert.match(generator, /duplicateSkus/);
  assert.doesNotMatch(generator, /exclusion\.push\("duplicate_sku"\)/);
  assert.match(generator, /HARD_EXCLUDED_PRODUCT_IDS = new Set\(\["G1031"\]\)/);
  assert.doesNotMatch(generator, /offer id=.*variant_sku/i);
  assert.doesNotMatch(generator, /<condition\s+type=["']new["']/i);
  assert.match(read("scripts/validate-advertising-feed.mjs"), /invalid_condition_type_new/);
});

test("Ecommerce использует тот же advertisingOfferId и вариант, что YML", () => {
  const advertising = read("src/lib/advertising.ts");
  const productView = read("src/app/p/[slug]/ProductView.tsx");
  const add = read("src/components/AddToCartButton.tsx");
  const cart = read("src/app/cart/CartView.tsx");
  const productCard = read("src/components/ProductCard.tsx");
  const landingCard = read("src/components/landing/LandingProductCard.tsx");
  assert.match(advertising, /id: advertisingOfferId\(variant\.id\)/);
  assert.match(productView, /trackEcommerce\("detail"/);
  assert.match(add, /trackEcommerce\("add"/);
  assert.match(cart, /trackEcommerce\("remove"/);
  assert.match(productCard, /advertisingVariantUrl\(p, representative\)/);
  assert.match(landingCard, /advertisingVariantUrl\(product, representative\)/);
});

test("очереди уведомлений и офлайн-конверсий идемпотентны", () => {
  const db = read("src/lib/db.ts");
  const leads = read("src/lib/leads.ts");
  const offline = read("src/lib/offline-conversions.ts");
  assert.match(db, /CREATE TABLE IF NOT EXISTS notification_outbox/);
  assert.match(db, /UNIQUE\(lead_id, channel\)/);
  assert.match(db, /CREATE TABLE IF NOT EXISTS offline_conversions/);
  assert.match(db, /UNIQUE\(lead_id, target\)/);
  assert.match(leads, /submission_id/);
  assert.match(leads, /processDueNotifications/);
  assert.match(offline, /state = 'accepted'/);
  assert.match(offline, /status === "PROCESSED"/);
  assert.match(offline, /offline_conversions\/uploading\/\$\{item\.provider_upload_id\}/);
});

test("офлайн-выгрузка проверяет настоящую admin-сессию и не экспортирует внутренний UUID", () => {
  const route = read("src/app/api/admin/offline-conversions/route.ts");
  const leads = read("src/lib/leads.ts");
  const attribution = read("src/components/AttributionCapture.tsx");
  assert.match(route, /getCurrentSession/);
  assert.match(route, /role === "admin"/);
  assert.match(leads, /internal_client_id/);
  assert.match(leads, /ymClientId/);
  assert.doesNotMatch(leads, /ymClientId \?\? attribution\.clientId/);
  assert.match(attribution, /lastNonDirect/);
});

test("параметры целей ограничены неперсональным allowlist", () => {
  const analytics = read("src/lib/analytics.ts");
  const params = analytics.slice(analytics.indexOf("export type AnalyticsParams"), analytics.indexOf("export type EcommerceProduct"));
  for (const key of ["form_id", "page_type", "category", "subcategory", "product_id", "variant_id", "brand", "intent", "placement", "channel", "list"]) {
    assert.match(analytics, new RegExp(`"${key}"`));
  }
  for (const forbidden of ["phone", "email", "name", "inn", "company", "message"]) {
    assert.doesNotMatch(params, new RegExp(`\\b${forbidden}\\??:`));
  }
});
