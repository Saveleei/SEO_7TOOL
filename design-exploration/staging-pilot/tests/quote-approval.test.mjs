import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { appendQuoteApprovalAction, fingerprintQuote, getQuoteApprovalState } from "../app/data/quoteApprovalStore.ts";
import { getQuoteDraftRevision, saveQuoteDraft } from "../app/data/quoteDraftStore.ts";
import { QUOTE_APPROVAL_CHECKS, validateQuoteApprovalAction } from "../app/data/quoteApprovalValidation.mjs";
import { saveQuoteRequest } from "../app/data/quoteRequestStore.ts";
import { validateQuoteRequest } from "../app/data/quoteRequestValidation.mjs";

const item = { id:"variant:A9409", title:"Магнитный станок", article:"STEYR-35", quantity:1, price:"47 999 ₽" };
const quote = {
  idempotencyKey:"123e4567-e89b-42d3-a456-426614174201",
  status:"ready",
  validityDays:10,
  vatRate:22,
  paymentTerms:"Оплата по счёту",
  deliveryTerms:"Доставка рассчитывается отдельно",
  managerComment:"Комплектность сверена.",
  sender:{ name:"Евгений Савельев", role:"Менеджер проектов", phone:"+7 (962) 611-24-19", email:"info@7tool.ru" },
  items:[{ ...item, unitPriceRub:47999, discountPercent:0, supplyStatus:"supplier_confirmed", shipmentText:"Отгрузка в течение 5 рабочих дней" }],
};
const allChecks = Object.fromEntries(QUOTE_APPROVAL_CHECKS.map((key) => [key, true]));

test("approval workflow fixes one ready quote revision and appends every decision", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "7tool-quote-approval-"));
  try {
    const request = await createRequest(dataDir);
    const saved = await saveQuoteDraft(request.id, quote, { dataDir, now:"2026-09-12T09:00:00.000Z" });
    const initial = await getQuoteApprovalState(request.id, 1, { dataDir });
    assert.equal(initial.stage, "not_submitted");
    assert.equal(initial.quoteFingerprint, fingerprintQuote(saved.draft));

    await assert.rejects(() => appendQuoteApprovalAction(request.id, 1, action("submitted", "301", { checks:{ ...allChecks, documents:false } }), { dataDir }), /Подтвердите все пункты/u);
    const submitted = await appendQuoteApprovalAction(request.id, 1, action("submitted", "302", { checks:allChecks }), { dataDir, now:"2026-09-12T09:10:00.000Z" });
    assert.equal(submitted.state.stage, "submitted");
    assert.deepEqual(Object.keys(submitted.event.checks).sort(), [...QUOTE_APPROVAL_CHECKS].sort());

    const duplicate = await appendQuoteApprovalAction(request.id, 1, action("submitted", "302", { checks:allChecks }), { dataDir, now:"2026-09-12T09:11:00.000Z" });
    assert.equal(duplicate.duplicate, true);
    assert.equal(duplicate.event.id, submitted.event.id);

    const approved = await appendQuoteApprovalAction(request.id, 1, action("approved", "303", { actorName:"Тестовый согласующий", actorRole:"Руководитель отдела", note:"Условия проверены" }), { dataDir, now:"2026-09-12T09:20:00.000Z" });
    assert.equal(approved.state.stage, "approved");
    const prepared = await appendQuoteApprovalAction(request.id, 1, action("delivery_prepared", "304", { channel:"email", recipient:"client@example.test" }), { dataDir, now:"2026-09-12T09:30:00.000Z" });
    assert.equal(prepared.state.stage, "delivery_prepared");
    assert.equal(prepared.event.deliveryFileName, `${saved.draft.id}-r1.pdf`);
    assert.equal(prepared.event.deliverySubject, `Коммерческое предложение ${saved.draft.id}, редакция 1`);

    const log = await readFile(path.join(dataDir, "quote-approval-events.jsonl"), "utf8");
    assert.equal(log.trim().split("\n").length, 3);
    assert.doesNotMatch(log, /123e4567-e89b-42d3-a456-42661417430[2-4]/u);
    assert.doesNotMatch(JSON.stringify(prepared.state), /idempotencyHash/u);
  } finally {
    await rm(dataDir, { recursive:true, force:true });
  }
});

