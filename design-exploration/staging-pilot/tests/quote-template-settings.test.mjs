import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { GET as getSettings, PUT as putSettings } from "../app/api/quote-settings/route.ts";
import { readQuoteStampAsset, saveQuoteTemplateStampAsset } from "../app/data/quoteAssetStore.ts";
import { getLatestQuoteDraft, getQuoteDraftOrDefault, saveQuoteDraft } from "../app/data/quoteDraftStore.ts";
import { saveQuoteRequest } from "../app/data/quoteRequestStore.ts";
import { validateQuoteRequest } from "../app/data/quoteRequestValidation.mjs";
import { DEFAULT_QUOTE_TEMPLATE_SETTINGS, getQuoteTemplateSettings, saveQuoteTemplateSettings } from "../app/data/quoteTemplateStore.ts";
import { validateQuoteTemplateSettings } from "../app/data/quoteTemplateValidation.mjs";

const onePixelPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
const requestItem = { id:"variant:A9409", title:"Магнитный сверлильный станок LENZ STEYR-35", article:"STEYR-35", quantity:1, price:"47 999 ₽" };
const readyDraft = {
  idempotencyKey:uuid("501"), status:"ready", validityDays:10, vatRate:22,
  paymentTerms:"Оплата по счёту после согласования", deliveryTerms:"Доставка рассчитывается отдельно", managerComment:"",
  sender:{ name:"Евгений Савельев", role:"Персональный менеджер 7TOOL", phone:"+7 (962) 611-24-19", email:"info@7tool.ru" },
  stampAssetId:"", includeStamp:false,
  items:[{ ...requestItem, unitPriceRub:47999, discountPercent:0, supplyStatus:"supplier_confirmed", shipmentText:"Отгрузка в течение 5 рабочих дней" }],
};

test("template settings validate complete identities and reject unsafe partial data", () => {
  const valid = cloneDefaults();
  assert.equal(validateQuoteTemplateSettings(valid).ok, true);
  assert.equal(validateQuoteTemplateSettings({ ...valid, seller:{ ...valid.seller, website:"http://7tool.ru" } }).ok, false);
  assert.equal(validateQuoteTemplateSettings({ ...valid, seller:{ ...valid.seller, inn:"1234567890" } }).ok, false);
  assert.equal(validateQuoteTemplateSettings({ ...valid, document:{ ...valid.document, showBankDetails:true } }).ok, false);
  assert.equal(validateQuoteTemplateSettings({ ...valid, senders:[valid.senders[0], valid.senders[0]] }).ok, false);
  const withBank = { ...valid, seller:{ ...valid.seller, bankName:"Тестовый банк", bik:"044525225", checkingAccount:"40702810000000000001", correspondentAccount:"30101810000000000225" }, document:{ ...valid.document, showBankDetails:true } };
  assert.equal(validateQuoteTemplateSettings(withBank).ok, true);
});

test("settings persist atomically and use optimistic revision checks", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "7tool-quote-settings-"));
  try {
    assert.equal((await getQuoteTemplateSettings({ dataDir })).revision, 0);
    const first = await saveQuoteTemplateSettings(templateInput("ООО «Первый поставщик»"), { dataDir, now:"2026-09-12T10:00:00.000Z" });
    assert.equal(first.revision, 1);
    assert.equal((await getQuoteTemplateSettings({ dataDir })).seller.legalName, "ООО «Первый поставщик»");
    await assert.rejects(() => saveQuoteTemplateSettings(templateInput("ООО «Устаревшая вкладка»"), { dataDir }), /другой вкладке/u);
    const stored = await readFile(path.join(dataDir, "settings", "quote-template.json"), "utf8");
    assert.doesNotMatch(stored, /Устаревшая вкладка/u);
  } finally {
    await rm(dataDir, { recursive:true, force:true });
  }
});

test("new quotes snapshot settings while historical revisions stay unchanged", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "7tool-quote-snapshot-"));
  try {
    const firstSettings = await saveQuoteTemplateSettings({ ...templateInput("ООО «Поставщик А»"), document:{ ...DEFAULT_QUOTE_TEMPLATE_SETTINGS.document, title:"Предложение А", footerText:"Условия версии А." } }, { dataDir });
    const firstRequest = await createRequest(dataDir, "510", "first@example.test");
    const initial = await getQuoteDraftOrDefault(firstRequest.id, { dataDir });
    assert.equal(initial.seller.legalName, "ООО «Поставщик А»");
    assert.equal(initial.document.title, "Предложение А");
    const saved = await saveQuoteDraft(firstRequest.id, readyDraft, { dataDir });
    await saveQuoteTemplateSettings({ ...templateInput("ООО «Поставщик Б»"), revision:firstSettings.revision, document:{ ...DEFAULT_QUOTE_TEMPLATE_SETTINGS.document, title:"Предложение Б", footerText:"Условия версии Б." } }, { dataDir });
    assert.equal((await getLatestQuoteDraft(firstRequest.id, { dataDir })).seller.legalName, "ООО «Поставщик А»");
    assert.equal(saved.draft.document.title, "Предложение А");
    const secondRequest = await createRequest(dataDir, "511", "second@example.test");
    assert.equal((await getQuoteDraftOrDefault(secondRequest.id, { dataDir })).seller.legalName, "ООО «Поставщик Б»");
  } finally {
    await rm(dataDir, { recursive:true, force:true });
  }
});

