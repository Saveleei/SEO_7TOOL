import { Buffer } from "node:buffer";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const ALLOWED_ATTACHMENT_TYPES = new Map([
  ["application/pdf", { extension:"pdf", signature:(bytes) => bytes.subarray(0, 4).toString("ascii") === "%PDF" }],
  ["image/png", { extension:"png", signature:(bytes) => bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) }],
  ["image/jpeg", { extension:"jpg", signature:(bytes) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff }],
]);

export const MAX_QUOTE_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export function validateQuoteRequest(input) {
  const fieldErrors = {};
  const email = cleanText(input.email, 254);
  const phone = cleanText(input.phone, 40);
  const phoneDigits = phone.replace(/\D/g, "");
  const company = cleanText(input.company, 160);
  const city = cleanText(input.city, 120);
  const comment = cleanText(input.comment, 2000);
  const billingInn = cleanText(input.billingInn, 12).replace(/\s/g, "");
  const idempotencyKey = cleanText(input.idempotencyKey, 64);
  const website = cleanText(input.website, 200);
  const consent = toBoolean(input.consent);
  const items = sanitizeQuoteItems(input.items);

  if (!EMAIL_PATTERN.test(email) || /[\r\n]/u.test(email)) fieldErrors.email = "Укажите корректный email для КП.";
  if (phoneDigits.length < 10 || phoneDigits.length > 15) fieldErrors.phone = "Укажите телефон с кодом города или мобильного оператора.";
  if (!consent) fieldErrors.consent = "Нужно согласие на обработку персональных данных.";
  if (!idempotencyKey || !UUID_PATTERN.test(idempotencyKey)) fieldErrors.request = "Обновите страницу и повторите отправку.";
  if (website) fieldErrors.request = "Заявка отклонена защитой от автоматической отправки.";
  if (items.length === 0) fieldErrors.items = "Добавьте хотя бы одну позицию в запрос КП.";
  if (billingInn && !isValidRussianInn(billingInn)) fieldErrors.billingInn = "Проверьте ИНН: требуется корректный ИНН из 10 или 12 цифр.";

  if (Object.keys(fieldErrors).length > 0) return { ok:false, message:Object.values(fieldErrors)[0], fieldErrors };

  return {
    ok:true,
    value:{
      email,
      phone,
      company,
      city,
      comment,
      billingInn,
      idempotencyKey,
      consent,
      alternatives:toBoolean(input.alternatives),
      requestedChecks:{
        availability:toBoolean(input.checkAvailability),
        compatibility:toBoolean(input.checkSet),
        documents:toBoolean(input.checkDocs),
      },
      source:sanitizeSource(input.source),
      items,
    },
  };
}

export async function validateQuoteAttachment(file) {
  if (!file || typeof file.arrayBuffer !== "function" || Number(file.size) === 0) return { ok:true, value:null };
  if (Number(file.size) > MAX_QUOTE_ATTACHMENT_BYTES) return { ok:false, message:"Файл реквизитов больше 10 МБ." };
  const definition = ALLOWED_ATTACHMENT_TYPES.get(String(file.type).toLocaleLowerCase("en-US"));
  if (!definition) return { ok:false, message:"Карточка организации должна быть в PDF, JPG или PNG." };
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!definition.signature(bytes)) return { ok:false, message:"Содержимое файла не соответствует заявленному формату." };
  return { ok:true, value:{ bytes, extension:definition.extension, mime:String(file.type).toLocaleLowerCase("en-US"), size:bytes.length } };
}

export function isValidRussianInn(value) {
  if (!/^\d{10}$|^\d{12}$/u.test(value)) return false;
  const digits = [...value].map(Number);
  if (digits.length === 10) return checksum(digits, [2, 4, 10, 3, 5, 9, 4, 6, 8]) === digits[9];
  return checksum(digits, [7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === digits[10]
    && checksum(digits, [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === digits[11];
}

export function createMemoryRateLimiter({ limit = 8, windowMs = 10 * 60 * 1000, now = () => Date.now() } = {}) {
  const buckets = new Map();
  return {
    check(key) {
      const current = now();
      const bucket = (buckets.get(key) || []).filter((timestamp) => current - timestamp < windowMs);
      if (bucket.length >= limit) return { allowed:false, retryAfterSeconds:Math.max(1, Math.ceil((windowMs - (current - bucket[0])) / 1000)) };
      bucket.push(current);
      buckets.set(key, bucket);
      return { allowed:true, retryAfterSeconds:0 };
    },
  };
}

function sanitizeQuoteItems(rawItems) {
  if (!Array.isArray(rawItems)) return [];
  return rawItems.slice(0, 50).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const id = cleanText(item.id, 140);
    const title = cleanText(item.title, 300);
    const article = cleanText(item.article, 140);
    if (!id || !title || !article) return [];
    const quantity = Math.min(999, Math.max(1, Number.parseInt(String(item.quantity ?? 1), 10) || 1));
    const price = cleanText(item.price, 80);
    const href = cleanText(item.href, 500);
    return [{ id, title, article, quantity, ...(price ? { price } : {}), ...(href.startsWith("/") && !href.startsWith("//") ? { href } : {}) }];
  });
}

function sanitizeSource(rawSource) {
  const source = rawSource && typeof rawSource === "object" ? rawSource : {};
  const pagePath = cleanText(source.pagePath, 500);
  return {
    pagePath:pagePath.startsWith("/") && !pagePath.startsWith("//") ? pagePath : "/",
    utmSource:cleanText(source.utmSource, 100),
    utmMedium:cleanText(source.utmMedium, 100),
    utmCampaign:cleanText(source.utmCampaign, 160),
  };
}

function cleanText(value, maxLength) {
  return String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, "").trim().slice(0, maxLength);
}

function toBoolean(value) {
  return value === true || value === "true" || value === "on" || value === "1";
}

function checksum(digits, coefficients) {
  return coefficients.reduce((sum, coefficient, index) => sum + coefficient * digits[index], 0) % 11 % 10;
}
