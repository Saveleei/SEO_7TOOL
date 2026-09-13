import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { GET as getDelivery, POST as postDelivery } from "../app/api/quote-requests/[id]/delivery/route.ts";
import { appendQuoteApprovalAction } from "../app/data/quoteApprovalStore.ts";
import { enqueueQuoteDeliveryPackage, getQuoteDeliveryWorkspace, validateQuoteDeliveryInput } from "../app/data/quoteDeliveryStore.ts";
import { saveQuoteDraft } from "../app/data/quoteDraftStore.ts";
import { QUOTE_APPROVAL_CHECKS } from "../app/data/quoteApprovalValidation.mjs";
import { saveQuoteRequest } from "../app/data/quoteRequestStore.ts";
import { validateQuoteRequest } from "../app/data/quoteRequestValidation.mjs";

const confirmations = { recipient:true, document:true, authority:true };
const admin = { id:"admin-1", email:"admin@example.test", name:"Администратор Тест", role:"admin", roleLabel:"Администратор", source:"platform" };

test("server builds the delivery package only from the prepared approved revision", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "7tool-delivery-package-"));
  try {
    const request = await prepareApprovedRequest(dataDir, "701");
    const workspace = await getQuoteDeliveryWorkspace(request.id, 1, { dataDir });
    assert.equal(workspace.package.channel, "email");
    assert.equal(workspace.package.recipient, "client@example.test");
    assert.equal(workspace.package.pdfFileName, `КП-${request.id.slice(3)}-r1.pdf`);
    assert.match(workspace.package.subject, /редакция 1/u);
    assert.match(workspace.package.message, new RegExp(request.id, "u"));
    assert.match(workspace.package.message, /НДС 22%/u);
    assert.match(workspace.package.message, /Евгений Савельев/u);
    assert.match(workspace.package.packageFingerprint, /^[0-9a-f]{64}$/u);
    assert.equal(workspace.outbox, null);
    await assert.rejects(() => getQuoteDeliveryWorkspace(request.id, 2, { dataDir }), /не найдена/u);
  } finally {
    await rm(dataDir, { recursive:true, force:true });
  }
});

test("outbox requires all confirmations and stores one held record per approved package", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "7tool-delivery-outbox-"));
  try {
    const request = await prepareApprovedRequest(dataDir, "711");
    assert.equal(validateQuoteDeliveryInput({ idempotencyKey:uuid("715"), confirmations:{ ...confirmations, document:false } }).ok, false);
    assert.equal(validateQuoteDeliveryInput({ idempotencyKey:"not-a-uuid", confirmations }).ok, false);
    const first = await enqueueQuoteDeliveryPackage(request.id, 1, { idempotencyKey:uuid("715"), confirmations }, admin, { dataDir, now:"2026-09-13T10:00:00.000Z" });
    assert.equal(first.duplicate, false);
    assert.equal(first.workspace.outbox.status, "held");
    assert.equal(first.workspace.outbox.transport, "disabled-test-contour");
    assert.equal(first.workspace.outbox.deliveryEnabled, false);
    assert.equal(first.workspace.outbox.attempts, 0);
    assert.equal(first.workspace.outbox.queuedBy.name, admin.name);
    const duplicate = await enqueueQuoteDeliveryPackage(request.id, 1, { idempotencyKey:uuid("716"), confirmations }, admin, { dataDir });
    assert.equal(duplicate.duplicate, true);
    assert.equal(duplicate.workspace.outbox.id, first.workspace.outbox.id);
    const log = await readFile(path.join(dataDir, "quote-delivery-outbox.jsonl"), "utf8");
    assert.equal(log.trim().split("\n").length, 1);
    assert.doesNotMatch(JSON.stringify(first), /idempotencyHash/u);
  } finally {
    await rm(dataDir, { recursive:true, force:true });
  }
});

test("delivery API is admin-only, same-origin and ignores spoofed recipient content", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "7tool-delivery-api-"));
  const previous = snapshotEnv(["QUOTE_TEST_MODE", "QUOTE_TEST_DATA_DIR", "MANAGER_AUTH_ADMIN_EMAILS", "MANAGER_AUTH_MANAGER_EMAILS"]);
  try {
    process.env.QUOTE_TEST_MODE = "1";
    process.env.QUOTE_TEST_DATA_DIR = dataDir;
    process.env.MANAGER_AUTH_ADMIN_EMAILS = "admin@example.test";
    process.env.MANAGER_AUTH_MANAGER_EMAILS = "manager@example.test";
    const quoteRequest = await prepareApprovedRequest(dataDir, "721");
    const context = { params:Promise.resolve({ id:quoteRequest.id }) };
    const anonymous = await getDelivery(new Request(`http://local.test/api/quote-requests/${quoteRequest.id}/delivery?revision=1`), context);
    assert.equal(anonymous.status, 401);
    const manager = await getDelivery(new Request(`http://local.test/api/quote-requests/${quoteRequest.id}/delivery?revision=1`, { headers:staffHeaders("manager@example.test") }), context);
    assert.equal(manager.status, 403);
    const crossOrigin = await postDelivery(deliveryRequest(quoteRequest.id, { revision:1, idempotencyKey:uuid("725"), confirmations }, "https://attacker.example"), context);
    assert.equal(crossOrigin.status, 403);
    const response = await postDelivery(deliveryRequest(quoteRequest.id, { revision:1, idempotencyKey:uuid("726"), confirmations, recipient:"attacker@example.test", subject:"Подменённая тема", message:"Подменённый текст" }), context);
    assert.equal(response.status, 201);
    const result = await response.json();
    assert.equal(result.workspace.package.recipient, "client@example.test");
    assert.doesNotMatch(JSON.stringify(result), /attacker|Подменён/u);
    const stored = await readFile(path.join(dataDir, "quote-delivery-outbox.jsonl"), "utf8");
    assert.doesNotMatch(stored, /attacker|Подменён/u);
  } finally {
    restoreEnv(previous);
    await rm(dataDir, { recursive:true, force:true });
  }
});

