import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DELETE as signOut, POST as signIn } from "../app/api/manager-auth/session/route.ts";
import { POST as approvalAction } from "../app/api/quote-requests/[id]/quote-approval/route.ts";
import { capabilitiesForRole, canManager, isTestManagerHostname, MANAGER_CAPABILITIES, resolvePlatformManagerActor, safeManagerReturnTo } from "../app/data/managerAccess.ts";
import { resolveManagerActor } from "../app/data/managerAccessServer.ts";
import { getQuoteApprovalState } from "../app/data/quoteApprovalStore.ts";
import { saveQuoteDraft } from "../app/data/quoteDraftStore.ts";
import { QUOTE_APPROVAL_CHECKS } from "../app/data/quoteApprovalValidation.mjs";
import { saveQuoteRequest } from "../app/data/quoteRequestStore.ts";
import { validateQuoteRequest } from "../app/data/quoteRequestValidation.mjs";

test("administrator owns every staff capability while other roles stay bounded", () => {
  const admin = actor("admin");
  assert.deepEqual(capabilitiesForRole("admin"), MANAGER_CAPABILITIES);
  MANAGER_CAPABILITIES.forEach((capability) => assert.equal(canManager(admin, capability), true));
  assert.equal(canManager(actor("manager"), "quotes:edit"), true);
  assert.equal(canManager(actor("manager"), "quotes:approve"), false);
  assert.equal(canManager(actor("approver"), "quotes:approve"), true);
  assert.equal(canManager(actor("approver"), "settings:manage"), false);
  assert.equal(canManager(actor("approver"), "delivery:prepare"), false);
});

test("platform identity requires an explicit server allowlist and keeps return paths local", () => {
  const headers = new Headers({
    "oai-authenticated-user-id":"workspace-user-1",
    "oai-authenticated-user-email":"ADMIN@EXAMPLE.TEST",
    "oai-authenticated-user-full-name":"%D0%90%D0%BD%D0%BD%D0%B0%20%D0%98%D0%B2%D0%B0%D0%BD%D0%BE%D0%B2%D0%B0",
    "oai-authenticated-user-full-name-encoding":"percent-encoded-utf-8",
  });
  assert.equal(resolvePlatformManagerActor(headers, {}), null);
  const resolved = resolvePlatformManagerActor(headers, { MANAGER_AUTH_ADMIN_EMAILS:"admin@example.test" });
  assert.equal(resolved?.role, "admin");
  assert.equal(resolved?.name, "Анна Иванова");
  assert.equal(safeManagerReturnTo("/test/requests/7T-1?tab=quote"), "/test/requests/7T-1?tab=quote");
  assert.equal(safeManagerReturnTo("https://attacker.example/test/requests"), "/test/requests");
  assert.equal(safeManagerReturnTo("//attacker.example"), "/test/requests");
});

test("local admin sign-in is loopback-only and uses an HttpOnly signed session", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "7tool-manager-session-"));
  const previousMode = process.env.QUOTE_TEST_MODE;
  const previousDataDir = process.env.QUOTE_TEST_DATA_DIR;
  try {
    process.env.QUOTE_TEST_MODE = "1";
    process.env.QUOTE_TEST_DATA_DIR = dataDir;
    const response = await signIn(new Request("http://127.0.0.1:3999/api/manager-auth/session", { method:"POST", headers:{ origin:"http://127.0.0.1:3999" } }));
    assert.equal(response.status, 200);
    const setCookie = response.headers.get("set-cookie") || "";
    assert.match(setCookie, /7tool_manager_session=/u);
    assert.match(setCookie, /HttpOnly/u);
    assert.match(setCookie, /SameSite=Strict/u);
    const cookie = setCookie.split(";")[0];
    const resolved = await resolveManagerActor(new Headers({ host:"127.0.0.1:3999", cookie }), { dataDir });
    assert.equal(resolved?.role, "admin");
    assert.equal(resolved?.name, "Локальный администратор");
    assert.equal(await resolveManagerActor(new Headers({ host:"7tool.example", cookie }), { dataDir }), null);
    const tampered = cookie.replace(/.$/u, cookie.endsWith("a") ? "b" : "a");
    assert.equal(await resolveManagerActor(new Headers({ host:"127.0.0.1:3999", cookie:tampered }), { dataDir }), null);
    const cleared = await signOut(new Request("http://127.0.0.1:3999/api/manager-auth/session", { method:"DELETE", headers:{ origin:"http://127.0.0.1:3999" } }));
    assert.equal(cleared.status, 200);
    assert.match(cleared.headers.get("set-cookie") || "", /Max-Age=0/u);
    const remote = await signIn(new Request("https://example.test/api/manager-auth/session", { method:"POST", headers:{ origin:"https://example.test" } }));
    assert.equal(remote.status, 404);
  } finally {
    if (previousMode === undefined) delete process.env.QUOTE_TEST_MODE; else process.env.QUOTE_TEST_MODE = previousMode;
    if (previousDataDir === undefined) delete process.env.QUOTE_TEST_DATA_DIR; else process.env.QUOTE_TEST_DATA_DIR = previousDataDir;
    await rm(dataDir, { recursive:true, force:true });
  }
});

