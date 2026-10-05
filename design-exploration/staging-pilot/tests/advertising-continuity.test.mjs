import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { proxyYandexAdvertisingFeed } from "../app/feeds/yandex-dynamic.xml/route.ts";
import { validateQuoteRequest } from "../app/data/quoteRequestValidation.mjs";
import { toProductionLeadPayload } from "../scripts/process-quote-intake-outbox.mjs";

test("the Yandex feed bridge forwards only a successful XML response from the fixed loopback service", async () => {
  let requestedUrl = "";
  const response = await proxyYandexAdvertisingFeed(async (url, init) => {
    requestedUrl = String(url);
    assert.equal(init?.redirect, "error");
    return new Response("<?xml version=\"1.0\"?><yml_catalog></yml_catalog>", { status:200, headers:{ "Content-Type":"application/xml", ETag:"feed-v1" } });
  });
  assert.equal(requestedUrl, "http://127.0.0.1:3108/feeds/yandex-dynamic.xml");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-robots-tag"), "noindex, follow");
  assert.equal(response.headers.get("etag"), "feed-v1");
  assert.match(await response.text(), /<yml_catalog>/u);

  const rejected = await proxyYandexAdvertisingFeed(async () => new Response("<html>not a feed</html>", { status:200, headers:{ "Content-Type":"text/html" } }));
  assert.equal(rejected.status, 503);
  assert.equal(rejected.headers.get("retry-after"), "300");
});

test("validated quote attribution keeps Yandex click identity but strips unsafe URLs", () => {
  const input = {
    requestType:"quick_order",
    email:"",
    phone:"+7 900 000-00-00",
    company:"",
    city:"",
    comment:"Проверить срок поставки",
    billingInn:"",
    idempotencyKey:"123e4567-e89b-42d3-a456-426614174000",
    website:"",
    consent:"on",
    alternatives:"on",
    checkAvailability:"on",
    checkSet:"on",
    checkDocs:"on",
    items:[{ id:"variant:A9409", title:"LENZ STEYR-35", article:"STEYR-35", quantity:1, href:"/p/magnitnyy-sverlilnyy-stanok-lenz-steyr-35" }],
    source:{
      pagePath:"/p/magnitnyy-sverlilnyy-stanok-lenz-steyr-35",
      pageUrl:"/p/magnitnyy-sverlilnyy-stanok-lenz-steyr-35?yclid=YCLID_123456&utm_source=yandex&unsafe=drop",
      landingPage:"https://attacker.example/steal",
      referrer:"https://yandex.ru/search/?text=secret",
      firstVisitAt:"2026-10-05T12:00:00.000Z",
      utmSource:"yandex",
      utmMedium:"cpc",
      utmCampaign:"brand",
      utmContent:"creative-1",
      utmTerm:"станок",
      yclid:"YCLID_123456",
      ymClientId:"1234567890",
      internalClientId:"123e4567-e89b-42d3-a456-426614174111",
      sessionId:"123e4567-e89b-42d3-a456-426614174222",
      firstTouch:{
        utm_source:"yandex",
        utm_medium:"cpc",
        utm_campaign:"brand",
        utm_content:"creative-1",
        utm_term:"станок",
        yclid:"YCLID_123456",
        landingPage:"/p/magnitnyy-sverlilnyy-stanok-lenz-steyr-35?yclid=YCLID_123456&utm_source=yandex&unsafe=drop",
        referrer:"https://yandex.ru/search/?text=secret",
        capturedAt:"2026-10-05T12:00:00.000Z",
      },
    },
  };
  const validation = validateQuoteRequest(input);
  assert.equal(validation.ok, true);
  assert.equal(validation.value.source.pageUrl, "/p/magnitnyy-sverlilnyy-stanok-lenz-steyr-35?utm_source=yandex&yclid=YCLID_123456");
  assert.equal(validation.value.source.landingPage, "");
  assert.equal(validation.value.source.referrer, "https://yandex.ru/search/");
  assert.equal(validation.value.source.firstTouch.landingPage.includes("unsafe="), false);

  const payload = toProductionLeadPayload({ ...validation.value, id:"7T-20261005-ABC123" });
  assert.equal(payload.pageUrl, "https://7tool.ru/p/magnitnyy-sverlilnyy-stanok-lenz-steyr-35?utm_source=yandex&yclid=YCLID_123456");
  assert.equal(payload.extra.attribution.yclid, "YCLID_123456");
  assert.equal(payload.extra.attribution.firstTouch.utm_content, "creative-1");
  assert.equal(payload.extra.attribution.firstTouch.referrer, "https://yandex.ru/search/");
});

test("every lead form uses the shared persisted attribution source", async () => {
  const files = ["ContactRequestDialog.tsx", "ProcurementWorkbench.tsx", "QuickOrderDialog.tsx", "RequestCart.tsx", "TestRequestForm.tsx"];
  for (const file of files) {
    const source = await readFile(new URL(`../app/ui/${file}`, import.meta.url), "utf8");
    assert.match(source, /buildRequestSource\(\)/u, file);
    assert.doesNotMatch(source, /query\.get\("utm_/u, file);
  }
});