test("one reusable stamp is signature-checked and available to new quote revisions", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "7tool-template-stamp-"));
  try {
    await assert.rejects(() => saveQuoteTemplateStampAsset(new File(["<svg></svg>"], "stamp.svg", { type:"image/png" }), { dataDir }), /PNG, JPG или WebP/u);
    const asset = await saveQuoteTemplateStampAsset(new File([onePixelPng], "stamp.png", { type:"image/png" }), { dataDir });
    assert.match(asset.assetId, /^template-[0-9a-f]{64}\.png$/u);
    await saveQuoteTemplateSettings({ ...templateInput("ООО «Поставщик с печатью»"), stampAssetId:asset.assetId, includeStampByDefault:true }, { dataDir });
    const request = await createRequest(dataDir, "512", "stamp@example.test");
    const initial = await getQuoteDraftOrDefault(request.id, { dataDir });
    assert.equal(initial.stampAssetId, asset.assetId);
    assert.equal(initial.includeStamp, true);
    const restored = await readQuoteStampAsset(request.id, asset.assetId, { dataDir });
    assert.equal(restored.bytes.equals(onePixelPng), true);
    const saved = await saveQuoteDraft(request.id, { ...readyDraft, idempotencyKey:uuid("513"), stampAssetId:asset.assetId, includeStamp:true }, { dataDir });
    assert.equal(saved.draft.stampAssetId, asset.assetId);
  } finally {
    await rm(dataDir, { recursive:true, force:true });
  }
});

test("settings API is local-only, same-origin and contains no delivery integration", async () => {
  const previousMode = process.env.QUOTE_TEST_MODE;
  const previousDataDir = process.env.QUOTE_TEST_DATA_DIR;
  const previousAdmins = process.env.MANAGER_AUTH_ADMIN_EMAILS;
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "7tool-settings-api-"));
  try {
    process.env.QUOTE_TEST_MODE = "0";
    assert.equal((await getSettings(new Request("http://local.test/api/quote-settings"))).status, 503);
    process.env.QUOTE_TEST_MODE = "1";
    process.env.QUOTE_TEST_DATA_DIR = dataDir;
    process.env.MANAGER_AUTH_ADMIN_EMAILS = "admin@example.test";
    assert.equal((await getSettings(new Request("http://local.test/api/quote-settings"))).status, 401);
    assert.equal((await getSettings(new Request("http://local.test/api/quote-settings", { headers:staffHeaders() }))).status, 200);
    const crossOrigin = await putSettings(new Request("http://local.test/api/quote-settings", { method:"PUT", headers:staffHeaders("https://attacker.example", true), body:JSON.stringify(cloneDefaults()) }));
    assert.equal(crossOrigin.status, 403);
    const sameOrigin = await putSettings(new Request("http://local.test/api/quote-settings", { method:"PUT", headers:staffHeaders("http://local.test", true), body:JSON.stringify(templateInput("ООО «Локальный поставщик»")) }));
    assert.equal(sameOrigin.status, 200);
    assert.equal((await sameOrigin.json()).settings.revision, 1);
    assert.equal((await getQuoteTemplateSettings({ dataDir })).seller.legalName, "ООО «Локальный поставщик»");
    const api = await readFile(new URL("../app/api/quote-settings/route.ts", import.meta.url), "utf8");
    const stampApi = await readFile(new URL("../app/api/quote-settings/stamp/route.ts", import.meta.url), "utf8");
    const form = await readFile(new URL("../app/ui/QuoteTemplateSettingsForm.tsx", import.meta.url), "utf8");
    assert.match(api, /isQuoteTestModeEnabled/u);
    assert.match(api, /origin !== requestUrl\.origin/u);
    assert.match(form, /Настройки действуют только для новых КП/u);
    assert.doesNotMatch(`${api}\n${stampApi}\n${form}`, /sendMail|smtp|crm\.|fetch\(["']https/iu);
  } finally {
    if (previousMode === undefined) delete process.env.QUOTE_TEST_MODE; else process.env.QUOTE_TEST_MODE = previousMode;
    if (previousDataDir === undefined) delete process.env.QUOTE_TEST_DATA_DIR; else process.env.QUOTE_TEST_DATA_DIR = previousDataDir;
    if (previousAdmins === undefined) delete process.env.MANAGER_AUTH_ADMIN_EMAILS; else process.env.MANAGER_AUTH_ADMIN_EMAILS = previousAdmins;
    await rm(dataDir, { recursive:true, force:true });
  }
});

function templateInput(legalName) {
  const settings = cloneDefaults();
  return { ...settings, seller:{ ...settings.seller, legalName } };
}

function staffHeaders(origin = "http://local.test", json = false) {
  return { origin, ...(json ? { "content-type":"application/json" } : {}), "oai-authenticated-user-id":"admin-1", "oai-authenticated-user-email":"admin@example.test" };
}

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_QUOTE_TEMPLATE_SETTINGS));
}

async function createRequest(dataDir, suffix, email) {
  const validation = validateQuoteRequest({ email, phone:"+7 900 000-22-33", company:"Тестовый завод", city:"Тула", comment:"", billingInn:"", idempotencyKey:uuid(suffix), website:"", consent:"on", alternatives:"on", checkAvailability:"on", checkSet:"on", checkDocs:"on", source:{ pagePath:"/search", utmSource:"", utmMedium:"", utmCampaign:"" }, items:[requestItem] });
  assert.equal(validation.ok, true);
  return saveQuoteRequest(validation.value, null, { dataDir });
}

function uuid(suffix) {
  return `123e4567-e89b-42d3-a456-426614174${suffix}`;
}
