import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createMemoryRateLimiter, isValidRussianInn, validateQuoteAttachment, validateQuoteRequest, validateSpecificationAttachment } from "../app/data/quoteRequestValidation.mjs";
import { getQuoteRequestAttachment, listQuoteRequestSummaries, saveQuoteRequest } from "../app/data/quoteRequestStore.ts";
import { GET as downloadAttachment } from "../app/api/quote-requests/[id]/attachment/route.ts";

const validInput = {
  email:"buyer@example.test",
  phone:"+7 900 000-00-00",
  company:"Тестовая компания",
  city:"Москва",
  comment:"Нужна проверка поставки",
  billingInn:"7707083893",
  idempotencyKey:"123e4567-e89b-42d3-a456-426614174000",
  website:"",
  consent:"on",
  alternatives:"on",
  checkAvailability:"on",
  checkSet:"on",
  checkDocs:"on",
  source:{ pagePath:"/product/test", utmSource:"qa", utmMedium:"local", utmCampaign:"backend" },
  items:[{ id:"variant:A9409", title:"LENZ STEYR-35", article:"Артикул STEYR-35", price:"47 999 ₽", quantity:1, href:"/product/test" }],
};

test("server validation requires usable contacts, consent, items and idempotency", () => {
  const valid = validateQuoteRequest(validInput);
  assert.equal(valid.ok, true);
  assert.equal(valid.value.requestType, "quote");
  const invalid = validateQuoteRequest({ ...validInput, email:"bad", phone:"123", consent:"", items:[], idempotencyKey:"bad" });
  assert.equal(invalid.ok, false);
  assert.deepEqual(Object.keys(invalid.fieldErrors).sort(), ["consent", "email", "items", "phone", "request"]);
});

test("selection requests require a phone but do not invent an email address", () => {
  const selection = validateQuoteRequest({ ...validInput, requestType:"selection", email:"", comment:"Подбор по производственной задаче" });
  assert.equal(selection.ok, true);
  assert.equal(selection.value.requestType, "selection");
  assert.equal(selection.value.email, "");
  assert.equal(validateQuoteRequest({ ...validInput, email:"" }).ok, false);
  assert.equal(validateQuoteRequest({ ...validInput, requestType:"selection", email:"bad" }).ok, false);
});

test("quick orders accept a phone-only contact but keep server validation", () => {
  const quickOrder = validateQuoteRequest({ ...validInput, requestType:"quick_order", email:"", company:"", city:"" });
  assert.equal(quickOrder.ok, true);
  assert.equal(quickOrder.value.requestType, "quick_order");
  assert.equal(quickOrder.value.email, "");
  assert.equal(validateQuoteRequest({ ...validInput, requestType:"quick_order", email:"", phone:"123" }).ok, false);
  assert.equal(validateQuoteRequest({ ...validInput, requestType:"quick_order", email:"bad" }).ok, false);
});

test("Russian INN checksum is validated instead of accepting digit count only", () => {
  assert.equal(isValidRussianInn("7707083893"), true);
  assert.equal(isValidRussianInn("7707083894"), false);
  assert.equal(isValidRussianInn("123456789012"), false);
});

test("requisites attachments are bounded and checked by content signature", async () => {
  const pdf = new File([Buffer.from("%PDF-1.7\nlocal test")], "card.pdf", { type:"application/pdf" });
  const valid = await validateQuoteAttachment(pdf);
  assert.equal(valid.ok, true);
  assert.equal(valid.value.extension, "pdf");
  const disguised = new File([Buffer.from("not a pdf")], "card.pdf", { type:"application/pdf" });
  assert.deepEqual(await validateQuoteAttachment(disguised), { ok:false, message:"Содержимое файла не соответствует заявленному формату." });
});

test("technical specifications accept checked business formats and reject disguised files", async () => {
  const docxBytes = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("word/document.xml")]);
  const docx = new File([docxBytes], "ТЗ станки.docx", { type:"application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  const valid = await validateSpecificationAttachment(docx);
  assert.equal(valid.ok, true);
  assert.equal(valid.value.kind, "specification");
  assert.equal(valid.value.originalName, "ТЗ станки.docx");
  const disguised = new File([Buffer.from("not an office document")], "ТЗ.docx", { type:"application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  assert.equal((await validateSpecificationAttachment(disguised)).ok, false);
  assert.equal((await validateSpecificationAttachment(null)).ok, false);
});

test("rate limiter returns a retry window without storing request content", () => {
  let now = 1000;
  const limiter = createMemoryRateLimiter({ limit:2, windowMs:1000, now:() => now });
  assert.equal(limiter.check("client").allowed, true);
  assert.equal(limiter.check("client").allowed, true);
  assert.equal(limiter.check("client").allowed, false);
  now = 2100;
  assert.equal(limiter.check("client").allowed, true);
});

test("a request is durably appended before confirmation and duplicate retries reuse its number", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "7tool-quote-test-"));
  try {
    const validation = validateQuoteRequest(validInput);
    assert.equal(validation.ok, true);
    const first = await saveQuoteRequest(validation.value, null, { dataDir });
    const retry = await saveQuoteRequest(validation.value, null, { dataDir });
    assert.equal(first.duplicate, false);
    assert.equal(retry.duplicate, true);
    assert.equal(retry.id, first.id);
    const storedContent = await readFile(path.join(dataDir, "requests.jsonl"), "utf8");
    assert.match(storedContent, new RegExp(first.id));
    assert.doesNotMatch(storedContent, /123e4567-e89b-42d3-a456-426614174000/u);
    assert.doesNotMatch(storedContent, /"idempotencyKey"/u);
    const summaries = await listQuoteRequestSummaries(10, { dataDir });
    assert.equal(summaries.length, 1);
    assert.equal(summaries[0].requestType, "quote");
    assert.equal(summaries[0].email, "bu***@example.test");
    assert.equal(summaries[0].phone, "+7 *** ***-0000");
    assert.equal(summaries[0].billingProvided, true);
  } finally {
    await rm(dataDir, { recursive:true, force:true });
  }
});

