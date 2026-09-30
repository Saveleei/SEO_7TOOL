import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sanitizeConversionEvent } from "../app/data/conversionAnalytics.mjs";

test("conversion analytics keeps allowlisted funnel context and strips personal data", () => {
  const event = sanitizeConversionEvent({
    event:"quick_order_success",
    page_type:"product",
    placement:"product_buybox",
    product_id:"magnetic-drill-35",
    variant_id:"A-35",
    category:"stanki-sverlilnye",
    item_count:1,
    phone:"+7 900 000-00-00",
    email:"buyer@example.test",
    company:"Secret factory",
    comment:"Call me",
  });
  assert.deepEqual(event, {
    event:"quick_order_success",
    page_type:"product",
    placement:"product_buybox",
    product_id:"magnetic-drill-35",
    variant_id:"A-35",
    category:"stanki-sverlilnye",
    item_count:1,
  });
});

test("conversion analytics rejects unknown events and unsafe context", () => {
  assert.equal(sanitizeConversionEvent({ event:"send_contact_database", phone:"79990000000" }), null);
  assert.deepEqual(sanitizeConversionEvent({ event:"view_product", product_id:"../../private?token=x", page_type:"product" }), { event:"view_product", page_type:"product" });
});

test("category and product funnel entry points are wired globally", async () => {
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const filters = await readFile(new URL("../app/ui/AutoApplyFilters.tsx", import.meta.url), "utf8");
  const tracker = await readFile(new URL("../app/ui/ConversionAnalytics.tsx", import.meta.url), "utf8");
  assert.match(layout, /<ConversionAnalytics \/>/u);
  assert.match(tracker, /record\(resolvePageView\(window\.location\)\)/u);
  assert.match(tracker, /event:"view_category"/u);
  assert.match(tracker, /event:"view_product"/u);
  assert.match(filters, /event:"apply_filter"/u);
});
