import assert from "node:assert/strict";
import { pbkdf2Sync, randomBytes, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { once } from "node:events";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

const SECURITY_HEADERS = Object.freeze({
  "permissions-policy":"camera=(), microphone=(), geolocation=()",
  "referrer-policy":"strict-origin-when-cross-origin",
  "x-content-type-options":"nosniff",
  "x-frame-options":"SAMEORIGIN",
});

const PRODUCT = Object.freeze({
  id:"variant:A9409",
  title:"Магнитный сверлильный станок LENZ STEYR-35",
  article:"STEYR-35",
  quantity:2,
  price:"47 999 ₽",
  href:"/product/magnitnyy-sverlilnyy-stanok-lenz-steyr-35?variant=A9409",
});

export const BUSINESS_ACCEPTANCE_ACTIONS = Object.freeze([
  "product",
  "request",
  "request_duplicate",
  "manager_login",
  "request_assignment",
  "request_status",
  "quote_ready",
  "quote_submitted",
  "quote_approved",
  "quote_pdf",
  "delivery_prepared",
  "outbox_held",
  "manager_pages",
  "attachment",
]);

export function isolatedAcceptanceBaseUrl(portValue = process.env.ACCEPTANCE_PORT || "3242") {
  const port = Number(portValue);
  if (!Number.isInteger(port) || port < 1024 || port > 65535 || port === 3000) {
    throw new Error("ACCEPTANCE_PORT must be an unused non-production port from 1024 to 65535.");
  }
  return new URL(`http://127.0.0.1:${port}`);
}

export async function runIsolatedBusinessAcceptance(options = {}) {
  const appDir = path.resolve(options.appDir || process.cwd());
  const baseUrl = isolatedAcceptanceBaseUrl(options.port);
  const serverEntry = path.join(appDir, "node_modules", "vinext", "dist", "cli.js");
  const distDir = path.join(appDir, "dist");
  if (!existsSync(serverEntry) || !existsSync(distDir)) {
    throw new Error("Build is missing. Run the production build before business acceptance.");
  }

  const dataDir = await mkdtemp(path.join(os.tmpdir(), "7tool-acceptance-"));
  const username = `acceptance-${randomBytes(6).toString("hex")}`;
  const password = randomBytes(24).toString("base64url");
  const passwordHash = createPasswordHash(password);
  const serverLog = [];
  const server = spawn(process.execPath, [serverEntry, "start"], {
    cwd:appDir,
    env:{
      ...process.env,
      NODE_ENV:"production",
      PORT:baseUrl.port,
      QUOTE_TEST_MODE:"1",
      QUOTE_TEST_DATA_DIR:dataDir,
      MANAGER_AUTH_LOCAL_USERNAME:username,
      MANAGER_AUTH_LOCAL_PASSWORD_HASH:passwordHash,
      FORCE_DOCUMENT_NAVIGATION:"1",
      SHIPPING_TIME_ZONE:"Europe/Moscow",
      SHIPPING_CUTOFF_HOUR:"18",
      SHIPPING_WORKING_DAYS:"1,2,3,4,5",
      SHIPPING_TODAY_ENABLED:"1",
      SHIPPING_FEED_MAX_AGE_MINUTES:"180",
    },
    stdio:["ignore", "pipe", "pipe"],
  });
  collectLog(server.stdout, serverLog);
  collectLog(server.stderr, serverLog);

  try {
    await waitForServer(baseUrl, server);
    const result = await exerciseBusinessLoop({ baseUrl, dataDir, username, password });
    return { ...result, isolatedDataRemoved:true };
  } catch (error) {
    const diagnostic = serverLog.join("").slice(-8_000).trim();
    if (diagnostic) console.error(diagnostic);
    throw error;
  } finally {
    await stopServer(server);
    await rm(dataDir, { recursive:true, force:true });
  }
}

async function exerciseBusinessLoop({ baseUrl, dataDir, username, password }) {
  const timings = [];
  const requestIdempotencyKey = randomUUID();

  const productPage = await checkedFetch(baseUrl, PRODUCT.href, {}, 200, "product", timings);
  const productHtml = await productPage.text();
  containsAll(productHtml, ["LENZ STEYR-35", "STEYR-35"]);

  const createResponse = await checkedFetch(baseUrl, "/api/quote-requests", {
    method:"POST",
    body:customerRequest(requestIdempotencyKey),
    headers:{ Origin:baseUrl.origin, "X-Requested-With":"7tool-business-acceptance", "X-Forwarded-For":"127.0.0.241" },
  }, 201, "request", timings);
  const created = await createResponse.json();
  assert.equal(created.ok, true);
  assert.equal(created.duplicate, false);
  assert.equal(created.delivery, "disabled-test-contour");
  assert.match(created.requestNumber, /^7T-\d{8}-[A-F0-9]{6}$/u);
  const requestId = created.requestNumber;

  const duplicateResponse = await checkedFetch(baseUrl, "/api/quote-requests", {
    method:"POST",
    body:customerRequest(requestIdempotencyKey),
    headers:{ Origin:baseUrl.origin, "X-Requested-With":"7tool-business-acceptance", "X-Forwarded-For":"127.0.0.242" },
  }, 200, "request_duplicate", timings);
  const duplicate = await duplicateResponse.json();
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.requestNumber, requestId);

  const anonymous = await checkedFetch(baseUrl, `/test/requests/${encodeURIComponent(requestId)}`, { redirect:"manual" }, 307, "manager_anonymous", timings);
  assert.equal(new URL(anonymous.headers.get("location"), baseUrl).pathname, "/test/access");

  const loginResponse = await checkedFetch(baseUrl, "/api/manager-auth/session", {
    method:"POST",
    headers:{ Origin:baseUrl.origin, "Content-Type":"application/json" },
    body:JSON.stringify({ username, password }),
    redirect:"manual",
  }, 200, "manager_login", timings);
  const login = await loginResponse.json();
  assert.equal(login.ok, true);
  assert.equal(login.actor.role, "admin");
  const cookie = sessionCookie(loginResponse.headers);
  assert.match(cookie, /^7tool_manager_session=/u);
  const managerHeaders = { Cookie:cookie, Origin:baseUrl.origin, "Content-Type":"application/json" };

  await jsonAction(baseUrl, `/api/quote-requests/${encodeURIComponent(requestId)}/events`, {
    type:"assigned",
    assignee:"evgeny-savelev",
    idempotencyKey:randomUUID(),
  }, managerHeaders, "request_assignment", timings);
  await jsonAction(baseUrl, `/api/quote-requests/${encodeURIComponent(requestId)}/events`, {
    type:"status_changed",
    status:"checking",
    idempotencyKey:randomUUID(),
  }, managerHeaders, "request_status", timings);

  const quoteResponse = await checkedFetch(baseUrl, `/api/quote-requests/${encodeURIComponent(requestId)}/quote-draft`, {
    method:"POST",
    headers:managerHeaders,
    body:JSON.stringify(readyQuote()),
  }, 201, "quote_ready", timings);
  const quote = await quoteResponse.json();
  assert.equal(quote.ok, true);
  assert.equal(quote.revision, 1);
  assert.equal(quote.status, "ready");
  assert.equal(quote.totalRub, 95_998);

  const checks = {
    product_identity:true,
    price_and_discount:true,
    supply_and_timing:true,
    payment_and_delivery:true,
    vat_and_total:true,
    recipient:true,
    documents:true,
  };
  await approvalAction(baseUrl, requestId, { type:"submitted", revision:1, checks, idempotencyKey:randomUUID() }, managerHeaders, "quote_submitted", timings);
  const approved = await approvalAction(baseUrl, requestId, { type:"approved", revision:1, note:"Автоматизированная изолированная приёмка", idempotencyKey:randomUUID() }, managerHeaders, "quote_approved", timings);
  assert.equal(approved.state.stage, "approved");

  const pdfResponse = await checkedFetch(baseUrl, `/api/quote-requests/${encodeURIComponent(requestId)}/quote-pdf?revision=1`, {
    headers:{ Cookie:cookie },
  }, 200, "quote_pdf", timings, 25_000);
  assert.equal(pdfResponse.headers.get("content-type"), "application/pdf");
  assert.equal(pdfResponse.headers.get("x-quote-revision"), "1");
  assert.equal(pdfResponse.headers.get("x-quote-fingerprint")?.length, 64);
  const pdfBytes = Buffer.from(await pdfResponse.arrayBuffer());
  assert.equal(pdfBytes.subarray(0, 5).toString("ascii"), "%PDF-");
  assert.ok(pdfBytes.length > 15_000);

  const prepared = await approvalAction(baseUrl, requestId, {
    type:"delivery_prepared",
    revision:1,
    channel:"email",
    recipient:"buyer@example.test",
    idempotencyKey:randomUUID(),
  }, managerHeaders, "delivery_prepared", timings);
  assert.equal(prepared.state.stage, "delivery_prepared");

  const deliveryResponse = await checkedFetch(baseUrl, `/api/quote-requests/${encodeURIComponent(requestId)}/delivery`, {
    method:"POST",
    headers:managerHeaders,
    body:JSON.stringify({
      revision:1,
      idempotencyKey:randomUUID(),
      confirmations:{ recipient:true, document:true, authority:true },
    }),
  }, 201, "outbox_held", timings);
  const delivery = await deliveryResponse.json();
  assert.equal(delivery.ok, true);
  assert.equal(delivery.workspace.outbox.status, "held");
  assert.equal(delivery.workspace.outbox.transport, "disabled-test-contour");
  assert.equal(delivery.workspace.outbox.deliveryEnabled, false);
  assert.equal(delivery.workspace.outbox.attempts, 0);
  assert.equal(delivery.workspace.package.requestId, requestId);
  assert.equal(delivery.workspace.package.revision, 1);

  const deliveryWorkspace = await checkedFetch(baseUrl, `/api/quote-requests/${encodeURIComponent(requestId)}/delivery?revision=1`, {
    headers:{ Cookie:cookie },
  }, 200, "delivery_workspace", timings);
  assert.equal((await deliveryWorkspace.json()).workspace.outbox.status, "held");

  for (const [route, required] of [
    ["/test/requests", [requestId]],
    [`/test/requests/${encodeURIComponent(requestId)}`, [requestId, "STEYR-35", "Евгений Савельев"]],
    [`/test/requests/${encodeURIComponent(requestId)}/quote?mode=preview&revision=1`, [quote.quoteId, "НДС 22%", "STEYR-35"]],
    ["/test/delivery", [requestId, "Удерживается"]],
  ]) {
    const response = await checkedFetch(baseUrl, route, { headers:{ Cookie:cookie } }, 200, "manager_pages", timings);
    containsAll(await response.text(), required);
  }

  const attachmentResponse = await checkedFetch(baseUrl, `/api/quote-requests/${encodeURIComponent(requestId)}/attachment`, {
    headers:{ Cookie:cookie },
  }, 200, "attachment", timings);
  assert.equal(attachmentResponse.headers.get("content-type"), "application/pdf");
  assert.equal(Buffer.from(await attachmentResponse.arrayBuffer()).subarray(0, 5).toString("ascii"), "%PDF-");

  await assertStoredEvidence(dataDir, requestId, quote.quoteId);
  assert.deepEqual(new Set(timings.map((entry) => entry.action)), new Set([...BUSINESS_ACCEPTANCE_ACTIONS, "manager_anonymous", "delivery_workspace"]));
  return {
    requestId,
    quoteId:quote.quoteId,
    revision:1,
    itemId:PRODUCT.id,
    itemQuantity:PRODUCT.quantity,
    vatRate:22,
    pdfBytes:pdfBytes.length,
    outboxStatus:delivery.workspace.outbox.status,
    externalDelivery:false,
    timings,
  };
}

