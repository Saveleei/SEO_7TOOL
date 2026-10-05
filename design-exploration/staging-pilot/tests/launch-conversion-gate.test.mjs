import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { appendQuoteApprovalAction } from "../app/data/quoteApprovalStore.ts";
import { QUOTE_APPROVAL_CHECKS } from "../app/data/quoteApprovalValidation.mjs";
import { enqueueQuoteDeliveryPackage } from "../app/data/quoteDeliveryStore.ts";
import { saveQuoteDraft } from "../app/data/quoteDraftStore.ts";
import { appendQuoteRequestEvent, getQuoteRequestDetail, listQuoteRequestSummaries } from "../app/data/quoteRequestStore.ts";
import { POST as createQuoteRequest } from "../app/api/quote-requests/route.ts";

const product = {
  id:"variant:A9409",
  title:"Магнитный сверлильный станок LENZ STEYR-35",
  article:"STEYR-35",
  quantity:1,
  price:"47 999 ₽",
  href:"/p/magnitnyy-sverlilnyy-stanok-lenz-steyr-35?variant=A9409",
};

const admin = {
  id:"launch-admin",
  email:"launch-admin@example.test",
  name:"Администратор запуска",
  role:"admin",
  roleLabel:"Администратор",
  source:"platform",
};

test("launch gate preserves an exact product from customer request to the held delivery package", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "7tool-launch-gate-"));
  const previous = snapshotEnv(["QUOTE_TEST_MODE", "QUOTE_TEST_DATA_DIR"]);
  try {
    process.env.QUOTE_TEST_MODE = "1";
    process.env.QUOTE_TEST_DATA_DIR = dataDir;

    const firstResponse = await createQuoteRequest(customerRequest("801", "127.0.0.81"));
    assert.equal(firstResponse.status, 201);
    const first = await firstResponse.json();
    assert.equal(first.ok, true);
    assert.match(first.requestNumber, /^7T-\d{8}-[A-F0-9]{6}$/u);
    assert.equal(first.delivery, "disabled-test-contour");

    const retryResponse = await createQuoteRequest(customerRequest("801", "127.0.0.82"));
    assert.equal(retryResponse.status, 200);
    const retry = await retryResponse.json();
    assert.equal(retry.duplicate, true);
    assert.equal(retry.requestNumber, first.requestNumber);

    await appendQuoteRequestEvent({
      requestId:first.requestNumber,
      idempotencyKey:uuid("802"),
      type:"assigned",
      assignee:"evgeny-savelev",
      actorId:admin.id,
      actorName:admin.name,
      actorRole:admin.role,
    }, { dataDir });
    await appendQuoteRequestEvent({
      requestId:first.requestNumber,
      idempotencyKey:uuid("803"),
      type:"status_changed",
      status:"checking",
      actorId:admin.id,
      actorName:admin.name,
      actorRole:admin.role,
    }, { dataDir });

    const detail = await getQuoteRequestDetail(first.requestNumber, { dataDir });
    assert.equal(detail?.status, "checking");
    assert.equal(detail?.assigneeName, "Евгений Савельев");
    assert.deepEqual(detail?.items, [product]);
    assert.equal(detail?.source.pagePath, product.href);
    assert.equal(detail?.source.utmSource, "launch-gate");

    const summaries = await listQuoteRequestSummaries(10, { dataDir });
    assert.equal(summaries.length, 1);
    assert.equal(summaries[0].id, first.requestNumber);
    assert.equal(summaries[0].itemCount, 1);
    assert.equal(summaries[0].totalQuantity, 1);

    const quote = await saveQuoteDraft(first.requestNumber, readyQuote(), { dataDir });
    assert.equal(quote.draft.items[0].id, product.id);
    assert.equal(quote.draft.items[0].article, product.article);
    const checks = Object.fromEntries(QUOTE_APPROVAL_CHECKS.map((key) => [key, true]));
    await appendQuoteApprovalAction(first.requestNumber, quote.draft.revision, approval("submitted", "805", { checks }), { dataDir });
    await appendQuoteApprovalAction(first.requestNumber, quote.draft.revision, approval("approved", "806", { note:"Контроль запуска пройден" }), { dataDir });
    await appendQuoteApprovalAction(first.requestNumber, quote.draft.revision, approval("delivery_prepared", "807", { channel:"email", recipient:"launch-buyer@example.test" }), { dataDir });

    const queued = await enqueueQuoteDeliveryPackage(first.requestNumber, quote.draft.revision, {
      idempotencyKey:uuid("808"),
      confirmations:{ recipient:true, document:true, authority:true },
    }, admin, { dataDir });
    assert.equal(queued.workspace.outbox.status, "held");
    assert.equal(queued.workspace.outbox.transport, "disabled-test-contour");
    assert.equal(queued.workspace.outbox.deliveryEnabled, false);
    assert.equal(queued.workspace.outbox.attempts, 0);
    assert.equal(queued.workspace.package.requestId, first.requestNumber);
    assert.match(queued.workspace.package.message, /Контрольный запуск 7TOOL/u);

    const requestLog = await readFile(path.join(dataDir, "requests.jsonl"), "utf8");
    const outboxLog = await readFile(path.join(dataDir, "quote-delivery-outbox.jsonl"), "utf8");
    assert.match(requestLog, new RegExp(product.href.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
    assert.doesNotMatch(`${requestLog}\n${outboxLog}`, /smtp|sendmail|api\.telegram|api\.max|crm\./iu);
  } finally {
    restoreEnv(previous);
    await rm(dataDir, { recursive:true, force:true });
  }
});