test("delivery UI is explicit about the held state and contains no external transport", async () => {
  const store = await readFile(new URL("../app/data/quoteDeliveryStore.ts", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/api/quote-requests/[id]/delivery/route.ts", import.meta.url), "utf8");
  const panel = await readFile(new URL("../app/ui/DeliveryOutboxPanel.tsx", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/test/requests/[id]/quote/page.tsx", import.meta.url), "utf8");
  assert.match(panel, /Это не отправка/u);
  assert.match(panel, /Удерживается внутри системы/u);
  assert.match(panel, /Получатель и канал связи сверены/u);
  assert.match(panel, /Проверить документ/u);
  assert.match(page, /DeliveryOutboxPanel/u);
  assert.match(page, /Пакет этой редакции заблокирован/u);
  assert.match(route, /authorizeManagerRequest\(request, "delivery:prepare"\)/u);
  assert.doesNotMatch(`${store}\n${route}`, /sendMail|smtp|axios|fetch\(|telegram\.org|api\.max|crm\./iu);
  assert.match(panel, /fetch\(`\/api\/quote-requests\//u);
  assert.doesNotMatch(panel, /recipient:deliveryPackage|subject:deliveryPackage|message:deliveryPackage/u);
});

async function prepareApprovedRequest(dataDir, suffix) {
  const validation = validateQuoteRequest({ email:"client@example.test", phone:"+7 900 000-22-33", company:"Тестовый завод", city:"Тула", comment:"", billingInn:"", idempotencyKey:uuid(suffix), website:"", consent:"on", alternatives:"on", checkAvailability:"on", checkSet:"on", checkDocs:"on", source:{ pagePath:"/search", utmSource:"", utmMedium:"", utmCampaign:"" }, items:[{ id:"variant:A9409", title:"Магнитный станок", article:"STEYR-35", quantity:1, price:"47 999 ₽" }] });
  assert.equal(validation.ok, true);
  const request = await saveQuoteRequest(validation.value, null, { dataDir });
  await saveQuoteDraft(request.id, readyQuote(uuid(String(Number(suffix) + 1).padStart(3, "0"))), { dataDir, now:"2026-09-13T07:00:00.000Z" });
  const checks = Object.fromEntries(QUOTE_APPROVAL_CHECKS.map((key) => [key, true]));
  await appendQuoteApprovalAction(request.id, 1, approvalAction("submitted", uuid(String(Number(suffix) + 2).padStart(3, "0")), { checks }), { dataDir });
  await appendQuoteApprovalAction(request.id, 1, approvalAction("approved", uuid(String(Number(suffix) + 3).padStart(3, "0")), { note:"Проверено" }), { dataDir });
  await appendQuoteApprovalAction(request.id, 1, approvalAction("delivery_prepared", uuid(String(Number(suffix) + 4).padStart(3, "0")), { channel:"email", recipient:"client@example.test" }), { dataDir });
  return request;
}

function readyQuote(idempotencyKey) {
  return { idempotencyKey, status:"ready", validityDays:10, vatRate:22, paymentTerms:"Оплата по счёту", deliveryTerms:"Доставка рассчитывается отдельно", managerComment:"", sender:{ name:"Евгений Савельев", role:"Персональный менеджер 7TOOL", phone:"+7 (962) 611-24-19", email:"info@7tool.ru" }, items:[{ id:"variant:A9409", title:"Магнитный станок", article:"STEYR-35", quantity:1, price:"47 999 ₽", unitPriceRub:47999, discountPercent:0, supplyStatus:"supplier_confirmed", shipmentText:"Отгрузка в течение 5 рабочих дней" }] };
}

function approvalAction(type, idempotencyKey, extra = {}) {
  return { type, idempotencyKey, actorName:"Администратор Тест", actorRole:"Администратор", ...extra };
}

function deliveryRequest(requestId, body, origin = "http://local.test") {
  return new Request(`http://local.test/api/quote-requests/${requestId}/delivery`, { method:"POST", headers:{ ...staffHeaders("admin@example.test", origin), "content-type":"application/json" }, body:JSON.stringify(body) });
}

function staffHeaders(email, origin = "http://local.test") {
  return { origin, "oai-authenticated-user-id":email.split("@")[0], "oai-authenticated-user-email":email, "oai-authenticated-user-full-name":"%D0%90%D0%B4%D0%BC%D0%B8%D0%BD%D0%B8%D1%81%D1%82%D1%80%D0%B0%D1%82%D0%BE%D1%80%20%D0%A2%D0%B5%D1%81%D1%82", "oai-authenticated-user-full-name-encoding":"percent-encoded-utf-8" };
}

function snapshotEnv(keys) {
  return Object.fromEntries(keys.map((key) => [key, process.env[key]]));
}

function restoreEnv(values) {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
}

function uuid(suffix) {
  return `123e4567-e89b-42d3-a456-426614174${suffix}`;
}
