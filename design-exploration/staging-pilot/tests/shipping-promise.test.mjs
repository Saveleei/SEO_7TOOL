import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  getProductShippingPromise,
  getFeedFreshness,
  getVariantShippingPromise,
  hasConfirmedStock,
  resolveShippingConfig,
} from "../app/data/shippingPromise.mjs";

const mondayBeforeCutoff = new Date("2026-09-14T14:59:00.000Z"); // 17:59 Europe/Moscow
const mondayAtCutoff = new Date("2026-09-14T15:00:00.000Z"); // 18:00 Europe/Moscow
const freshFeed = "2026-09-14T14:45:00.000Z";

test("confirmed positive stock ships today before 18:00 Moscow on a working day", () => {
  const result = getVariantShippingPromise({ available:true, quantity:1 }, { now:mondayBeforeCutoff, feedUpdatedAt:freshFeed, env:{} });
  assert.equal(result.state, "today");
  assert.equal(result.label, "В наличии · Отгрузка сегодня");
  assert.equal(result.detail, "Для заказов до 18:00 по Москве");
});

test("18:00 Moscow is the boundary for the next working day", () => {
  const result = getVariantShippingPromise({ available:true, quantity:7 }, { now:mondayAtCutoff, feedUpdatedAt:freshFeed, env:{} });
  assert.equal(result.state, "next-working-day");
  assert.equal(result.label, "В наличии · Отгрузка в следующий рабочий день");
  assert.match(result.detail, /15 сентября/u);
});

test("weekends never receive a today promise", () => {
  const saturday = new Date("2026-09-19T09:00:00.000Z");
  const result = getVariantShippingPromise({ available:true, quantity:3 }, { now:saturday, feedUpdatedAt:"2026-09-19T08:45:00.000Z", env:{} });
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
  const unconfirmed = getVariantShippingPromise({ available:true }, { now:mondayBeforeCutoff, feedUpdatedAt:freshFeed, env:{} });
  assert.equal(unconfirmed.state, "unconfirmed");
  assert.equal(unconfirmed.label, "Наличие и срок уточняем");
  assert.doesNotMatch(unconfirmed.label, /сегодня/iu);
});

test("product groups promise shipping only when at least one execution has confirmed stock", () => {
  const available = getProductShippingPromise([{ available:true, quantity:0 }, { available:true, quantity:2 }], { now:mondayBeforeCutoff, feedUpdatedAt:freshFeed, env:{} });
  const unavailable = getProductShippingPromise([{ available:true, quantity:0 }, { available:false, quantity:4 }], { now:mondayBeforeCutoff, feedUpdatedAt:freshFeed, env:{} });
  assert.equal(available.state, "today");
  assert.equal(unavailable.state, "unconfirmed");
});

test("shipping configuration is adjustable and falls back safely", () => {
  assert.deepEqual(resolveShippingConfig({ env:{} }), { cutoffHour:18, workingDays:[1, 2, 3, 4, 5], holidays:[], timeZone:"Europe/Moscow", todayShippingEnabled:true, maxSnapshotAgeMinutes:180, feedUpdatedAt:"" });
  assert.deepEqual(resolveShippingConfig({ env:{ SHIPPING_CUTOFF_HOUR:"99", SHIPPING_WORKING_DAYS:"bad", SHIPPING_TIME_ZONE:"Mars/Olympus" } }), { cutoffHour:18, workingDays:[1, 2, 3, 4, 5], holidays:[], timeZone:"Europe/Moscow", todayShippingEnabled:true, maxSnapshotAgeMinutes:180, feedUpdatedAt:"" });
  const custom = getVariantShippingPromise({ available:true, quantity:1 }, { now:mondayAtCutoff, cutoffHour:19, workingDays:"1,2,3,4,5", timeZone:"Europe/Moscow", feedUpdatedAt:freshFeed, env:{} });
  assert.equal(custom.state, "today");
});

test("missing, stale or future snapshot timestamps fail closed", () => {
  for (const [feedUpdatedAt, reason] of [["", "feed-missing"], ["2026-09-14T10:00:00.000Z", "feed-stale"], ["2026-09-14T16:00:00.000Z", "feed-future"]]) {
    const result = getVariantShippingPromise({ available:true, quantity:5 }, { now:mondayBeforeCutoff, feedUpdatedAt, maxSnapshotAgeMinutes:180, env:{} });
    assert.equal(result.state, "unconfirmed");
    assert.equal(result.available, false);
    assert.equal(result.reason, reason);
    assert.doesNotMatch(result.label, /сегодня|в наличии/iu);
  }
  assert.deepEqual(getFeedFreshness(freshFeed, mondayBeforeCutoff, 180), { fresh:true, reason:"fresh", ageMinutes:14 });
});

test("administrator emergency switch and calendar exceptions suppress today", () => {
  const disabled = getVariantShippingPromise({ available:true, quantity:5 }, { now:mondayBeforeCutoff, feedUpdatedAt:freshFeed, todayShippingEnabled:false, env:{} });
  assert.equal(disabled.reason, "shipping-disabled");
  const holiday = getVariantShippingPromise({ available:true, quantity:5 }, { now:mondayBeforeCutoff, feedUpdatedAt:freshFeed, holidays:["2026-09-14", "2026-09-15"], env:{} });
  assert.equal(holiday.state, "next-working-day");
  assert.match(holiday.detail, /16 сентября/u);
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

test("the feed refresh publishes snapshot metadata only after the catalog rename", async () => {
  const [source, hourly] = await Promise.all([
    readFile(new URL("../../../7tool-source/scripts/refresh-feed.mts", import.meta.url), "utf8"),
    readFile(new URL("../../../7tool-source/scripts/hourly-refresh.sh", import.meta.url), "utf8"),
  ]);
  const catalogRename = source.indexOf("fs.renameSync(tmpPath, JSON_PATH)");
  const metadataRename = source.indexOf("fs.renameSync(snapshotMetaPath, SNAPSHOT_META_PATH)");
  assert.ok(catalogRename > 0);
  assert.ok(metadataRename > catalogRename);
  assert.match(source, /status:"complete"/u);
  assert.match(hourly, /catalog-snapshot-meta\.json/u);
});
