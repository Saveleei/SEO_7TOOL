import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import { GET as downloadQuotePdf } from "../app/api/quote-requests/[id]/quote-pdf/route.ts";
import { appendQuoteApprovalAction } from "../app/data/quoteApprovalStore.ts";
import { getQuoteDraftRevision, listQuoteDrafts, saveQuoteDraft } from "../app/data/quoteDraftStore.ts";
import { generateQuotePdf, loadSafeProductImage } from "../app/data/quotePdf.ts";
import { saveQuoteRequest } from "../app/data/quoteRequestStore.ts";
import { validateQuoteRequest } from "../app/data/quoteRequestValidation.mjs";
import { DEFAULT_QUOTE_TEMPLATE_SETTINGS } from "../app/data/quoteTemplateStore.ts";

const onePixelPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
const requestItem = { id:"variant:missing-pdf-test", title:"Магнитный сверлильный станок LENZ STEYR-35", article:"STEYR-35", quantity:1, price:"47 999 ₽" };
const readyQuote = {
  idempotencyKey:uuid("401"),
  status:"ready",
  validityDays:10,
  vatRate:22,
  paymentTerms:"Оплата по счёту после согласования",
  deliveryTerms:"Доставка до Тулы рассчитывается отдельно",
  managerComment:"Комплектность сверена.",
  sender:{ name:"Евгений Савельев", role:"Персональный менеджер 7TOOL", phone:"+7 (962) 611-24-19", email:"info@7tool.ru" },
  items:[{ ...requestItem, unitPriceRub:47999, discountPercent:0, supplyStatus:"supplier_confirmed", shipmentText:"Отгрузка в течение 5 рабочих дней" }],
};
const checks = { product_identity:true, price_and_discount:true, supply_and_timing:true, payment_and_delivery:true, vat_and_total:true, recipient:true, documents:true };

test("PDF generator creates a readable multi-page A4 document with embedded Cyrillic fonts", async () => {
  const quote = await fixtureQuote();
  quote.items[0].productPresentation = {
    exactVariant:true,
    variantId:"A9409",
    category:"stanki-sverlilnye",
    productHref:"/product/test?variant=A9409",
    imageUrl:"https://s3.export.k2tool.ru/test.png",
    imageAlt:"Магнитный станок",
    keySpecs:[{ label:"Шпиндель", value:"Weldon 19" }, { label:"Рабочий ход", value:"118 мм" }],
    technicalSpecs:Array.from({ length:24 }, (_, index) => ({ label:`Технический параметр ${index + 1}`, value:`Значение ${index + 1}` })),
  };
  const bytes = await generateQuotePdf({ quote, request:fixtureRequest(), approval:fixtureApproval(quote) }, { productImageLoader:async () => ({ bytes:onePixelPng, mime:"image/png" }) });
  assert.equal(Buffer.from(bytes).subarray(0, 5).toString("ascii"), "%PDF-");
  assert.ok(bytes.byteLength > 15_000);
  const document = await PDFDocument.load(bytes);
  assert.equal(document.getTitle(), `${quote.id}, редакция 1`);
  assert.equal(document.getSubject(), `${quote.document.title} на промышленное оборудование`);
  assert.ok(document.getPageCount() >= 2);
  document.getPages().forEach((page) => assert.deepEqual(page.getSize(), { width:595.28, height:841.89 }));
});

test("complete bank details share the first-page closing block with the signer", async () => {
  const quote = await fixtureQuote();
  quote.seller = {
    ...quote.seller,
    inn:"7700000000",
    kpp:"770001001",
    ogrn:"1027700000000",
    bankName:"АО Тестовый банк",
    bik:"044525000",
    checkingAccount:"40702810000000000000",
    correspondentAccount:"30101810000000000000",
  };
  quote.document = { ...quote.document, showBankDetails:true };
  quote.items[0].productPresentation = {
    exactVariant:true,
    variantId:"A9409",
    category:"stanki-sverlilnye",
    productHref:"/product/test?variant=A9409",
    imageUrl:"",
    imageAlt:"Магнитный станок",
    keySpecs:[{ label:"Шпиндель", value:"Weldon 19" }],
    technicalSpecs:Array.from({ length:24 }, (_, index) => ({ label:`Технический параметр ${index + 1}`, value:`Значение ${index + 1}` })),
  };
  const bytes = await generateQuotePdf({ quote, request:fixtureRequest(), approval:fixtureApproval(quote) });
  const document = await PDFDocument.load(bytes);
  assert.equal(document.getPageCount(), 2);
});

