const SUPPLY_STATUSES = ["confirmed", "supplier_confirmed", "to_order", "unknown"];
const STAMP_ASSET_PATTERN = /^[0-9a-f]{64}\.(?:png|jpg|webp)$/u;

export const DEFAULT_QUOTE_SENDER = Object.freeze({
  name:"Евгений Савельев",
  role:"Персональный менеджер 7TOOL",
  phone:"+7 (962) 611-24-19",
  email:"info@7tool.ru",
});

export function validateQuoteDraft(input, requestItems) {
  const idempotencyKey = text(input?.idempotencyKey, 64);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(idempotencyKey)) return fail("Обновите страницу и повторите сохранение.");
  const status = text(input?.status, 20);
  if (!["draft", "ready"].includes(status)) return fail("Некорректный статус предложения.");
  const validityDays = integer(input?.validityDays, 1, 90);
  if (validityDays == null) return fail("Срок действия предложения должен быть от 1 до 90 дней.");
  const vatRate = Number(input?.vatRate);
  if (![0, 10, 22].includes(vatRate)) return fail("Выберите корректную ставку НДС.");
  const paymentTerms = text(input?.paymentTerms, 300);
  const deliveryTerms = text(input?.deliveryTerms, 300);
  const managerComment = multiline(input?.managerComment, 1000);
  const sender = {
    name:text(input?.sender?.name ?? DEFAULT_QUOTE_SENDER.name, 100),
    role:text(input?.sender?.role ?? DEFAULT_QUOTE_SENDER.role, 120),
    phone:text(input?.sender?.phone ?? DEFAULT_QUOTE_SENDER.phone, 50),
    email:text(input?.sender?.email ?? DEFAULT_QUOTE_SENDER.email, 160).toLocaleLowerCase("ru-RU"),
  };
  if (sender.name.length < 2 || sender.role.length < 2 || !/^\+?[\d\s()+-]{7,50}$/u.test(sender.phone) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(sender.email)) return fail("Проверьте данные отправителя КП.");
  const stampAssetId = text(input?.stampAssetId, 80).toLocaleLowerCase("ru-RU");
  if (stampAssetId && !STAMP_ASSET_PATTERN.test(stampAssetId)) return fail("Файл печати и подписи указан некорректно.");
  const includeStamp = input?.includeStamp === true;
  if (includeStamp && !stampAssetId) return fail("Загрузите утверждённый файл печати и подписи или отключите его показ.");
  if (status === "ready" && (paymentTerms.length < 3 || deliveryTerms.length < 3)) return fail("Для готового КП заполните условия оплаты и поставки.");

  if (!Array.isArray(input?.items) || input.items.length !== requestItems.length) return fail("Состав предложения должен совпадать с заявкой.");
  const requestById = new Map(requestItems.map((item) => [item.id, item]));
  const seen = new Set();
  const items = [];
  for (const raw of input.items) {
    const id = text(raw?.id, 180);
    const source = requestById.get(id);
    if (!source || seen.has(id)) return fail("Состав предложения изменён некорректно.");
    seen.add(id);
    const quantity = integer(raw?.quantity, 1, 10000);
    const unitPriceRub = money(raw?.unitPriceRub);
    const discountPercent = numberInRange(raw?.discountPercent, 0, 90);
    const supplyStatus = text(raw?.supplyStatus, 30);
    const shipmentText = text(raw?.shipmentText, 120);
    if (quantity == null || unitPriceRub == null || discountPercent == null || !SUPPLY_STATUSES.includes(supplyStatus) || shipmentText.length < 2) return fail("Проверьте количество, цену, скидку, наличие и срок по каждой позиции.");
    if (status === "ready" && (unitPriceRub <= 0 || supplyStatus === "unknown")) return fail("Для готового КП подтвердите цену и статус поставки каждой позиции.");
    const lineTotalRub = roundMoney(quantity * unitPriceRub * (1 - discountPercent / 100));
    items.push({ id, title:source.title, article:source.article, quantity, unitPriceRub, discountPercent, supplyStatus, shipmentText, lineTotalRub });
  }

  const totalRub = roundMoney(items.reduce((sum, item) => sum + item.lineTotalRub, 0));
  const vatIncludedRub = vatRate ? roundMoney(totalRub * vatRate / (100 + vatRate)) : 0;
  return { ok:true, value:{ idempotencyKey, status, validityDays, vatRate, paymentTerms, deliveryTerms, managerComment, sender, stampAssetId, includeStamp, items, totalRub, vatIncludedRub } };
}

export function parsePriceRub(value) {
  const normalized = String(value ?? "").replace(/[^\d,.-]/gu, "").replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? roundMoney(amount) : 0;
}

export function supplyStatusLabel(value) {
  return ({ confirmed:"В наличии подтверждено", supplier_confirmed:"Подтверждено поставщиком", to_order:"Под заказ", unknown:"Требует подтверждения" })[value] || "Требует подтверждения";
}

function money(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 100_000_000 ? roundMoney(number) : null;
}

function numberInRange(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? Math.round(number * 100) / 100 : null;
}

function integer(value, min, max) {
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max ? number : null;
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function text(value, max) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/gu, " ").replace(/\s+/gu, " ").trim().slice(0, max);
}

function multiline(value, max) {
  return String(value ?? "").replace(/\r\n?/gu, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, "").trim().slice(0, max);
}

function fail(message) {
  return { ok:false, message };
}
