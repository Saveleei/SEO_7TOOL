import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createMemoryRateLimiter, isValidRussianInn, validateQuoteAttachment, validateQuoteRequest } from "../app/data/quoteRequestValidation.mjs";
import { listQuoteRequestSummaries, saveQuoteRequest } from "../app/data/quoteRequestStore.ts";

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
  const invalid = validateQuoteRequest({ ...validInput, email:"bad", phone:"123", consent:"", items:[], idempotencyKey:"bad" });
  assert.equal(invalid.ok, false);
  assert.deepEqual(Object.keys(invalid.fieldErrors).sort(), ["consent", "email", "items", "phone", "request"]);
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
    assert.equal(summaries[0].email, "bu***@example.test");
    assert.equal(summaries[0].phone, "+7 *** ***-0000");
    assert.equal(summaries[0].billingProvided, true);
  } finally {
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