test("approval transitions reject skipped stages and unsafe recipients", () => {
  assert.equal(validateQuoteApprovalAction(action("approved", "311"), "not_submitted").ok, false);
  assert.equal(validateQuoteApprovalAction(action("delivery_prepared", "312", { channel:"email", recipient:"client@example.test" }), "submitted").ok, false);
  assert.equal(validateQuoteApprovalAction(action("changes_requested", "313", { note:"x" }), "submitted").ok, false);
  assert.equal(validateQuoteApprovalAction(action("delivery_prepared", "314", { channel:"max", recipient:"javascript:alert(1)" }), "approved").ok, false);
  assert.equal(validateQuoteApprovalAction(action("delivery_prepared", "315", { channel:"telegram", recipient:"@buyer_team" }), "approved").ok, true);
});

test("an approved historical revision stays addressable after a new draft is saved", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "7tool-quote-version-"));
  try {
    const request = await createRequest(dataDir, "211");
    const first = await saveQuoteDraft(request.id, { ...quote, idempotencyKey:uuid("212") }, { dataDir });
    await appendQuoteApprovalAction(request.id, 1, action("submitted", "316", { checks:allChecks }), { dataDir });
    await appendQuoteApprovalAction(request.id, 1, action("approved", "317", { actorName:"Тестовый согласующий", actorRole:"Руководитель отдела" }), { dataDir });
    const second = await saveQuoteDraft(request.id, { ...quote, idempotencyKey:uuid("213"), status:"draft", managerComment:"Изменённые условия" }, { dataDir });
    assert.equal(second.draft.revision, 2);
    const historical = await getQuoteDraftRevision(request.id, 1, { dataDir });
    const historicalApproval = await getQuoteApprovalState(request.id, 1, { dataDir });
    const newApproval = await getQuoteApprovalState(request.id, 2, { dataDir });
    assert.equal(historical.managerComment, first.draft.managerComment);
    assert.equal(historicalApproval.stage, "approved");
    assert.equal(historicalApproval.quoteFingerprint, fingerprintQuote(first.draft));
    assert.equal(newApproval.stage, "not_submitted");
    assert.notEqual(fingerprintQuote(second.draft), historicalApproval.quoteFingerprint);
  } finally {
    await rm(dataDir, { recursive:true, force:true });
  }
});

test("approval API and UI prepare delivery without external sending", async () => {
  const api = await readFile(new URL("../app/api/quote-requests/[id]/quote-approval/route.ts", import.meta.url), "utf8");
  const store = await readFile(new URL("../app/data/quoteApprovalStore.ts", import.meta.url), "utf8");
  const panel = await readFile(new URL("../app/ui/QuoteApprovalPanel.tsx", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/test/requests/[id]/quote/page.tsx", import.meta.url), "utf8");
  assert.match(api, /origin !== requestUrl\.origin/u);
  assert.match(store, /quote-approval-events\.jsonl/u);
  assert.match(panel, /Сайт ничего не отправит автоматически/u);
  assert.match(page, /getQuoteDraftRevision/u);
  assert.match(page, /revisionValue/u);
  assert.doesNotMatch(`${api}\n${store}\n${panel}`, /sendMail|smtp|fetch\(["']https|crm\./iu);
});

async function createRequest(dataDir, suffix = "201") {
  const validation = validateQuoteRequest({
    email:"client@example.test", phone:"+7 900 000-22-33", company:"Тестовый завод", city:"Тула", comment:"", billingInn:"", idempotencyKey:uuid(suffix), website:"", consent:"on", alternatives:"on", checkAvailability:"on", checkSet:"on", checkDocs:"on", source:{ pagePath:"/search", utmSource:"", utmMedium:"", utmCampaign:"" }, items:[item],
  });
  assert.equal(validation.ok, true);
  return saveQuoteRequest(validation.value, null, { dataDir });
}

function action(type, suffix, patch = {}) {
  return { idempotencyKey:uuid(suffix), type, actorName:"Евгений Савельев", actorRole:"Менеджер проектов", ...patch };
}

function uuid(suffix) {
  return `123e4567-e89b-42d3-a456-426614174${suffix}`;
}