function customerRequest(idempotencyKey) {
  const form = new FormData();
  form.set("request_type", "quote");
  form.set("email", "buyer@example.test");
  form.set("phone", "+7 900 000-00-00");
  form.set("company", "7TOOL Acceptance Fixture");
  form.set("city", "Москва");
  form.set("comment", "Синтетическая изолированная проверка полного цикла");
  form.set("billing_inn", "7707083893");
  form.set("idempotency_key", idempotencyKey);
  form.set("website", "");
  form.set("consent", "on");
  form.set("alternatives", "on");
  form.set("check_availability", "on");
  form.set("check_set", "on");
  form.set("check_docs", "on");
  form.set("items", JSON.stringify([PRODUCT]));
  form.set("source", JSON.stringify({
    pagePath:PRODUCT.href,
    utmSource:"business-acceptance",
    utmMedium:"isolated",
    utmCampaign:"prelaunch-gate",
  }));
  form.set("billing_file", new File([Buffer.from("%PDF-1.7\n7TOOL isolated acceptance fixture\n")], "acceptance-requisites.pdf", { type:"application/pdf" }));
  return form;
}

function readyQuote() {
  return {
    idempotencyKey:randomUUID(),
    status:"ready",
    validityDays:10,
    vatRate:22,
    paymentTerms:"Оплата по счёту после согласования",
    deliveryTerms:"Срок и способ поставки подтверждены менеджером в тестовом контуре",
    managerComment:"Синтетическая изолированная приёмка.",
    sender:{
      name:"Евгений Савельев",
      role:"Персональный менеджер 7TOOL",
      phone:"+7 (962) 611-24-19",
      email:"info@7tool.ru",
    },
    items:[{
      ...PRODUCT,
      unitPriceRub:47_999,
      discountPercent:0,
      supplyStatus:"supplier_confirmed",
      shipmentText:"Срок отгрузки подтверждается перед оплатой",
    }],
  };
}

