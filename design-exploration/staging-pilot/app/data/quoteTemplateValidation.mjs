const SENDER_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,39}$/u;
const TEMPLATE_STAMP_PATTERN = /^template-[0-9a-f]{64}\.(?:png|jpg|webp)$/u;

export function validateQuoteTemplateSettings(input) {
  const revision = integer(input?.revision, 0, Number.MAX_SAFE_INTEGER);
  if (revision == null) return fail("Обновите страницу настроек и повторите сохранение.");

  const seller = {
    brandName:text(input?.seller?.brandName, 80),
    legalName:text(input?.seller?.legalName, 180),
    inn:digits(input?.seller?.inn, 12),
    kpp:digits(input?.seller?.kpp, 9),
    ogrn:digits(input?.seller?.ogrn, 15),
    legalAddress:text(input?.seller?.legalAddress, 240),
    phone:text(input?.seller?.phone, 50),
    email:text(input?.seller?.email, 160).toLocaleLowerCase("ru-RU"),
    website:text(input?.seller?.website, 160).toLocaleLowerCase("ru-RU"),
    bankName:text(input?.seller?.bankName, 180),
    bik:digits(input?.seller?.bik, 9),
    checkingAccount:digits(input?.seller?.checkingAccount, 20),
    correspondentAccount:digits(input?.seller?.correspondentAccount, 20),
  };
  if (seller.brandName.length < 2 || seller.legalName.length < 2 || seller.legalAddress.length < 4) return fail("Заполните наименование и юридический адрес продавца.");
  if (!validPhone(seller.phone) || !validEmail(seller.email)) return fail("Проверьте телефон и email продавца.");
  if (seller.website && !/^https:\/\/[a-z0-9.-]+(?:\/[^\s]*)?$/iu.test(seller.website)) return fail("Сайт продавца должен начинаться с https://.");
  if (seller.inn && !validInn(seller.inn)) return fail("Проверьте ИНН продавца.");
  if (seller.kpp && !/^\d{9}$/u.test(seller.kpp)) return fail("КПП должен содержать 9 цифр.");
  if (seller.ogrn && !validOgrn(seller.ogrn)) return fail("Проверьте ОГРН или ОГРНИП.");
  const hasAnyBankField = Boolean(seller.bankName || seller.bik || seller.checkingAccount || seller.correspondentAccount);
  if (hasAnyBankField && (seller.bankName.length < 2 || !/^\d{9}$/u.test(seller.bik) || !/^\d{20}$/u.test(seller.checkingAccount) || !/^\d{20}$/u.test(seller.correspondentAccount))) return fail("Для банковских реквизитов заполните банк, БИК и оба 20-значных счёта.");

  if (!Array.isArray(input?.senders) || input.senders.length < 1 || input.senders.length > 8) return fail("Добавьте от одного до восьми подписантов.");
  const senderIds = new Set();
  const senders = [];
  for (const raw of input.senders) {
    const sender = {
      id:text(raw?.id, 40).toLocaleLowerCase("ru-RU"),
      name:text(raw?.name, 100),
      role:text(raw?.role, 120),
      phone:text(raw?.phone, 50),
      email:text(raw?.email, 160).toLocaleLowerCase("ru-RU"),
    };
    if (!SENDER_ID_PATTERN.test(sender.id) || senderIds.has(sender.id)) return fail("У подписантов должны быть уникальные корректные идентификаторы.");
    if (sender.name.length < 2 || sender.role.length < 2 || !validPhone(sender.phone) || !validEmail(sender.email)) return fail("Проверьте ФИО, должность, телефон и email каждого подписанта.");
    senderIds.add(sender.id);
    senders.push(sender);
  }
  const defaultSenderId = text(input?.defaultSenderId, 40).toLocaleLowerCase("ru-RU");
  if (!senderIds.has(defaultSenderId)) return fail("Выберите подписанта по умолчанию.");

  const defaults = {
    validityDays:integer(input?.defaults?.validityDays, 1, 90),
    vatRate:Number(input?.defaults?.vatRate),
    paymentTerms:multiline(input?.defaults?.paymentTerms, 300),
    deliveryTerms:multiline(input?.defaults?.deliveryTerms, 300),
    managerComment:multiline(input?.defaults?.managerComment, 1000),
  };
  if (defaults.validityDays == null || ![0, 10, 22].includes(defaults.vatRate)) return fail("Проверьте срок действия и ставку НДС.");

  const document = {
    title:text(input?.document?.title, 80),
    introText:multiline(input?.document?.introText, 500),
    footerText:multiline(input?.document?.footerText, 300),
    showBankDetails:input?.document?.showBankDetails === true,
  };
  if (document.title.length < 3 || document.footerText.length < 3) return fail("Заполните название документа и примечание внизу КП.");
  if (document.showBankDetails && !hasAnyBankField) return fail("Сначала заполните банковские реквизиты или отключите их вывод.");

  const stampAssetId = text(input?.stampAssetId, 90).toLocaleLowerCase("ru-RU");
  if (stampAssetId && !TEMPLATE_STAMP_PATTERN.test(stampAssetId)) return fail("Файл печати и подписи указан некорректно.");
  const includeStampByDefault = input?.includeStampByDefault === true;
  if (includeStampByDefault && !stampAssetId) return fail("Загрузите печать и подпись или отключите её автоматическое добавление.");

  return { ok:true, value:{ revision, seller, senders, defaultSenderId, defaults, document, stampAssetId, includeStampByDefault } };
}

function validPhone(value) {
  return /^\+?[\d\s()+-]{7,50}$/u.test(value);
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value);
}

function validInn(value) {
  if (!/^\d{10}(?:\d{2})?$/u.test(value)) return false;
  const checksum = (coefficients) => coefficients.reduce((sum, coefficient, index) => sum + coefficient * Number(value[index]), 0) % 11 % 10;
  if (value.length === 10) return checksum([2, 4, 10, 3, 5, 9, 4, 6, 8]) === Number(value[9]);
  return checksum([7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === Number(value[10]) && checksum([3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === Number(value[11]);
}

function validOgrn(value) {
  if (!/^\d{13}(?:\d{2})?$/u.test(value)) return false;
  const divisor = value.length === 13 ? 11n : 13n;
  const source = BigInt(value.slice(0, -1));
  return Number((source % divisor) % 10n) === Number(value.at(-1));
}

function integer(value, min, max) {
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max ? number : null;
}

function digits(value, max) {
  return String(value ?? "").replace(/\D/gu, "").slice(0, max);
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
