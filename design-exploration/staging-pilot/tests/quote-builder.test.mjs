import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { readQuoteStampAsset, saveQuoteStampAsset } from "../app/data/quoteAssetStore.ts";
import { getLatestQuoteDraft, getQuoteDraftOrDefault, saveQuoteDraft } from "../app/data/quoteDraftStore.ts";
import { parsePriceRub, validateQuoteDraft } from "../app/data/quoteDraftValidation.mjs";
import { getQuoteProductPresentation } from "../app/data/quoteProductPresentation.ts";
import { saveQuoteRequest } from "../app/data/quoteRequestStore.ts";
import { validateQuoteRequest } from "../app/data/quoteRequestValidation.mjs";
import { DEFAULT_QUOTE_TEMPLATE_SETTINGS } from "../app/data/quoteTemplateStore.ts";

const requestItems = [{ id:"variant:A9409", title:"Магнитный станок", article:"STEYR-35", quantity:1, price:"47 999 ₽" }];
const readyDraft = {
  idempotencyKey:"123e4567-e89b-42d3-a456-426614174101",
  status:"ready",
  validityDays:10,
  vatRate:22,
  paymentTerms:"Оплата после согласования счёта",
  deliveryTerms:"Доставка рассчитывается отдельно",
  managerComment:"Комплектность указана в приложении.",
  sender:{ name:"Евгений Савельев", role:"Менеджер проектов", phone:"+7 (962) 611-24-19", email:"INFO@7TOOL.RU" },
  items:[{ id:"variant:A9409", title:"Подменённое название", article:"BAD", quantity:2, unitPriceRub:50000, discountPercent:5, supplyStatus:"supplier_confirmed", shipmentText:"Отгрузка в течение 5 рабочих дней", productPresentation:{ imageUrl:"https://attacker.example/fake.jpg" } }],
};

const onePixelPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");

test("quote draft calculates totals and keeps product identity from the saved request", () => {
  const result = validateQuoteDraft(readyDraft, requestItems);
  assert.equal(result.ok, true);
  assert.equal(result.value.items[0].title, "Магнитный станок");
  assert.equal(result.value.items[0].article, "STEYR-35");
  assert.equal(result.value.items[0].lineTotalRub, 95000);
  assert.equal(result.value.totalRub, 95000);
  assert.equal(result.value.vatIncludedRub, 17131.15);
  assert.equal(result.value.sender.role, "Менеджер проектов");
  assert.equal(result.value.sender.email, "info@7tool.ru");
  assert.equal(result.value.items[0].productPresentation, undefined);
});

test("quote product presentation is derived from the exact feed variant", () => {
  const presentation = getQuoteProductPresentation("variant:A9409");
  assert.equal(presentation.exactVariant, true);
  assert.equal(presentation.variantId, "A9409");
  assert.equal(presentation.category, "stanki-sverlilnye");
  assert.match(presentation.imageUrl, /^https:\/\/s3\.export\.k2tool\.ru\//u);
  assert.equal(presentation.keySpecs.some((spec) => /шпиндель/iu.test(spec.label) && spec.value === "Weldon 19"), true);
  assert.equal(presentation.keySpecs.some((spec) => /бренд/iu.test(spec.label)), false);
  assert.ok(presentation.technicalSpecs.length > presentation.keySpecs.length);
  assert.equal(getQuoteProductPresentation("variant:missing"), null);
});

test("a ready quote requires confirmed price, supply state and commercial terms", () => {
  assert.equal(validateQuoteDraft({ ...readyDraft, paymentTerms:"" }, requestItems).ok, false);
  assert.equal(validateQuoteDraft({ ...readyDraft, items:[{ ...readyDraft.items[0], unitPriceRub:0 }] }, requestItems).ok, false);
  assert.equal(validateQuoteDraft({ ...readyDraft, items:[{ ...readyDraft.items[0], supplyStatus:"unknown" }] }, requestItems).ok, false);
  assert.equal(validateQuoteDraft({ ...readyDraft, status:"draft", paymentTerms:"", deliveryTerms:"", items:[{ ...readyDraft.items[0], unitPriceRub:0, supplyStatus:"unknown" }] }, requestItems).ok, true);
  assert.equal(validateQuoteDraft({ ...readyDraft, vatRate:20 }, requestItems).ok, false);
  assert.equal(parsePriceRub("47 999 ₽"), 47999);
  assert.equal(validateQuoteDraft({ ...readyDraft, sender:{ ...readyDraft.sender, email:"invalid" } }, requestItems).ok, false);
});

test("quote revisions append durably and retries are idempotent", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "7tool-quote-builder-"));
  try {
    const requestValidation = validateQuoteRequest({
      email:"quote@example.test", phone:"+7 900 000-22-33", company:"Тестовый завод", city:"Тула", comment:"", billingInn:"", idempotencyKey:"123e4567-e89b-42d3-a456-426614174100", website:"", consent:"on", alternatives:"on", checkAvailability:"on", checkSet:"on", checkDocs:"on", source:{ pagePath:"/search", utmSource:"", utmMedium:"", utmCampaign:"" }, items:requestItems,
    });
    assert.equal(requestValidation.ok, true);
    const request = await saveQuoteRequest(requestValidation.value, null, { dataDir });
    const initial = await getQuoteDraftOrDefault(request.id, { dataDir });
    assert.equal(initial.revision, 0);
    assert.equal(initial.items[0].unitPriceRub, 47999);
    assert.equal(initial.vatRate, 22);
    assert.equal(initial.items[0].productPresentation.variantId, "A9409");

    const first = await saveQuoteDraft(request.id, readyDraft, { dataDir, now:"2026-09-12T12:00:00.000Z" });
    const retry = await saveQuoteDraft(request.id, readyDraft, { dataDir, now:"2026-09-12T12:01:00.000Z" });
    const second = await saveQuoteDraft(request.id, { ...readyDraft, idempotencyKey:"123e4567-e89b-42d3-a456-426614174102", status:"draft", managerComment:"Новая редакция" }, { dataDir, now:"2026-09-12T12:02:00.000Z" });
    assert.equal(first.draft.revision, 1);
    assert.equal(retry.duplicate, true);
    assert.equal(retry.draft.revision, 1);
    assert.equal(second.draft.revision, 2);
    assert.equal(first.draft.items[0].productPresentation.variantId, "A9409");
    assert.doesNotMatch(JSON.stringify(first.draft), /attacker\.example/u);
    assert.equal((await getLatestQuoteDraft(request.id, { dataDir })).managerComment, "Новая редакция");

    const requestLog = await readFile(path.join(dataDir, "requests.jsonl"), "utf8");
    const draftLog = await readFile(path.join(dataDir, "quote-drafts.jsonl"), "utf8");
    assert.doesNotMatch(requestLog, /Новая редакция/u);
    assert.match(draftLog, /Новая редакция/u);
    assert.doesNotMatch(draftLog, /123e4567-e89b-42d3-a456-426614174101/u);
    assert.doesNotMatch(draftLog, /"idempotencyKey"/u);
  } finally {
    await rm(dataDir, { recursive:true, force:true });
  }
});

