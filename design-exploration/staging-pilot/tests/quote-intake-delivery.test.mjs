import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { isQuoteIntakeDeliveryEnabled, saveQuoteRequest } from "../app/data/quoteRequestStore.ts";
import { validateQuoteRequest } from "../app/data/quoteRequestValidation.mjs";
import { isDirectExecution, processQuoteIntakeOutbox, toProductionLeadPayload } from "../scripts/process-quote-intake-outbox.mjs";

const envNames = ["QUOTE_WORKSPACE_ENABLED", "QUOTE_TEST_MODE", "QUOTE_DATA_DIR", "QUOTE_TEST_DATA_DIR", "QUOTE_INTAKE_DELIVERY_ENABLED"];

test("enabled production intake creates a privacy-safe pending bridge record", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "7tool-intake-enabled-"));
  const previous = snapshotEnv(envNames);
  try {
    enableBridge(dataDir);
    assert.equal(isQuoteIntakeDeliveryEnabled(), true);
    const validation = validateQuoteRequest(validRequest());
    assert.equal(validation.ok, true);
    const saved = await saveQuoteRequest(validation.value, null);
    assert.equal(saved.deliveryMode, "queued-production-outbox");
    const outbox = JSON.parse((await readFile(path.join(dataDir, "request-intake-outbox.jsonl"), "utf8")).trim());
    assert.deepEqual(outbox, {
      id:`INTAKE-${saved.id}`,
      requestId:saved.id,
      createdAt:saved.createdAt,
      requestType:"quick_order",
      status:"pending",
      transport:"production-lead-bridge",
      channels:["email", "max", "crm"],
      deliveryEnabled:true,
      attempts:0,
    });
    assert.doesNotMatch(JSON.stringify(outbox), /\+7|@|phone|emailFull|company/iu);
  } finally {
    restoreEnv(previous);
    await rm(dataDir, { recursive:true, force:true });
  }
});

test("the named new-version contour can keep staff access while explicitly enabling intake delivery", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "7tool-intake-preview-"));
  const previous = snapshotEnv(envNames);
  try {
    process.env.QUOTE_WORKSPACE_ENABLED = "1";
    process.env.QUOTE_TEST_MODE = "1";
    process.env.QUOTE_TEST_DATA_DIR = dataDir;
    delete process.env.QUOTE_DATA_DIR;
    process.env.QUOTE_INTAKE_DELIVERY_ENABLED = "1";
    assert.equal(isQuoteIntakeDeliveryEnabled(), true);
    const validation = validateQuoteRequest(validRequest());
    const saved = await saveQuoteRequest(validation.value, null);
    assert.equal(saved.deliveryMode, "queued-production-outbox");
  } finally {
    restoreEnv(previous);
    await rm(dataDir, { recursive:true, force:true });
  }
});

test("bridge forwards once with a stable submission id and records a PII-free receipt", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "7tool-intake-delivery-"));
  const previous = snapshotEnv(envNames);
  try {
    enableBridge(dataDir);
    const validation = validateQuoteRequest(validRequest());
    assert.equal(validation.ok, true);
    const saved = await saveQuoteRequest(validation.value, null);
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ url, payload:JSON.parse(init.body), redirect:init.redirect });
      return new Response(JSON.stringify({ ok:true, requestId:"7T-20260929-ABC123", duplicate:false }), { status:200 });
    };
    const first = await processQuoteIntakeOutbox({ dataDir, endpoint:"https://7tool.ru/api/lead", enabled:true, fetchImpl, now:"2026-09-29T12:00:00.000Z" });
    const second = await processQuoteIntakeOutbox({ dataDir, endpoint:"https://7tool.ru/api/lead", enabled:true, fetchImpl, now:"2026-09-29T12:01:00.000Z" });
    assert.deepEqual(first, { enabled:true, inspected:1, pending:1, processed:1, delivered:1, failed:0 });
    assert.equal(second.processed, 0);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://7tool.ru/api/lead");
    assert.equal(calls[0].payload.submissionId, `new-${saved.id}`);
    assert.equal(calls[0].payload.type, "one_click");
    assert.equal(calls[0].payload.extra.newRequestId, saved.id);
    assert.equal(calls[0].redirect, "error");
    const receipt = JSON.parse((await readFile(path.join(dataDir, "request-intake-delivery.jsonl"), "utf8")).trim());
    assert.equal(receipt.status, "delivered");
    assert.equal(receipt.targetRequestId, "7T-20260929-ABC123");
    assert.doesNotMatch(JSON.stringify(receipt), /buyer|example|\+7|company|phone|email/iu);
  } finally {
    restoreEnv(previous);
    await rm(dataDir, { recursive:true, force:true });
  }
});