test("a specification stays attached to a selection request without masquerading as billing details", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "7tool-specification-test-"));
  try {
    const validation = validateQuoteRequest({ ...validInput, requestType:"selection", email:"", billingInn:"", items:[{ id:"selection:specification", title:"Разбор технического задания", article:"Файл приложен к заявке", quantity:1, href:"/catalog" }] });
    assert.equal(validation.ok, true);
    const file = new File([Buffer.from("%PDF-1.7\nlocal specification")], "ТЗ на линию.pdf", { type:"application/pdf" });
    const attachment = await validateSpecificationAttachment(file);
    assert.equal(attachment.ok, true);
    const saved = await saveQuoteRequest(validation.value, attachment.value, { dataDir });
    assert.equal(saved.billingProvided, false);
    const stored = await getQuoteRequestAttachment(saved.id, { dataDir });
    assert.equal(stored.kind, "specification");
    assert.equal(stored.originalName, "ТЗ на линию.pdf");
    assert.match(stored.bytes.toString("utf8"), /local specification/u);
    const summaries = await listQuoteRequestSummaries(10, { dataDir });
    assert.equal(summaries[0].billingProvided, false);
  } finally {
    await rm(dataDir, { recursive:true, force:true });
  }
});

test("only an authorized employee can download the stored specification", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "7tool-specification-download-"));
  const previousMode = process.env.QUOTE_TEST_MODE;
  const previousDataDir = process.env.QUOTE_TEST_DATA_DIR;
  const previousManagers = process.env.MANAGER_AUTH_MANAGER_EMAILS;
  try {
    process.env.QUOTE_TEST_MODE = "1";
    process.env.QUOTE_TEST_DATA_DIR = dataDir;
    process.env.MANAGER_AUTH_MANAGER_EMAILS = "manager@example.test";
    const validation = validateQuoteRequest({ ...validInput, requestType:"selection", email:"", billingInn:"", items:[{ id:"selection:specification", title:"Разбор технического задания", article:"Файл приложен к заявке", quantity:1, href:"/catalog" }] });
    const file = new File([Buffer.from("%PDF-1.7\nprotected specification")], "ТЗ защищённое.pdf", { type:"application/pdf" });
    const attachment = await validateSpecificationAttachment(file);
    assert.equal(validation.ok, true);
    assert.equal(attachment.ok, true);
    const saved = await saveQuoteRequest(validation.value, attachment.value, { dataDir });
    const context = { params:Promise.resolve({ id:saved.id }) };
    assert.equal((await downloadAttachment(new Request(`http://local.test/api/quote-requests/${saved.id}/attachment`), context)).status, 401);
    const response = await downloadAttachment(new Request(`http://local.test/api/quote-requests/${saved.id}/attachment`, { headers:{ "oai-authenticated-user-id":"manager-1", "oai-authenticated-user-email":"manager@example.test" } }), context);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "application/pdf");
    assert.match(response.headers.get("content-disposition") ?? "", /attachment; filename="7TOOL-specification\.pdf"/u);
    assert.match(response.headers.get("content-disposition") ?? "", /%D0%A2%D0%97/u);
    assert.match(Buffer.from(await response.arrayBuffer()).toString("utf8"), /protected specification/u);
  } finally {
    if (previousMode === undefined) delete process.env.QUOTE_TEST_MODE; else process.env.QUOTE_TEST_MODE = previousMode;
    if (previousDataDir === undefined) delete process.env.QUOTE_TEST_DATA_DIR; else process.env.QUOTE_TEST_DATA_DIR = previousDataDir;
    if (previousManagers === undefined) delete process.env.MANAGER_AUTH_MANAGER_EMAILS; else process.env.MANAGER_AUTH_MANAGER_EMAILS = previousManagers;
    await rm(dataDir, { recursive:true, force:true });
  }
});

test("the API is opt-in and contains no external delivery call", async () => {
  const api = await readFile(new URL("../app/api/quote-requests/route.ts", import.meta.url), "utf8");
  const store = await readFile(new URL("../app/data/quoteRequestStore.ts", import.meta.url), "utf8");
  assert.match(api, /isQuoteTestModeEnabled\(\)/u);
  assert.match(api, /isSameOriginRequest\(request\)/u);
  assert.match(api, /status:429/u);
  assert.match(store, /mode: "disabled-test-contour"/u);
  assert.doesNotMatch(`${api}\n${store}`, /https?:\/\/|mailto:|t\.me|max\.ru/u);
});