test("product image loader accepts only bounded PNG/JPEG assets from the feed host", async () => {
  assert.equal(await loadSafeProductImage("http://s3.export.k2tool.ru/image.jpg"), null);
  assert.equal(await loadSafeProductImage("https://attacker.example/image.jpg"), null);
  assert.equal(await loadSafeProductImage("javascript:alert(1)"), null);
});

test("PDF endpoint requires approval and keeps the requested historical revision", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "7tool-quote-pdf-"));
  const previousMode = process.env.QUOTE_TEST_MODE;
  const previousDataDir = process.env.QUOTE_TEST_DATA_DIR;
  const previousAdmins = process.env.MANAGER_AUTH_ADMIN_EMAILS;
  process.env.QUOTE_TEST_MODE = "1";
  process.env.QUOTE_TEST_DATA_DIR = dataDir;
  process.env.MANAGER_AUTH_ADMIN_EMAILS = "admin@example.test";
  try {
    const request = await createRequest(dataDir);
    const first = await saveQuoteDraft(request.id, readyQuote, { dataDir, now:"2026-09-12T09:00:00.000Z" });
    const blocked = await downloadQuotePdf(pdfRequest(request.id, 1), { params:Promise.resolve({ id:request.id }) });
    assert.equal(blocked.status, 409);

    await appendQuoteApprovalAction(request.id, 1, approvalAction("submitted", "402", { checks }), { dataDir, now:"2026-09-12T09:10:00.000Z" });
    await appendQuoteApprovalAction(request.id, 1, approvalAction("approved", "403", { actorName:"Тестовый согласующий", actorRole:"Руководитель отдела" }), { dataDir, now:"2026-09-12T09:20:00.000Z" });
    const second = await saveQuoteDraft(request.id, { ...readyQuote, idempotencyKey:uuid("404"), status:"draft", managerComment:"Новая редакция" }, { dataDir, now:"2026-09-12T09:30:00.000Z" });
    assert.equal(second.draft.revision, 2);
    assert.deepEqual((await listQuoteDrafts(request.id, { dataDir })).map((draft) => draft.revision), [2, 1]);

    const response = await downloadQuotePdf(pdfRequest(request.id, 1), { params:Promise.resolve({ id:request.id }) });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "application/pdf");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("x-quote-revision"), "1");
    assert.equal(response.headers.get("x-quote-fingerprint")?.length, 64);
    assert.match(response.headers.get("content-disposition") ?? "", /attachment; filename="7TOOL-/u);
    assert.match(response.headers.get("content-disposition") ?? "", /filename\*=UTF-8''/u);
    const pdf = await PDFDocument.load(await response.arrayBuffer());
    assert.equal(pdf.getTitle(), `${first.draft.id}, редакция 1`);

    const latestBlocked = await downloadQuotePdf(pdfRequest(request.id, 2), { params:Promise.resolve({ id:request.id }) });
    assert.equal(latestBlocked.status, 409);
    assert.equal((await getQuoteDraftRevision(request.id, 1, { dataDir })).managerComment, first.draft.managerComment);
  } finally {
    if (previousMode === undefined) delete process.env.QUOTE_TEST_MODE; else process.env.QUOTE_TEST_MODE = previousMode;
    if (previousDataDir === undefined) delete process.env.QUOTE_TEST_DATA_DIR; else process.env.QUOTE_TEST_DATA_DIR = previousDataDir;
    if (previousAdmins === undefined) delete process.env.MANAGER_AUTH_ADMIN_EMAILS; else process.env.MANAGER_AUTH_ADMIN_EMAILS = previousAdmins;
    await rm(dataDir, { recursive:true, force:true });
  }
});

