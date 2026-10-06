import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createYandexAdvertisingFeedResponse } from "../app/feeds/yandex-dynamic.xml/route.ts";
import { buildYandexAdvertisingFeed } from "../app/data/yandexAdvertisingFeed.ts";
import { validateQuoteRequest } from "../app/data/quoteRequestValidation.mjs";
import { auditYandexFeed } from "../scripts/audit-yandex-feed.mjs";
import { toProductionLeadPayload } from "../scripts/process-quote-intake-outbox.mjs";

test("the Yandex feed route serves only a fresh matching production snapshot", async () => {
  const snapshot = sampleCatalog();
  const request = new Request("https://7tool.ru/feeds/yandex-dynamic.xml");
  const response = createYandexAdvertisingFeedResponse(request, "GET", {
    snapshot,
    blockedProductIds:new Set(),
    completedAt:"2026-10-06T04:35:15.025Z",
    freshness:{ fresh:true, snapshotIdentityMatches:true },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-robots-tag"), "noindex, follow");
  assert.equal(response.headers.get("x-7tool-catalog-updated-at"), "2026-10-06T04:35:15.025Z");
  assert.match(response.headers.get("etag") || "", /^"[a-f0-9]{64}"$/u);
  assert.match(await response.text(), /<offer id="k2-A1" available="true">/u);

  const rejected = createYandexAdvertisingFeedResponse(request, "GET", {
    snapshot,
    blockedProductIds:new Set(),
    completedAt:"2026-10-06T04:35:15.025Z",
    freshness:{ fresh:false, snapshotIdentityMatches:true },
  });
  assert.equal(rejected.status, 503);
  assert.equal(rejected.headers.get("retry-after"), "300");
});

test("the generated Yandex feed is a complete canonical projection of advertisable variants", () => {
  const snapshot = sampleCatalog();
  snapshot.products[0].variants.push({ id:"A2", sku:"MD-2", name:"Магнитный станок MD-2", price:110_000, available:false, params:[], images:[] });
  const build = buildYandexAdvertisingFeed({ snapshot, generatedAt:"2026-10-06T04:35:15.025Z" });
  const report = auditYandexFeed({ xml:build.xml, snapshot });

  assert.equal(build.summary.advertisableVariantCount, 1);
  assert.equal(build.summary.excludedUnavailableCount, 1);
  assert.equal(report.status, "PASS");
  assert.equal(report.coverage.advertisableVariantCount, 1);
  assert.equal(report.counts.nonCanonicalUrls, 0);
  assert.match(build.xml, /<url>https:\/\/7tool\.ru\/p\/magnetic-drill--md-1<\/url>/u);
  assert.match(build.xml, /<picture>https:\/\/img\.example\/product\.jpg<\/picture>/u);
  assert.doesNotMatch(build.xml, /k2-A2/u);
});

test("the Yandex feed audit detects stale commercial facts and non-canonical landing URLs", () => {
  const snapshot = {
    categories:[{ slug:"drills", title:"Сверлильные станки", published:true }],
    products:[{
      id:"G1", slug:"magnetic-drill", title:"Магнитный станок", brand:"LENZ", sku:"", category:"drills", images:["https://img.example/product.jpg"], draft:false,
      variants:[{ id:"A1", sku:"MD-1", name:"Магнитный станок MD-1", price:100_000, available:true, params:[], images:[] }],
    }],
  };
  const xml = `<?xml version="1.0"?><yml_catalog><shop><categories><category id="10">Сверлильные станки</category></categories><offers>
    <offer id="k2-A1" available="false"><url>https://7tool.ru/p/magnetic-drill?variant=A1</url><price>99000</price><currencyId>RUR</currencyId><categoryId>10</categoryId><picture>https://img.example/product.jpg</picture><name>Магнитный станок MD-1</name><vendor>LENZ</vendor><vendorCode>MD-1</vendorCode><param name="Внутренний ID группы">G1</param><param name="ID варианта">A1</param></offer>
  </offers></shop></yml_catalog>`;
  const report = auditYandexFeed({ xml, snapshot });

  assert.equal(report.status, "FAIL");
  assert.equal(report.counts.price, 1);
  assert.equal(report.counts.availability, 1);
  assert.equal(report.counts.nonCanonicalUrls, 1);
  assert.equal(report.mismatches.nonCanonicalUrls[0].expected, "https://7tool.ru/p/magnetic-drill");
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

function sampleCatalog() {
  return {
    categories:[{ slug:"drills", title:"Сверлильные станки", count:1, published:true }],
    products:[{
      id:"G1", slug:"magnetic-drill", title:"Магнитный станок", brand:"LENZ", sku:"MD", category:"drills", images:["https://img.example/product.jpg"], stock:1, paramAxes:[], draft:false,
      variants:[{ id:"A1", sku:"MD-1", name:"Магнитный станок MD-1", price:100_000, quantity:1, available:true, params:[], images:[] }],
    }],
  };
}
