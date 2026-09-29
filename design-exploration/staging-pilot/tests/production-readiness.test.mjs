import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { POST as createQuoteRequest } from "../app/api/quote-requests/route.ts";
import { isTestManagerHostname } from "../app/data/managerAccess.ts";
import { isQuoteTestContour, isQuoteWorkspaceEnabled, saveQuoteRequest } from "../app/data/quoteRequestStore.ts";
import { validateQuoteRequest } from "../app/data/quoteRequestValidation.mjs";
import { validateProductionConfig } from "../scripts/validate-production-config.mjs";

test("production preflight accepts only a complete live configuration and matching fresh catalog", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "7tool-production-ready-"));
  try {
    const quoteDir = path.join(root, "quotes");
    const catalogPath = path.join(root, "products.json");
    const metadataPath = path.join(root, "catalog-snapshot-meta.json");
    await mkdir(quoteDir);
    const catalog = Buffer.from('{"products":[],"categories":[]}\n');
    await writeFile(catalogPath, catalog);
    await writeFile(metadataPath, JSON.stringify({
      status:"complete",
      completedAt:"2026-09-29T00:20:00.000Z",
      catalogSha256:createHash("sha256").update(catalog).digest("hex"),
    }));

    const env = productionEnv({ quoteDir, catalogPath, metadataPath });
    const result = validateProductionConfig(env, { now:"2026-09-29T00:30:00.000Z" });
    assert.equal(result.ok, true, result.errors.join("\n"));
    assert.ok(result.checks.includes("catalog checksum and freshness verified"));

    assert.equal(validateProductionConfig({ ...env, QUOTE_TEST_MODE:"1" }, { checkFiles:false }).ok, false);
    assert.equal(validateProductionConfig({ ...env, SEO_INDEXING_ENABLED:"0" }, { checkFiles:false }).ok, false);
    assert.equal(validateProductionConfig({ ...env, MANAGER_AUTH_LOCAL_HOSTS:"test.7tool.ru" }, { checkFiles:false }).ok, false);
    assert.equal(isTestManagerHostname("7tool.ru", env), true);
    assert.equal(isTestManagerHostname("attacker.7tool.ru", env), false);
    const stale = validateProductionConfig(env, { now:"2026-09-30T03:00:01.000Z" });
    assert.equal(stale.ok, false);
    assert.ok(stale.errors.some((message) => message.includes("older than")));
  } finally {
    await rm(root, { recursive:true, force:true });
  }
});

test("production workspace stores a request durably without enabling an external transport", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "7tool-production-request-"));
  const previous = snapshotEnv(["QUOTE_WORKSPACE_ENABLED", "QUOTE_TEST_MODE", "QUOTE_DATA_DIR", "QUOTE_TEST_DATA_DIR"]);
  try {
    process.env.QUOTE_WORKSPACE_ENABLED = "1";
    process.env.QUOTE_TEST_MODE = "0";
    process.env.QUOTE_DATA_DIR = root;
    delete process.env.QUOTE_TEST_DATA_DIR;
    assert.equal(isQuoteWorkspaceEnabled(), true);
    assert.equal(isQuoteTestContour(), false);
    const validation = validateQuoteRequest(validRequest());
    assert.equal(validation.ok, true);
    const saved = await saveQuoteRequest(validation.value, null);
    assert.equal(saved.deliveryMode, "held-internal-outbox");
    const stored = JSON.parse((await readFile(path.join(root, "requests.jsonl"), "utf8")).trim());
    assert.equal(stored.id, saved.id);
    assert.deepEqual(stored.delivery, { mode:"held-internal-outbox", email:false, max:false, crm:false });
    assert.doesNotMatch(JSON.stringify(stored), /smtp|telegram\.org|api\.max|crm\./iu);
    const outbox = JSON.parse((await readFile(path.join(root, "request-intake-outbox.jsonl"), "utf8")).trim());
    assert.deepEqual(outbox, {
      id:`INTAKE-${saved.id}`,
      requestId:saved.id,
      createdAt:saved.createdAt,
      requestType:"quick_order",
      status:"held",
      transport:"pending-production-adapter",
      channels:["email", "max", "crm"],
      deliveryEnabled:false,
      attempts:0,
    });
    assert.doesNotMatch(JSON.stringify(outbox), /\+7|@|phone|emailFull|company/iu);

    const duplicate = await saveQuoteRequest(validation.value, null);
    assert.equal(duplicate.duplicate, true);
    assert.equal((await readFile(path.join(root, "request-intake-outbox.jsonl"), "utf8")).trim().split("\n").length, 1);
  } finally {
    restoreEnv(previous);
    await rm(root, { recursive:true, force:true });
  }
});