test("manager revision UI exposes explicit preview and PDF routes without delivery code", async () => {
  const route = await readFile(new URL("../app/api/quote-requests/[id]/quote-pdf/route.ts", import.meta.url), "utf8");
  const register = await readFile(new URL("../app/ui/QuoteRevisionRegister.tsx", import.meta.url), "utf8");
  assert.match(route, /getQuoteDraftRevision\(requestId, revision\)/u);
  assert.match(route, /approved.*delivery_prepared/u);
  assert.match(register, /quote-pdf\?revision=\$\{entry\.revision\}/u);
  assert.match(register, /mode=preview&revision=\$\{entry\.revision\}/u);
  assert.doesNotMatch(`${route}\n${register}`, /sendMail|smtp|crm\.|click_messenger/iu);
});

async function fixtureQuote() {
  return {
    id:"КП-20260912-TEST01", requestId:"7T-20260912-TEST01", revision:1, createdAt:"2026-09-12T09:00:00.000Z", status:"ready", validityDays:10, vatRate:22, paymentTerms:readyQuote.paymentTerms, deliveryTerms:readyQuote.deliveryTerms, managerComment:readyQuote.managerComment, sender:readyQuote.sender, seller:{ ...DEFAULT_QUOTE_TEMPLATE_SETTINGS.seller }, document:{ ...DEFAULT_QUOTE_TEMPLATE_SETTINGS.document }, stampAssetId:"", includeStamp:false,
    items:[{ id:requestItem.id, title:requestItem.title, article:requestItem.article, quantity:1, unitPriceRub:47999, discountPercent:0, supplyStatus:"supplier_confirmed", shipmentText:"Отгрузка в течение 5 рабочих дней", lineTotalRub:47999, productPresentation:null }], totalRub:47999, vatIncludedRub:8655.56,
  };
}

function pdfRequest(requestId, revision) {
  return new Request(`http://local.test/api/quote-requests/${requestId}/quote-pdf?revision=${revision}`, { headers:{ "oai-authenticated-user-id":"admin-1", "oai-authenticated-user-email":"admin@example.test" } });
}

function fixtureRequest() {
  return { id:"7T-20260912-TEST01", createdAt:"2026-09-12T08:50:00.000Z", status:"checking", statusLabel:"Проверка", itemCount:1, totalQuantity:1, email:"cl***@example.test", phone:"+7 *** ***-2233", company:"Тестовый завод", city:"Тула", billingProvided:true, sourcePath:"/search", assignee:"evgeny-savelev", assigneeName:"Евгений Савельев", firstHandledAt:null, slaDueAt:"2026-09-12T09:20:00.000Z", slaBreached:false, emailFull:"client@example.test", phoneFull:"+7 900 000-22-33", comment:"", billingInn:"7100000000", consent:true, alternatives:true, requestedChecks:{ availability:true, compatibility:true, documents:true }, source:{ pagePath:"/search", utmSource:"", utmMedium:"", utmCampaign:"" }, items:[requestItem], attachment:null, events:[] };
}

function fixtureApproval(quote) {
  return { stage:"approved", revision:1, quoteFingerprint:"a".repeat(64), events:[{ id:"QA-TEST", requestId:quote.requestId, revision:1, quoteId:quote.id, quoteFingerprint:"a".repeat(64), createdAt:"2026-09-12T09:20:00.000Z", type:"approved", actorName:"Тестовый согласующий", actorRole:"Руководитель отдела" }] };
}

async function createRequest(dataDir) {
  const validation = validateQuoteRequest({ email:"client@example.test", phone:"+7 900 000-22-33", company:"Тестовый завод", city:"Тула", comment:"", billingInn:"", idempotencyKey:uuid("400"), website:"", consent:"on", alternatives:"on", checkAvailability:"on", checkSet:"on", checkDocs:"on", source:{ pagePath:"/search", utmSource:"", utmMedium:"", utmCampaign:"" }, items:[requestItem] });
  assert.equal(validation.ok, true);
  return saveQuoteRequest(validation.value, null, { dataDir });
}

function approvalAction(type, suffix, patch = {}) {
  return { idempotencyKey:uuid(suffix), type, actorName:"Евгений Савельев", actorRole:"Персональный менеджер 7TOOL", ...patch };
}

function uuid(suffix) {
  return `123e4567-e89b-42d3-a456-426614174${suffix}`;
}
