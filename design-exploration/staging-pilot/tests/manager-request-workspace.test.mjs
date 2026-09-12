import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { appendQuoteRequestEvent, getQuoteRequestDetail, listQuoteRequestSummaries, QuoteWorkflowError, saveQuoteRequest } from "../app/data/quoteRequestStore.ts";
import { deriveWorkflow, validateManagerEvent } from "../app/data/quoteRequestWorkflow.mjs";
import { validateQuoteRequest } from "../app/data/quoteRequestValidation.mjs";

const validInput = {
  email:"manager-flow@example.test",
  phone:"+7 900 000-11-22",
  company:"Тестовое производство",
  city:"Тула",
  comment:"Проверить совместимость оснастки",
  billingInn:"7707083893",
  idempotencyKey:"123e4567-e89b-42d3-a456-426614174000",
  website:"",
  consent:"on",
  alternatives:"on",
  checkAvailability:"on",
  checkSet:"on",
  checkDocs:"on",
  source:{ pagePath:"/product/test", utmSource:"qa", utmMedium:"local", utmCampaign:"manager" },
  items:[{ id:"variant:manager", title:"LENZ STEYR-35", article:"STEYR-35", price:"47 999 ₽", quantity:2, href:"/product/test" }],
};

test("workflow accepts only deliberate neighbouring transitions and known assignee", () => {
  const base = { requestId:"7T-20260912-A1B2C3", idempotencyKey:"123e4567-e89b-42d3-a456-426614174001" };
  assert.equal(validateManagerEvent({ ...base, type:"status_changed", status:"checking" }, "received").ok, true);
  assert.equal(validateManagerEvent({ ...base, type:"status_changed", status:"sent" }, "received").ok, false);
  assert.equal(validateManagerEvent({ ...base, type:"status_changed", status:"received" }, "checking").ok, true);
  assert.equal(validateManagerEvent({ ...base, type:"status_changed", status:"checking" }, "quote_ready").ok, true);
  assert.equal(validateManagerEvent({ ...base, type:"status_changed", status:"quote_ready" }, "sent").ok, false);
  assert.equal(validateManagerEvent({ ...base, type:"assigned", assignee:"evgeny-savelev" }, "received").ok, true);
  assert.equal(validateManagerEvent({ ...base, type:"assigned", assignee:"unknown" }, "received").ok, false);
  assert.equal(validateManagerEvent({ ...base, type:"note_added", note:"  Проверить срок  " }, "received").value.note, "Проверить срок");
});

test("SLA is breached only until the first meaningful handling action", () => {
  const createdAt = "2026-09-12T07:00:00.000Z";
  const waiting = deriveWorkflow([], createdAt, { now:"2026-09-12T07:31:00.000Z", responseMinutes:30 });
  assert.equal(waiting.slaBreached, true);
  const assignedOnly = deriveWorkflow([{ type:"assigned", assignee:"evgeny-savelev", createdAt:"2026-09-12T07:05:00.000Z" }], createdAt, { now:"2026-09-12T07:31:00.000Z", responseMinutes:30 });
  assert.equal(assignedOnly.slaBreached, true);
  const handled = deriveWorkflow([{ type:"status_changed", status:"checking", createdAt:"2026-09-12T07:08:00.000Z" }], createdAt, { now:"2026-09-12T07:31:00.000Z", responseMinutes:30 });
  assert.equal(handled.slaBreached, false);
  assert.equal(handled.firstHandledAt, "2026-09-12T07:08:00.000Z");
});

test("manager actions append an auditable event log without rewriting the request", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "7tool-manager-test-"));
  try {
    const validation = validateQuoteRequest(validInput);
    assert.equal(validation.ok, true);
    const saved = await saveQuoteRequest(validation.value, null, { dataDir });
    const assignKey = "123e4567-e89b-42d3-a456-426614174010";
    const assigned = await appendQuoteRequestEvent({ requestId:saved.id, idempotencyKey:assignKey, type:"assigned", assignee:"evgeny-savelev" }, { dataDir, now:"2026-09-12T08:00:00.000Z" });
    const duplicate = await appendQuoteRequestEvent({ requestId:saved.id, idempotencyKey:assignKey, type:"assigned", assignee:"evgeny-savelev" }, { dataDir, now:"2026-09-12T08:01:00.000Z" });
    assert.equal(assigned.duplicate, false);
    assert.equal(duplicate.duplicate, true);
    assert.equal(duplicate.event.id, assigned.event.id);

    await appendQuoteRequestEvent({ requestId:saved.id, idempotencyKey:"123e4567-e89b-42d3-a456-426614174011", type:"status_changed", status:"checking" }, { dataDir, now:"2026-09-12T08:02:00.000Z" });
    await appendQuoteRequestEvent({ requestId:saved.id, idempotencyKey:"123e4567-e89b-42d3-a456-426614174012", type:"note_added", note:"Проверить срок у поставщика" }, { dataDir, now:"2026-09-12T08:03:00.000Z" });

    const requestLog = await readFile(path.join(dataDir, "requests.jsonl"), "utf8");
    const eventLog = await readFile(path.join(dataDir, "events.jsonl"), "utf8");
    assert.match(requestLog, /"status":"received"/u);
    assert.doesNotMatch(requestLog, /Проверить срок у поставщика/u);
    assert.match(eventLog, /Проверить срок у поставщика/u);
    assert.doesNotMatch(eventLog, new RegExp(assignKey));
    assert.doesNotMatch(eventLog, /"idempotencyKey"/u);

    const detail = await getQuoteRequestDetail(saved.id, { dataDir, now:"2026-09-12T08:04:00.000Z" });
    assert.equal(detail.status, "checking");
    assert.equal(detail.assigneeName, "Евгений Савельев");
    assert.equal(detail.emailFull, validInput.email);
    assert.equal(detail.events.length, 3);
    const summaries = await listQuoteRequestSummaries(10, { dataDir, now:"2026-09-12T08:04:00.000Z" });
    assert.equal(summaries[0].status, "checking");
    assert.equal(summaries[0].email, "ma***@example.test");

    await assert.rejects(() => appendQuoteRequestEvent({ requestId:saved.id, idempotencyKey:"123e4567-e89b-42d3-a456-426614174013", type:"status_changed", status:"sent" }, { dataDir }), (error) => error instanceof QuoteWorkflowError && error.status === 400);
  } finally {
    await rm(dataDir, { recursive:true, force:true });
  }
});

test("manager action API stays local, same-origin and free of delivery endpoints", async () => {
  const api = await readFile(new URL("../app/api/quote-requests/[id]/events/route.ts", import.meta.url), "utf8");
  assert.match(api, /isQuoteTestModeEnabled\(\)/u);
  assert.match(api, /origin !== requestUrl\.origin/u);
  assert.match(api, /status:429/u);
  assert.doesNotMatch(api, /https?:\/\/|mailto:|t\.me|max\.ru|sendMail|fetch\(["']https/u);
});