test("production request API accepts a same-origin form without enabling the test contour", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "7tool-production-api-"));
  const previous = snapshotEnv(["QUOTE_WORKSPACE_ENABLED", "QUOTE_TEST_MODE", "QUOTE_DATA_DIR", "QUOTE_TEST_DATA_DIR"]);
  try {
    process.env.QUOTE_WORKSPACE_ENABLED = "1";
    process.env.QUOTE_TEST_MODE = "0";
    process.env.QUOTE_DATA_DIR = root;
    delete process.env.QUOTE_TEST_DATA_DIR;
    const form = new FormData();
    const input = validRequest();
    form.set("request_type", input.requestType);
    form.set("email", input.email);
    form.set("phone", input.phone);
    form.set("company", input.company);
    form.set("city", input.city);
    form.set("comment", input.comment);
    form.set("billing_inn", input.billingInn);
    form.set("idempotency_key", input.idempotencyKey);
    form.set("website", "");
    form.set("consent", "on");
    form.set("alternatives", "on");
    form.set("check_availability", "on");
    form.set("check_set", "on");
    form.set("check_docs", "on");
    form.set("items", JSON.stringify(input.items));
    form.set("source", JSON.stringify(input.source));
    const response = await createQuoteRequest(new Request("https://7tool.ru/api/quote-requests", { method:"POST", body:form, headers:{ Origin:"https://7tool.ru", "X-Forwarded-For":"127.0.0.61" } }));
    assert.equal(response.status, 201);
    const payload = await response.json();
    assert.equal(payload.ok, true);
    assert.equal(payload.delivery, "held-internal-outbox");
    assert.match(payload.requestNumber, /^7T-\d{8}-[A-F0-9]{6}$/u);
  } finally {
    restoreEnv(previous);
    await rm(root, { recursive:true, force:true });
  }
});

test("legacy isolated test contour remains compatible and explicit", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "7tool-test-request-"));
  const previous = snapshotEnv(["QUOTE_WORKSPACE_ENABLED", "QUOTE_TEST_MODE", "QUOTE_DATA_DIR", "QUOTE_TEST_DATA_DIR"]);
  try {
    delete process.env.QUOTE_WORKSPACE_ENABLED;
    process.env.QUOTE_TEST_MODE = "1";
    delete process.env.QUOTE_DATA_DIR;
    process.env.QUOTE_TEST_DATA_DIR = root;
    assert.equal(isQuoteWorkspaceEnabled(), true);
    assert.equal(isQuoteTestContour(), true);
    const validation = validateQuoteRequest(validRequest());
    assert.equal(validation.ok, true);
    const saved = await saveQuoteRequest(validation.value, null);
    assert.equal(saved.deliveryMode, "disabled-test-contour");
  } finally {
    restoreEnv(previous);
    await rm(root, { recursive:true, force:true });
  }
});

test("production entrypoints enforce preflight, exec Vinext directly and contain no embedded credentials", async () => {
  const [packageJson, ecosystem, preflight, productionShell] = await Promise.all([
    readFile(new URL("../package.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../ecosystem.production.config.cjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/validate-production-config.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/start-production.sh", import.meta.url), "utf8"),
  ]);
  assert.equal(packageJson.scripts["validate:production"], "node scripts/validate-production-config.mjs");
  assert.equal(packageJson.scripts["start:production"], "sh scripts/start-production.sh");
  assert.match(ecosystem, /script: "scripts\/start-production\.sh"/u);
  assert.match(ecosystem, /interpreter: "\/bin\/sh"/u);
  assert.match(ecosystem, /max_memory_restart: "1280M"/u);
  assert.match(productionShell, /node scripts\/validate-production-config\.mjs/u);
  assert.match(productionShell, /exec node node_modules\/vinext\/dist\/cli\.js start/u);
  assert.doesNotMatch(`${ecosystem}\n${preflight}\n${productionShell}`, /MANAGER_AUTH_LOCAL_PASSWORD_HASH:\s*["'][^"']+/u);
  assert.doesNotMatch(`${preflight}\n${productionShell}`, /sendMail|smtp|telegram\.org|api\.max|crm\./iu);
});

function productionEnv({ quoteDir, catalogPath, metadataPath }) {
  const salt = randomBytes(18).toString("base64url");
  const digest = randomBytes(32).toString("base64url");
  return {
    NODE_ENV:"production",
    PORT:"3100",
    QUOTE_WORKSPACE_ENABLED:"1",
    QUOTE_TEST_MODE:"0",
    QUOTE_DATA_DIR:quoteDir,
    SEO_INDEXING_ENABLED:"1",
    MANAGER_AUTH_LOCAL_HOSTS:"7tool.ru,www.7tool.ru",
    MANAGER_AUTH_LOCAL_USERNAME:"production-admin",
    MANAGER_AUTH_LOCAL_PASSWORD_HASH:`pbkdf2-sha256$310000$${salt}$${digest}`,
    MANAGER_AUTH_TEST_HOSTS:"",
    SHIPPING_TIME_ZONE:"Europe/Moscow",
    SHIPPING_TODAY_ENABLED:"1",
    SHIPPING_CUTOFF_HOUR:"18",
    SHIPPING_WORKING_DAYS:"1,2,3,4,5",
    SHIPPING_FEED_MAX_AGE_MINUTES:"1560",
    CATALOG_FEED_PATH:catalogPath,
    CATALOG_SNAPSHOT_META_PATH:metadataPath,
  };
}

function validRequest() {
  return {
    requestType:"quick_order",
    email:"",
    phone:"+7 900 000-00-00",
    company:"",
    city:"",
    comment:"Production readiness fixture",
    billingInn:"",
    idempotencyKey:randomUUID(),
    website:"",
    consent:"on",
    alternatives:"on",
    checkAvailability:"on",
    checkSet:"on",
    checkDocs:"on",
    items:[{ id:"variant:A9409", title:"LENZ STEYR-35", article:"STEYR-35", quantity:1, href:"/product/magnitnyy-sverlilnyy-stanok-lenz-steyr-35?variant=A9409" }],
    source:{ pagePath:"/product/magnitnyy-sverlilnyy-stanok-lenz-steyr-35", utmSource:"", utmMedium:"", utmCampaign:"" },
  };
}

function snapshotEnv(names) {
  return Object.fromEntries(names.map((name) => [name, process.env[name]]));
}

function restoreEnv(snapshot) {
  for (const [name, value] of Object.entries(snapshot)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}