test("test manager hostname is deny-by-default and requires an exact explicit allowlist", () => {
  assert.equal(isTestManagerHostname("127.0.0.1", {}), true);
  assert.equal(isTestManagerHostname("test.7tool.ru", {}), false);
  assert.equal(isTestManagerHostname("test.7tool.ru", { MANAGER_AUTH_TEST_HOSTS:"test.7tool.ru" }), true);
  assert.equal(isTestManagerHostname("TEST.7TOOL.RU.", { MANAGER_AUTH_TEST_HOSTS:"test.7tool.ru" }), true);
  assert.equal(isTestManagerHostname("attacker.test.7tool.ru", { MANAGER_AUTH_TEST_HOSTS:"test.7tool.ru" }), false);
});

test("administrator can submit, approve and prepare one quote without trusting browser actor fields", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "7tool-manager-admin-actions-"));
  const previousMode = process.env.QUOTE_TEST_MODE;
  const previousDataDir = process.env.QUOTE_TEST_DATA_DIR;
  const previousAdmins = process.env.MANAGER_AUTH_ADMIN_EMAILS;
  try {
    process.env.QUOTE_TEST_MODE = "1";
    process.env.QUOTE_TEST_DATA_DIR = dataDir;
    process.env.MANAGER_AUTH_ADMIN_EMAILS = "admin@example.test";
    const request = await createRequest(dataDir);
    await saveQuoteDraft(request.id, readyQuote(), { dataDir, now:"2026-09-13T07:00:00.000Z" });
    const context = { params:Promise.resolve({ id:request.id }) };
    const checks = Object.fromEntries(QUOTE_APPROVAL_CHECKS.map((key) => [key, true]));
    const submitted = await approvalAction(adminActionRequest(request.id, { type:"submitted", revision:1, checks, actorName:"Подменённое имя", actorRole:"Подменённая роль", idempotencyKey:uuid("603") }), context);
    assert.equal(submitted.status, 201);
    const approved = await approvalAction(adminActionRequest(request.id, { type:"approved", revision:1, note:"Условия проверены", actorName:"Подменённое имя", actorRole:"Подменённая роль", idempotencyKey:uuid("604") }), context);
    assert.equal(approved.status, 201);
    const prepared = await approvalAction(adminActionRequest(request.id, { type:"delivery_prepared", revision:1, channel:"email", recipient:"client@example.test", actorName:"Подменённое имя", actorRole:"Подменённая роль", idempotencyKey:uuid("605") }), context);
    assert.equal(prepared.status, 201);
    const state = await getQuoteApprovalState(request.id, 1, { dataDir });
    assert.equal(state.stage, "delivery_prepared");
    assert.equal(state.events.length, 3);
    state.events.forEach((event) => {
      assert.equal(event.actorName, "Администратор Тест");
      assert.equal(event.actorRole, "Администратор");
    });
    const stored = await readFile(path.join(dataDir, "quote-approval-events.jsonl"), "utf8");
    assert.doesNotMatch(stored, /Подменённ/u);
  } finally {
    if (previousMode === undefined) delete process.env.QUOTE_TEST_MODE; else process.env.QUOTE_TEST_MODE = previousMode;
    if (previousDataDir === undefined) delete process.env.QUOTE_TEST_DATA_DIR; else process.env.QUOTE_TEST_DATA_DIR = previousDataDir;
    if (previousAdmins === undefined) delete process.env.MANAGER_AUTH_ADMIN_EMAILS; else process.env.MANAGER_AUTH_ADMIN_EMAILS = previousAdmins;
    await rm(dataDir, { recursive:true, force:true });
  }
});