test("failed bridge attempts wait for backoff and retry idempotently", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "7tool-intake-retry-"));
  const previous = snapshotEnv(envNames);
  try {
    enableBridge(dataDir);
    const validation = validateQuoteRequest(validRequest());
    assert.equal(validation.ok, true);
    const saved = await saveQuoteRequest(validation.value, null);
    let calls = 0;
    const fetchImpl = async (_url, init) => {
      calls += 1;
      const payload = JSON.parse(init.body);
      assert.equal(payload.submissionId, `new-${saved.id}`);
      return calls === 1
        ? new Response(JSON.stringify({ ok:false, error:"TEMPORARY" }), { status:503 })
        : new Response(JSON.stringify({ ok:true, requestId:"7T-20260929-DEF456", duplicate:true }), { status:200 });
    };
    const failed = await processQuoteIntakeOutbox({ dataDir, endpoint:"https://7tool.ru/api/lead", enabled:true, fetchImpl, now:"2026-09-29T12:00:00.000Z" });
    const tooSoon = await processQuoteIntakeOutbox({ dataDir, endpoint:"https://7tool.ru/api/lead", enabled:true, fetchImpl, now:"2026-09-29T12:00:30.000Z" });
    const retried = await processQuoteIntakeOutbox({ dataDir, endpoint:"https://7tool.ru/api/lead", enabled:true, fetchImpl, now:"2026-09-29T12:01:01.000Z" });
    assert.equal(failed.failed, 1);
    assert.equal(tooSoon.processed, 0);
    assert.equal(retried.delivered, 1);
    assert.equal(calls, 2);
    const journal = (await readFile(path.join(dataDir, "request-intake-delivery.jsonl"), "utf8")).trim().split("\n").map(JSON.parse);
    assert.deepEqual(journal.map((entry) => [entry.status, entry.attempts]), [["failed", 1], ["delivered", 2]]);
    assert.equal(journal[0].errorCode, "HTTP_503");
  } finally {
    restoreEnv(previous);
    await rm(dataDir, { recursive:true, force:true });
  }
});

test("bridge is fail-closed for disabled delivery and any non-production endpoint", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "7tool-intake-disabled-"));
  const previous = snapshotEnv(envNames);
  try {
    enableBridge(dataDir);
    const validation = validateQuoteRequest(validRequest());
    const saved = await saveQuoteRequest(validation.value, null);
    let calls = 0;
    const disabled = await processQuoteIntakeOutbox({ dataDir, endpoint:"https://7tool.ru/api/lead", enabled:false, fetchImpl:async () => { calls += 1; } });
    assert.equal(disabled.enabled, false);
    assert.equal(disabled.pending, 1);
    assert.equal(calls, 0);
    assert.rejects(() => processQuoteIntakeOutbox({ dataDir, endpoint:"https://example.test/api/lead", enabled:true, fetchImpl:async () => null }), /must equal https:\/\/7tool\.ru\/api\/lead/u);
    assert.equal(toProductionLeadPayload({ ...validStored(saved.id), requestType:"selection" }).type, "equipment_selection");
  } finally {
    restoreEnv(previous);
    await rm(dataDir, { recursive:true, force:true });
  }
});

test("worker recognizes direct execution through a stable release symlink", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "7tool-intake-entrypoint-"));
  try {
    const linkDir = path.join(dataDir, "scripts-current");
    await symlink(path.resolve("scripts"), linkDir, process.platform === "win32" ? "junction" : "dir");
    assert.equal(isDirectExecution(path.join(linkDir, "process-quote-intake-outbox.mjs")), true);
    assert.equal(isDirectExecution(path.join(linkDir, "missing.mjs")), false);
  } finally {
    await rm(dataDir, { recursive:true, force:true });
  }
});

function validRequest() {
  return {
    requestType:"quick_order",
    email:"buyer@example.test",
    phone:"+7 900 000-00-00",
    company:"Тестовый завод",
    city:"Тула",
    comment:"Проверить срок поставки",
    billingInn:"",
    idempotencyKey:randomUUID(),
    website:"",
    consent:"on",
    alternatives:"on",
    checkAvailability:"on",
    checkSet:"on",
    checkDocs:"on",
    items:[{ id:"variant:A9409", title:"LENZ STEYR-35", article:"STEYR-35", quantity:1, href:"/product/magnitnyy-sverlilnyy-stanok-lenz-steyr-35?variant=A9409" }],
    source:{ pagePath:"/product/magnitnyy-sverlilnyy-stanok-lenz-steyr-35", utmSource:"test", utmMedium:"qa", utmCampaign:"launch" },
  };
}

function validStored(id) {
  const source = validRequest();
  return { ...source, id, createdAt:"2026-09-29T12:00:00.000Z", consent:true, alternatives:true, requestedChecks:{ availability:true, compatibility:true, documents:true } };
}

function enableBridge(dataDir) {
  process.env.QUOTE_WORKSPACE_ENABLED = "1";
  process.env.QUOTE_TEST_MODE = "0";
  process.env.QUOTE_DATA_DIR = dataDir;
  delete process.env.QUOTE_TEST_DATA_DIR;
  process.env.QUOTE_INTAKE_DELIVERY_ENABLED = "1";
}

function snapshotEnv(names) {
  return Object.fromEntries(names.map((name) => [name, process.env[name]]));
}

function restoreEnv(snapshot) {
  for (const [name, value] of Object.entries(snapshot)) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
}