test("saved historical quote revisions retain their snapshotted VAT rate", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "7tool-legacy-vat-"));
  try {
    const legacy = { id:"КП-20251231-LEGACY", requestId:"7T-20251231-LEGACY", revision:1, createdAt:"2025-12-31T12:00:00.000Z", status:"ready", validityDays:10, vatRate:20, paymentTerms:"Оплата по счёту", deliveryTerms:"Самовывоз", managerComment:"", sender:readyDraft.sender, stampAssetId:"", includeStamp:false, items:[], totalRub:95000, vatIncludedRub:15833.33, idempotencyHash:"legacy" };
    await writeFile(path.join(dataDir, "quote-drafts.jsonl"), `${JSON.stringify(legacy)}\n`, "utf8");
    const restored = await getLatestQuoteDraft(legacy.requestId, { dataDir });
    assert.equal(restored.seller.legalName, DEFAULT_QUOTE_TEMPLATE_SETTINGS.seller.legalName);
    assert.equal(restored.document.title, DEFAULT_QUOTE_TEMPLATE_SETTINGS.document.title);
    assert.equal(restored.vatRate, 20);
    assert.equal(restored.vatIncludedRub, 15833.33);
  } finally {
    await rm(dataDir, { recursive:true, force:true });
  }
});

test("stamp and signature assets are signature-checked and can be snapshotted into a quote", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "7tool-quote-assets-"));
  try {
    const requestValidation = validateQuoteRequest({
      email:"stamp@example.test", phone:"+7 900 000-44-55", company:"Тестовый завод", city:"Тула", comment:"", billingInn:"", idempotencyKey:"123e4567-e89b-42d3-a456-426614174120", website:"", consent:"on", alternatives:"on", checkAvailability:"on", checkSet:"on", checkDocs:"on", source:{ pagePath:"/search", utmSource:"", utmMedium:"", utmCampaign:"" }, items:requestItems,
    });
    assert.equal(requestValidation.ok, true);
    const request = await saveQuoteRequest(requestValidation.value, null, { dataDir });
    await assert.rejects(() => saveQuoteStampAsset(request.id, new File(["<svg></svg>"], "stamp.svg", { type:"image/png" }), { dataDir }), /PNG, JPG или WebP/u);
    const asset = await saveQuoteStampAsset(request.id, new File([onePixelPng], "approved.png", { type:"image/png" }), { dataDir });
    assert.match(asset.assetId, /^[0-9a-f]{64}\.png$/u);
    const restored = await readQuoteStampAsset(request.id, asset.assetId, { dataDir });
    assert.equal(restored.mime, "image/png");
    assert.equal(restored.bytes.equals(onePixelPng), true);
    const saved = await saveQuoteDraft(request.id, { ...readyDraft, idempotencyKey:"123e4567-e89b-42d3-a456-426614174121", stampAssetId:asset.assetId, includeStamp:true }, { dataDir });
    assert.equal(saved.draft.includeStamp, true);
    assert.equal(saved.draft.stampAssetId, asset.assetId);
    await assert.rejects(() => saveQuoteDraft(request.id, { ...readyDraft, idempotencyKey:"123e4567-e89b-42d3-a456-426614174122", stampAssetId:`${"0".repeat(64)}.png`, includeStamp:true }, { dataDir }), /не найден/u);
  } finally {
    await rm(dataDir, { recursive:true, force:true });
  }
});

test("quote API and preview contain no external send integration", async () => {
  const api = await readFile(new URL("../app/api/quote-requests/[id]/quote-draft/route.ts", import.meta.url), "utf8");
  const assetApi = await readFile(new URL("../app/api/quote-requests/[id]/quote-assets/route.ts", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/test/requests/[id]/quote/page.tsx", import.meta.url), "utf8");
  const printButton = await readFile(new URL("../app/ui/QuotePrintButton.tsx", import.meta.url), "utf8");
  assert.match(api, /isQuoteTestModeEnabled\(\)/u);
  assert.match(api, /isSameOriginRequest\(request\)/u);
  assert.match(printButton, /Печать \/ сохранить PDF/u);
  assert.match(assetApi, /saveQuoteStampAsset/u);
  assert.doesNotMatch(`${api}\n${assetApi}\n${page}\n${printButton}`, /sendMail|fetch\(["']https|smtp|crm\./iu);
});