async function approvalAction(baseUrl, requestId, body, headers, action, timings) {
  const response = await checkedFetch(baseUrl, `/api/quote-requests/${encodeURIComponent(requestId)}/quote-approval`, {
    method:"POST",
    headers,
    body:JSON.stringify(body),
  }, 201, action, timings);
  const result = await response.json();
  assert.equal(result.ok, true);
  return result;
}

async function jsonAction(baseUrl, route, body, headers, action, timings) {
  const response = await checkedFetch(baseUrl, route, { method:"POST", headers, body:JSON.stringify(body) }, 201, action, timings);
  const result = await response.json();
  assert.equal(result.ok, true);
  return result;
}

async function checkedFetch(baseUrl, route, init, expectedStatus, action, timings, timeoutMs = 15_000) {
  const target = new URL(route, baseUrl);
  assert.equal(target.origin, baseUrl.origin);
  const started = performance.now();
  const response = await fetch(target, { signal:AbortSignal.timeout(timeoutMs), ...init });
  const durationMs = Math.round(performance.now() - started);
  assert.equal(response.status, expectedStatus, `${route} returned ${response.status}; expected ${expectedStatus}`);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) assert.equal(response.headers.get(name), value, `${route}: ${name}`);
  timings.push({ action, route:target.pathname, status:response.status, durationMs });
  return response;
}

