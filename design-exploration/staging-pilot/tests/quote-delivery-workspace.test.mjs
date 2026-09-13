import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { appendQuoteApprovalAction } from "../app/data/quoteApprovalStore.ts";
import { enqueueQuoteDeliveryPackage, filterQuoteDeliveryJournal, listQuoteDeliveryJournal, normalizeJournalChannel, normalizeJournalSearch } from "../app/data/quoteDeliveryStore.ts";
import { saveQuoteDraft } from "../app/data/quoteDraftStore.ts";
import { QUOTE_APPROVAL_CHECKS } from "../app/data/quoteApprovalValidation.mjs";
import { saveQuoteRequest } from "../app/data/quoteRequestStore.ts";
import { validateQuoteRequest } from "../app/data/quoteRequestValidation.mjs";

const admin = { id:"admin-1", email:"admin@example.test", name:"Администратор Тест", role:"admin", roleLabel:"Администратор", source:"platform" };
const confirmations = { recipient:true, document:true, authority:true };

test("delivery journal enriches immutable outbox records and sorts newest first", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "7tool-delivery-journal-"));
  try {
    const emailRequest = await preparePackage(dataDir, { suffix:801, company:"Тестовый завод", city:"Тула", channel:"email", recipient:"client@example.test", queuedAt:"2026-09-13T08:00:00.000Z" });
    const telegramRequest = await preparePackage(dataDir, { suffix:811, company:"Завод Салют", city:"Казань", channel:"telegram", recipient:"@buyer_team", queuedAt:"2026-09-13T09:00:00.000Z" });
    const entries = await listQuoteDeliveryJournal({ dataDir });
    assert.equal(entries.length, 2);
    assert.equal(entries[0].requestId, telegramRequest.id);
    assert.equal(entries[1].requestId, emailRequest.id);
    assert.equal(entries[0].company, "Завод Салют");
    assert.equal(entries[0].city, "Казань");
    assert.equal(entries[0].totalRub, 47999);
    assert.equal(entries[0].itemCount, 1);
    assert.equal(entries[0].status, "held");
    assert.equal(entries[0].deliveryEnabled, false);
  } finally {
    await rm(dataDir, { recursive:true, force:true });
  }
});

test("journal search and channel filters stay bounded and use canonical fields", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "7tool-delivery-filter-"));
  try {
    await preparePackage(dataDir, { suffix:821, company:"Тестовый завод", city:"Тула", channel:"email", recipient:"client@example.test", queuedAt:"2026-09-13T08:00:00.000Z" });
    await preparePackage(dataDir, { suffix:831, company:"Завод Салют", city:"Казань", channel:"telegram", recipient:"@buyer_team", queuedAt:"2026-09-13T09:00:00.000Z" });
    const entries = await listQuoteDeliveryJournal({ dataDir });
    assert.equal(filterQuoteDeliveryJournal(entries, { q:"салют", channel:"all" }).entries.length, 1);
    assert.equal(filterQuoteDeliveryJournal(entries, { q:"CLIENT@EXAMPLE.TEST", channel:"all" }).entries[0].channel, "email");
    assert.equal(filterQuoteDeliveryJournal(entries, { q:"", channel:"telegram" }).entries[0].recipient, "@buyer_team");
    assert.equal(filterQuoteDeliveryJournal(entries, { q:"не найдено", channel:"email" }).entries.length, 0);
    assert.equal(normalizeJournalChannel("javascript:alert(1)"), "all");
    assert.equal(normalizeJournalSearch("  КП\n\t тест  "), "КП тест");
    assert.equal(normalizeJournalSearch("x".repeat(200)).length, 100);
  } finally {
    await rm(dataDir, { recursive:true, force:true });
  }
});

test("administrator workspace is protected, honest and reachable from staff navigation", async () => {
  const page = await readFile(new URL("../app/test/delivery/page.tsx", import.meta.url), "utf8");
  const header = await readFile(new URL("../app/ui/PilotHeader.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const authIndex = page.indexOf("await requireManagerPageAccess");
  const listIndex = page.indexOf("await listQuoteDeliveryJournal");
  assert.ok(authIndex >= 0 && listIndex > authIndex, "authorization must happen before outbox data is read");
  assert.match(page, /requireManagerPageAccess\("delivery:prepare"/u);
  assert.match(page, /Удерживается · не отправлено/u);
  assert.match(page, /ни одна запись ниже не означает фактическую отправку/u);
  assert.match(page, /name="q"/u);
  assert.match(page, /name="channel"/u);
  assert.match(header, /href="\/test\/delivery"/u);
  assert.match(header, /canManager\(managerActor, "delivery:prepare"\)/u);
  assert.match(css, /@media \(max-width:760px\)[\s\S]*quote-delivery-journal-list/u);
  assert.doesNotMatch(`${page}\n${header}`, /sendMail|smtp|axios|fetch\(|telegram\.org|api\.max|crm\./iu);
});

async function preparePackage(dataDir, { suffix, company, city, channel, recipient, queuedAt }) {
  const requestValidation = validateQuoteRequest({ email:"client@example.test", phone:"+7 900 000-22-33", company, city, comment:"", billingInn:"", idempotencyKey:uuid(suffix), website:"", consent:true, alternatives:true, checkAvailability:true, checkSet:true, checkDocs:true, source:{ pagePath:"/search", utmSource:"", utmMedium:"", utmCampaign:"" }, items:[{ id:"variant:A9409", title:"Магнитный станок", article:"STEYR-35", quantity:1, price:"47 999 ₽" }] });
  assert.equal(requestValidation.ok, true);
  const request = await saveQuoteRequest(requestValidation.value, null, { dataDir });
  await saveQuoteDraft(request.id, readyQuote(uuid(suffix + 1)), { dataDir, now:"2026-09-13T07:00:00.000Z" });
  const checks = Object.fromEntries(QUOTE_APPROVAL_CHECKS.map((key) => [key, true]));
  await appendQuoteApprovalAction(request.id, 1, approval("submitted", uuid(suffix + 2), { checks }), { dataDir });
  await appendQuoteApprovalAction(request.id, 1, approval("approved", uuid(suffix + 3), { note:"Проверено" }), { dataDir });
  await appendQuoteApprovalAction(request.id, 1, approval("delivery_prepared", uuid(suffix + 4), { channel, recipient }), { dataDir });
  await enqueueQuoteDeliveryPackage(request.id, 1, { idempotencyKey:uuid(suffix + 5), confirmations }, admin, { dataDir, now:queuedAt });
  return request;
}

function readyQuote(idempotencyKey) {
  return { idempotencyKey, status:"ready", validityDays:10, vatRate:22, paymentTerms:"Оплата по счёту", deliveryTerms:"Доставка рассчитывается отдельно", managerComment:"", sender:{ name:"Евгений Савельев", role:"Персональный менеджер 7TOOL", phone:"+7 (962) 611-24-19", email:"info@7tool.ru" }, items:[{ id:"variant:A9409", title:"Магнитный станок", article:"STEYR-35", quantity:1, price:"47 999 ₽", unitPriceRub:47999, discountPercent:0, supplyStatus:"supplier_confirmed", shipmentText:"Отгрузка в течение 5 рабочих дней" }] };
}

function approval(type, idempotencyKey, extra = {}) {
  return { type, idempotencyKey, actorName:"Администратор Тест", actorRole:"Администратор", ...extra };
}

function uuid(suffix) {
  return `123e4567-e89b-42d3-a456-426614174${String(suffix).padStart(3, "0")}`;
}
