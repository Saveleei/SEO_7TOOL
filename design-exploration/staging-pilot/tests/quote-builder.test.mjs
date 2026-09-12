import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { getLatestQuoteDraft, getQuoteDraftOrDefault, saveQuoteDraft } from "../app/data/quoteDraftStore.ts";
import { parsePriceRub, validateQuoteDraft } from "../app/data/quoteDraftValidation.mjs";
import { saveQuoteRequest } from "../app/data/quoteRequestStore.ts";
import { validateQuoteRequest } from "../app/data/quoteRequestValidation.mjs";

const requestItems = [{ id:"variant:A9409", title:"Магнитный станок", article:"STEYR-35", quantity:1, price:"47 999 ₽" }];
const readyDraft = {
  idempotencyKey:"123e4567-e89b-42d3-a456-426614174101",
  status:"ready",
  validityDays:10,
  vatRate:20,
  paymentTerms:"Оплата после согласования счёта",
  deliveryTerms:"Доставка рассчитывается отдельно",
  managerComment:"Комплектность указана в приложении.",
  items:[{ id:"variant:A9409", title:"Подменённое название", article:"BAD", quantity:2, unitPriceRub:50000, discountPercent:5, supplyStatus:"supplier_confirmed", shipmentText:"Отгрузка в течение 5 рабочих дней" }],
};

test("quote draft calculates totals and keeps product identity from the saved request", () => {
  const result = validateQuoteDraft(readyDraft, requestItems);
  assert.equal(result.ok, true);
  assert.equal(result.value.items[0].title, "Магнитный станок");
  assert.equal(result.value.items[0].article, "STEYR-35");
  assert.equal(result.value.items[0].lineTotalRub, 95000);
  assert.equal(result.value.totalRub, 95000);
  assert.equal(result.value.vatIncludedRub, 15833.33);
});

test("a ready quote requires confirmed price, supply state and commercial terms", () => {
  assert.equal(validateQuoteDraft({ ...readyDraft, paymentTerms:"" }, requestItems).ok, false);
  assert.equal(validateQuoteDraft({ ...readyDraft, items:[{ ...readyDraft.items[0], unitPriceRub:0 }] }, requestItems).ok, false);
  assert.equal(validateQuoteDraft({ ...readyDraft, items:[{ ...readyDraft.items[0], supplyStatus:"unknown" }] }, requestItems).ok, false);
  assert.equal(validateQuoteDraft({ ...readyDraft, status:"draft", paymentTerms:"", deliveryTerms:"", items:[{ ...readyDraft.items[0], unitPriceRub:0, supplyStatus:"unknown" }] }, requestItems).ok, true);
  assert.equal(parsePriceRub("47 999 ₽"), 47999);
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

    const first = await saveQuoteDraft(request.id, readyDraft, { dataDir, now:"2026-09-12T12:00:00.000Z" });
    const retry = await saveQuoteDraft(request.id, readyDraft, { dataDir, now:"2026-09-12T12:01:00.000Z" });
    const second = await saveQuoteDraft(request.id, { ...readyDraft, idempotencyKey:"123e4567-e89b-42d3-a456-426614174102", status:"draft", managerComment:"Новая редакция" }, { dataDir, now:"2026-09-12T12:02:00.000Z" });
    assert.equal(first.draft.revision, 1);
    assert.equal(retry.duplicate, true);
    assert.equal(retry.draft.revision, 1);
    assert.equal(second.draft.revision, 2);
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

test("quote API and preview contain no external send integration", async () => {
  const api = await readFile(new URL("../app/api/quote-requests/[id]/quote-draft/route.ts", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/test/requests/[id]/quote/page.tsx", import.meta.url), "utf8");
  const printButton = await readFile(new URL("../app/ui/QuotePrintButton.tsx", import.meta.url), "utf8");
  assert.match(api, /isQuoteTestModeEnabled\(\)/u);
  assert.match(api, /origin !== requestUrl\.origin/u);
  assert.match(printButton, /Печать \/ сохранить PDF/u);
  assert.doesNotMatch(`${api}\n${page}\n${printButton}`, /sendMail|fetch\(["']https|smtp|crm\./iu);
});