async function assertStoredEvidence(dataDir, requestId, quoteId) {
  const files = await Promise.all([
    "requests.jsonl",
    "events.jsonl",
    "quote-drafts.jsonl",
    "quote-approval-events.jsonl",
    "quote-delivery-outbox.jsonl",
  ].map((name) => readFile(path.join(dataDir, name), "utf8")));
  const combined = files.join("\n");
  containsAll(combined, [requestId, quoteId, PRODUCT.id, PRODUCT.href, "business-acceptance", "disabled-test-contour", '"status":"held"']);
  assert.doesNotMatch(combined, /"idempotencyKey"|smtp|sendmail|api\.telegram|api\.max|crm\.|deliveryEnabled":true/iu);
  const draft = JSON.parse(files[2].trim().split("\n").at(-1));
  assert.equal(draft.vatRate, 22);
  assert.equal(draft.items[0].productPresentation.variantId, "A9409");
  assert.match(draft.items[0].productPresentation.imageUrl, /^https:\/\/s3\.export\.k2tool\.ru\//u);
  assert.ok(draft.items[0].productPresentation.keySpecs.length >= 3);
}

async function waitForServer(baseUrl, server) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server.exitCode != null) throw new Error(`Acceptance server stopped before readiness with code ${server.exitCode}.`);
    try {
      const response = await fetch(new URL("/test/access", baseUrl), { signal:AbortSignal.timeout(1_000) });
      if (response.status === 200) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Acceptance server did not become ready within 15 seconds.");
}

async function stopServer(server) {
  if (server.exitCode != null) return;
  const exited = once(server, "exit");
  server.kill("SIGTERM");
  const stopped = await Promise.race([exited.then(() => true), new Promise((resolve) => setTimeout(() => resolve(false), 5_000))]);
  if (!stopped && server.exitCode == null) {
    server.kill("SIGKILL");
    await once(server, "exit");
  }
}

function collectLog(stream, target) {
  stream?.setEncoding("utf8");
  stream?.on("data", (chunk) => {
    target.push(String(chunk));
    while (target.join("").length > 20_000) target.shift();
  });
}

function createPasswordHash(password) {
  const salt = randomBytes(18);
  const digest = pbkdf2Sync(password, salt, 100_000, 32, "sha256");
  return `pbkdf2-sha256$100000$${salt.toString("base64url")}$${digest.toString("base64url")}`;
}

function sessionCookie(headers) {
  const values = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [headers.get("set-cookie") || ""];
  return values.find((value) => value.startsWith("7tool_manager_session="))?.split(";", 1)[0] || "";
}

function containsAll(value, expected) {
  for (const item of expected) assert.ok(value.includes(item), `Expected response or evidence to include ${item}`);
}

const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (entry === import.meta.url) {
  runIsolatedBusinessAcceptance().then((result) => {
    console.log(`Business acceptance passed: ${result.requestId} → ${result.quoteId}, PDF ${result.pdfBytes} bytes, outbox ${result.outboxStatus}.`);
    console.log(`Checks: ${result.timings.length}; slowest: ${Math.max(...result.timings.map((item) => item.durationMs))} ms; external delivery: disabled; isolated data: removed.`);
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : "Business acceptance failed.");
    process.exitCode = 1;
  });
}
