import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  getProductShippingPromise,
  getVariantShippingPromise,
  hasConfirmedStock,
  resolveShippingConfig,
} from "../app/data/shippingPromise.mjs";

const mondayBeforeCutoff = new Date("2026-09-14T14:59:00.000Z"); // 17:59 Europe/Moscow
const mondayAtCutoff = new Date("2026-09-14T15:00:00.000Z"); // 18:00 Europe/Moscow

test("confirmed positive stock ships today before 18:00 Moscow on a working day", () => {
  const result = getVariantShippingPromise({ available:true, quantity:1 }, { now:mondayBeforeCutoff, env:{} });
  assert.equal(result.state, "today");
  assert.equal(result.label, "В наличии · Отгрузка сегодня");
  assert.equal(result.detail, "Для заказов до 18:00 по Москве");
});

test("18:00 Moscow is the boundary for the next working day", () => {
  const result = getVariantShippingPromise({ available:true, quantity:7 }, { now:mondayAtCutoff, env:{} });
  assert.equal(result.state, "next-working-day");
  assert.equal(result.label, "В наличии · Отгрузка в следующий рабочий день");
});

test("weekends never receive a today promise", () => {
  const saturday = new Date("2026-09-19T09:00:00.000Z");
  const result = getVariantShippingPromise({ available:true, quantity:3 }, { now:saturday, env:{} });
  assert.equal(result.state, "next-working-day");
  assert.doesNotMatch(result.label, /сегодня/iu);
});

test("only available plus a finite positive quantity is confirmed stock", () => {
  const cases = [
    [{ available:true, quantity:1 }, true],
    [{ available:true, quantity:0 }, false],
    [{ available:true }, false],
    [{ available:false, quantity:8 }, false],
    [{ available:true, quantity:Number.NaN }, false],
  ];
  for (const [variant, expected] of cases) assert.equal(hasConfirmedStock(variant), expected);
  const unconfirmed = getVariantShippingPromise({ available:true }, { now:mondayBeforeCutoff, env:{} });
  assert.equal(unconfirmed.state, "unconfirmed");
  assert.equal(unconfirmed.label, "Наличие и срок уточняем");
  assert.doesNotMatch(unconfirmed.label, /сегодня/iu);
});

test("product groups promise shipping only when at least one execution has confirmed stock", () => {
  const available = getProductShippingPromise([{ available:true, quantity:0 }, { available:true, quantity:2 }], { now:mondayBeforeCutoff, env:{} });
  const unavailable = getProductShippingPromise([{ available:true, quantity:0 }, { available:false, quantity:4 }], { now:mondayBeforeCutoff, env:{} });
  assert.equal(available.state, "today");
  assert.equal(unavailable.state, "unconfirmed");
});

test("shipping configuration is adjustable and falls back safely", () => {
  assert.deepEqual(resolveShippingConfig({ env:{} }), { cutoffHour:18, workingDays:[1, 2, 3, 4, 5], timeZone:"Europe/Moscow" });
  assert.deepEqual(resolveShippingConfig({ env:{ SHIPPING_CUTOFF_HOUR:"99", SHIPPING_WORKING_DAYS:"bad", SHIPPING_TIME_ZONE:"Mars/Olympus" } }), { cutoffHour:18, workingDays:[1, 2, 3, 4, 5], timeZone:"Europe/Moscow" });
  const custom = getVariantShippingPromise({ available:true, quantity:1 }, { now:mondayAtCutoff, cutoffHour:19, workingDays:"1,2,3,4,5", timeZone:"Europe/Moscow", env:{} });
  assert.equal(custom.state, "today");
});

test("buyer touchpoints consume the centralized server presentation", async () => {
  const files = await Promise.all([
    "../app/data/feedCatalog.ts",
    "../app/data/variantPresentation.ts",
    "../app/data/catalogSearch.ts",
    "../app/product/[slug]/page.tsx",
    "../app/ui/FeedProductPurchase.tsx",
    "../app/ui/ProductRecommendationSystem.tsx",
  ].map((path) => readFile(new URL(path, import.meta.url), "utf8")));
  for (const source of files.slice(0, 4)) assert.match(source, /get(?:Product|Variant)ShippingPromise/u);
  assert.match(files[4], /selected\.shippingPromise\.label/u);
  assert.match(files[5], /shippingPromise\.label/u);
});

test("the quote cart refreshes persisted shipping copy from a no-store server endpoint", async () => {
  const [cart, route] = await Promise.all([
    readFile(new URL("../app/ui/RequestCart.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/shipping-promises/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(cart, /fetch\(`\/api\/shipping-promises\?\$\{query\.toString\(\)\}`/u);
  assert.match(cart, /cache:"no-store"/u);
  assert.match(route, /getFeedProductVariantById/u);
  assert.match(route, /getVariantShippingPromise/u);
  assert.match(route, /"Cache-Control":"no-store, max-age=0"/u);
});