function customerRequest(suffix, forwardedFor) {
  const form = new FormData();
  form.set("request_type", "quote");
  form.set("email", "launch-buyer@example.test");
  form.set("phone", "+7 900 000-81-01");
  form.set("company", "Контрольный запуск 7TOOL");
  form.set("city", "Москва");
  form.set("comment", "Изолированная проверка сквозной заявки");
  form.set("billing_inn", "");
  form.set("idempotency_key", uuid(suffix));
  form.set("website", "");
  form.set("consent", "on");
  form.set("alternatives", "on");
  form.set("check_availability", "on");
  form.set("check_set", "on");
  form.set("check_docs", "on");
  form.set("items", JSON.stringify([product]));
  form.set("source", JSON.stringify({
    pagePath:product.href,
    utmSource:"launch-gate",
    utmMedium:"isolated",
    utmCampaign:"release-readiness",
  }));
  return new Request("http://local.test/api/quote-requests", {
    method:"POST",
    headers:{ origin:"http://local.test", "x-forwarded-for":forwardedFor },
    body:form,
  });
}

function readyQuote() {
  return {
    idempotencyKey:uuid("804"),
    status:"ready",
    validityDays:10,
    vatRate:22,
    paymentTerms:"Оплата по счёту",
    deliveryTerms:"Условия и срок подтвердит менеджер",
    managerComment:"Контрольный документ релиз-кандидата.",
    sender:{
      name:"Евгений Савельев",
      role:"Персональный менеджер 7TOOL",
      phone:"+7 (962) 611-24-19",
      email:"info@7tool.ru",
    },
    items:[{
      ...product,
      unitPriceRub:47999,
      discountPercent:0,
      supplyStatus:"supplier_confirmed",
      shipmentText:"Изолированный тест — наружу не отправляется",
    }],
  };
}

function approval(type, suffix, patch = {}) {
  return {
    type,
    idempotencyKey:uuid(suffix),
    actorName:admin.name,
    actorRole:admin.roleLabel,
    ...patch,
  };
}

function uuid(suffix) {
  return `123e4567-e89b-42d3-a456-426614174${suffix}`;
}

function snapshotEnv(keys) {
  return Object.fromEntries(keys.map((key) => [key, process.env[key]]));
}

function restoreEnv(values) {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