test("every staff API is server-protected while customer quote submission stays public", async () => {
  const protectedRoutes = [
    "../app/api/quote-requests/[id]/events/route.ts",
    "../app/api/quote-requests/[id]/quote-draft/route.ts",
    "../app/api/quote-requests/[id]/quote-approval/route.ts",
    "../app/api/quote-requests/[id]/delivery/route.ts",
    "../app/api/quote-requests/[id]/quote-pdf/route.ts",
    "../app/api/quote-requests/[id]/quote-assets/route.ts",
    "../app/api/quote-requests/[id]/quote-assets/[assetId]/route.ts",
    "../app/api/quote-settings/route.ts",
    "../app/api/quote-settings/stamp/route.ts",
    "../app/api/quote-settings/stamp/[assetId]/route.ts",
    "../app/api/trust-content/route.ts",
    "../app/api/trust-content/assets/route.ts",
    "../app/api/homepage-content/route.ts",
    "../app/api/homepage-content/assets/route.ts",
  ];
  for (const relativePath of protectedRoutes) {
    const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
    assert.match(source, /authorizeManagerRequest/u, `${relativePath} must enforce server authorization`);
  }
  const customerRoute = await readFile(new URL("../app/api/quote-requests/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(customerRoute, /authorizeManagerRequest/u);
});

function actor(role) {
  return { id:`test-${role}`, email:"", name:"Тест", role, roleLabel:role, source:"local-demo" };
}

function adminActionRequest(requestId, body) {
  return new Request(`http://local.test/api/quote-requests/${requestId}/quote-approval`, {
    method:"POST",
    headers:{ origin:"http://local.test", "content-type":"application/json", "oai-authenticated-user-id":"admin-1", "oai-authenticated-user-email":"admin@example.test", "oai-authenticated-user-full-name":"%D0%90%D0%B4%D0%BC%D0%B8%D0%BD%D0%B8%D1%81%D1%82%D1%80%D0%B0%D1%82%D0%BE%D1%80%20%D0%A2%D0%B5%D1%81%D1%82", "oai-authenticated-user-full-name-encoding":"percent-encoded-utf-8" },
    body:JSON.stringify(body),
  });
}

async function createRequest(dataDir) {
  const validation = validateQuoteRequest({ email:"client@example.test", phone:"+7 900 000-22-33", company:"Тестовый завод", city:"Тула", comment:"", billingInn:"", idempotencyKey:uuid("601"), website:"", consent:"on", alternatives:"on", checkAvailability:"on", checkSet:"on", checkDocs:"on", source:{ pagePath:"/search", utmSource:"", utmMedium:"", utmCampaign:"" }, items:[{ id:"variant:A9409", title:"Магнитный станок", article:"STEYR-35", quantity:1, price:"47 999 ₽" }] });
  assert.equal(validation.ok, true);
  return saveQuoteRequest(validation.value, null, { dataDir });
}

function readyQuote() {
  return { idempotencyKey:uuid("602"), status:"ready", validityDays:10, vatRate:22, paymentTerms:"Оплата по счёту", deliveryTerms:"Доставка рассчитывается отдельно", managerComment:"", sender:{ name:"Евгений Савельев", role:"Персональный менеджер 7TOOL", phone:"+7 (962) 611-24-19", email:"info@7tool.ru" }, items:[{ id:"variant:A9409", title:"Магнитный станок", article:"STEYR-35", quantity:1, price:"47 999 ₽", unitPriceRub:47999, discountPercent:0, supplyStatus:"supplier_confirmed", shipmentText:"Отгрузка в течение 5 рабочих дней" }] };
}

function uuid(suffix) {
  return `123e4567-e89b-42d3-a456-426614174${suffix}`;
}
