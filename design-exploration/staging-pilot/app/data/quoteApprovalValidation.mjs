export const QUOTE_APPROVAL_CHECKS = Object.freeze([
  "product_identity",
  "price_and_discount",
  "supply_and_timing",
  "payment_and_delivery",
  "vat_and_total",
  "recipient",
  "documents",
]);

const CHANNELS = ["email", "telegram", "max"];

export function validateQuoteApprovalAction(input, currentStage) {
  const idempotencyKey = clean(input?.idempotencyKey, 64);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(idempotencyKey)) return fail("Обновите страницу и повторите действие.");
  const type = clean(input?.type, 30);
  const actorName = clean(input?.actorName, 100);
  const actorRole = clean(input?.actorRole, 120);
  if (actorName.length < 2 || actorRole.length < 2) return fail("Укажите, кто выполняет действие и его роль.");

  if (type === "submitted") {
    if (currentStage !== "not_submitted") return fail("Эта редакция уже передана на согласование.");
    const checks = input?.checks && typeof input.checks === "object" ? input.checks : {};
    if (!QUOTE_APPROVAL_CHECKS.every((key) => checks[key] === true)) return fail("Подтвердите все пункты проверки перед согласованием.");
    return { ok:true, value:{ idempotencyKey, type, actorName, actorRole, checks:Object.fromEntries(QUOTE_APPROVAL_CHECKS.map((key) => [key, true])) } };
  }

  if (type === "approved") {
    if (currentStage !== "submitted") return fail("Утвердить можно только редакцию, переданную на согласование.");
    const note = cleanMultiline(input?.note, 500);
    return { ok:true, value:{ idempotencyKey, type, actorName, actorRole, note } };
  }

  if (type === "changes_requested") {
    if (currentStage !== "submitted") return fail("Вернуть на доработку можно только редакцию на согласовании.");
    const note = cleanMultiline(input?.note, 500);
    if (note.length < 3) return fail("Укажите, что нужно изменить в КП.");
    return { ok:true, value:{ idempotencyKey, type, actorName, actorRole, note } };
  }

  if (type === "delivery_prepared") {
    if (currentStage !== "approved") return fail("Подготовить отправку можно только после утверждения редакции.");
    const channel = clean(input?.channel, 20);
    const recipient = clean(input?.recipient, 180);
    if (!CHANNELS.includes(channel) || !validRecipient(channel, recipient)) return fail("Проверьте канал и адрес получателя.");
    return { ok:true, value:{ idempotencyKey, type, actorName, actorRole, channel, recipient } };
  }

  return fail("Действие согласования не поддерживается.");
}

export function approvalStageFromEvents(events) {
  let stage = "not_submitted";
  for (const event of events) {
    if (event.type === "submitted") stage = "submitted";
    if (event.type === "approved") stage = "approved";
    if (event.type === "changes_requested") stage = "changes_requested";
    if (event.type === "delivery_prepared") stage = "delivery_prepared";
  }
  return stage;
}

function validRecipient(channel, recipient) {
  if (channel === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(recipient);
  if (channel === "telegram") return /^@?[a-zA-Z0-9_]{5,32}$/u.test(recipient) || /^https:\/\/t\.me\/[a-zA-Z0-9_]{5,32}\/?$/u.test(recipient);
  if (channel === "max") return /^https:\/\/max\.ru\/[a-zA-Z0-9_\-/?=&.]+$/u.test(recipient);
  return false;
}

function clean(value, maxLength) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/gu, " ").replace(/\s+/gu, " ").trim().slice(0, maxLength);
}

function cleanMultiline(value, maxLength) {
  return String(value ?? "").replace(/\r\n?/gu, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, "").trim().slice(0, maxLength);
}

function fail(message) {
  return { ok:false, message };
}
