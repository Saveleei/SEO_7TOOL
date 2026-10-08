import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getQuickOrderMode, hasConfirmedQuickOrderPrice } from "../app/data/quickOrder.mjs";

test("quick order is offered only for an exact available variant with a fixed price", () => {
  assert.equal(hasConfirmedQuickOrderPrice("47 999 ₽"), true);
  assert.equal(hasConfirmedQuickOrderPrice("Цена по запросу"), false);
  assert.equal(hasConfirmedQuickOrderPrice("от 47 999 ₽"), false);
  assert.equal(getQuickOrderMode({ available:true, price:"47 999 ₽" }).id, "order");
  assert.equal(getQuickOrderMode({ available:false, price:"47 999 ₽" }).id, "request");
  assert.equal(getQuickOrderMode({ available:true, price:"Цена по запросу" }).id, "request");
});

test("the short form reuses the protected request API and keeps only phone mandatory", async () => {
  const source = await readFile(new URL("../app/ui/QuickOrderDialog.tsx", import.meta.url), "utf8");
  assert.match(source, /formData\.set\("request_type", "quick_order"\)/u);
  assert.match(source, /crypto\.randomUUID\(\)/u);
  assert.match(source, /JSON\.stringify\(\[\{ \.\.\.item, quantity \}\]\)/u);
  assert.match(source, /name="phone"[\s\S]*required/u);
  assert.match(source, /name="consent"[\s\S]*defaultChecked required/u);
  assert.match(source, /name="contact_name"/u);
  assert.match(source, /name="email"/u);
  assert.doesNotMatch(source, /name="email"[^>]*required/u);
  assert.match(source, /name="billing_file"/u);
  assert.match(source, /requisitesFile\.size > 10 \* 1024 \* 1024/u);
  assert.match(source, /X-Requested-With":"7tool-quick-order"/u);
});

test("analytics contains product context but no client contacts", async () => {
  const source = await readFile(new URL("../app/ui/QuickOrderDialog.tsx", import.meta.url), "utf8");
  assert.match(source, /open_quick_order/u);
  assert.match(source, /submit_quick_order/u);
  assert.match(source, /quick_order_success/u);
  assert.match(source, /product_id:productId/u);
  assert.match(source, /variant_id:variantId/u);
  const tracker = source.slice(source.indexOf("function track"), source.indexOf("function openDialog"));
  assert.doesNotMatch(tracker, /phone|company|comment|email/ui);
});

test("category cards, table rows and product buybox expose one exact-variant quote action", async () => {
  const [card, table, purchase] = await Promise.all([
    readFile(new URL("../app/ui/FeedProductCard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ui/FeedProductTable.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ui/FeedProductPurchase.tsx", import.meta.url), "utf8"),
  ]);
  for (const source of [card, table, purchase]) {
    assert.match(source, /Получить КП/u);
    assert.doesNotMatch(source, /feed-quote-secondary|>В запрос</u);
    assert.doesNotMatch(source, /feed-quote-quick|feed-open-quote|QuickOrderDialog/u);
  }
  assert.doesNotMatch(card, /feed-all-characteristics/u);
  assert.doesNotMatch(table, /feed-all-characteristics|feed-mobile-all-variants/u);
});

test("all public exact-variant entry points use one quote action label", async () => {
  const sources = await Promise.all([
    readFile(new URL("../app/ui/RequestCart.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ui/ProductListing.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ui/ProductRecommendationSystem.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ui/ProductComparisonDialog.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/product/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/search/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/compare/ComparePageClient.tsx", import.meta.url), "utf8"),
  ]);
  for (const source of sources) assert.doesNotMatch(source, />В запрос<|Добавить в КП/u);
  assert.match(sources[0], /children \?\? "Получить КП"/u);
});

test("series availability uses the concise in-stock wording", async () => {
  const source = await readFile(new URL("../app/ui/FeedAvailability.tsx", import.meta.url), "utf8");
  assert.match(source, /`В наличии · \$\{shippingPromise\.shipmentLabel\}`/u);
  assert.doesNotMatch(source, /Есть исполнения в наличии/u);
});

test("the dialog is keyboard accessible and becomes a mobile bottom sheet", async () => {
  const [source, styles] = await Promise.all([
    readFile(new URL("../app/ui/QuickOrderDialog.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(source, /role="dialog" aria-modal="true"/u);
  assert.match(source, /event\.key === "Escape"/u);
  assert.match(source, /FOCUSABLE_SELECTOR/u);
  assert.match(styles, /\.quick-order-layer \{[^}]*position:fixed/us);
  assert.match(styles, /@media \(max-width:760px\)[\s\S]*\.quick-order-dialog \{ width:100%;[^}]*border-radius:12px 12px 0 0;/u);
  assert.match(styles, /\.feed-product-actions>\.quick-order-trigger,[\s\S]*background:#fff; color:var\(--action-dark\)/u);
});
