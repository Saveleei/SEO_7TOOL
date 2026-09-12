export const QUOTE_STATUSES = ["received", "checking", "quote_ready", "sent"];
export const QUOTE_ASSIGNEES = [{ id:"evgeny-savelev", name:"Евгений Савельев" }];

const transitions = {
  received:new Set(["checking"]),
  checking:new Set(["received", "quote_ready"]),
  quote_ready:new Set(["checking", "sent"]),
  sent:new Set(),
};

export function validateManagerEvent(input, currentStatus) {
  const requestId = clean(input?.requestId, 40).toUpperCase();
  const idempotencyKey = clean(input?.idempotencyKey, 64);
  const type = clean(input?.type, 30);
  if (!/^7T-\d{8}-[A-F0-9]{6}$/u.test(requestId)) return fail("Некорректный номер заявки.");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(idempotencyKey)) return fail("Обновите страницу и повторите действие.");
  if (!QUOTE_STATUSES.includes(currentStatus)) return fail("Текущий этап заявки не распознан.");

  if (type === "status_changed") {
    const status = clean(input?.status, 30);
    if (!QUOTE_STATUSES.includes(status)) return fail("Выберите корректный этап.");
    if (!transitions[currentStatus].has(status)) return fail("Этот переход этапа недоступен.");
    return { ok:true, value:{ requestId, idempotencyKey, type, status } };
  }

  if (type === "assigned") {
    const assignee = clean(input?.assignee, 50);
    if (!QUOTE_ASSIGNEES.some((manager) => manager.id === assignee)) return fail("Выберите доступного менеджера.");
    return { ok:true, value:{ requestId, idempotencyKey, type, assignee } };
  }

  if (type === "note_added") {
    const note = cleanMultiline(input?.note, 1500);
    if (note.length < 3) return fail("Заметка должна содержать хотя бы 3 символа.");
    return { ok:true, value:{ requestId, idempotencyKey, type, note } };
  }

  return fail("Тип действия не поддерживается.");
}

export function deriveWorkflow(events, createdAt, options = {}) {
  let status = "received";
  let assignee = null;
  let firstHandledAt = null;
  for (const event of events) {
    if (event.type === "status_changed" && QUOTE_STATUSES.includes(event.status)) {
      status = event.status;
      if (!firstHandledAt && event.status !== "received") firstHandledAt = event.createdAt;
    }
    if (event.type === "assigned") assignee = event.assignee;
  }
  const responseMinutes = positiveInteger(options.responseMinutes, 30);
  const now = options.now ? new Date(options.now) : new Date();
  const slaDueAt = new Date(new Date(createdAt).getTime() + responseMinutes * 60_000).toISOString();
  return {
    status,
    assignee,
    firstHandledAt,
    slaDueAt,
    slaBreached:!firstHandledAt && now.getTime() > new Date(slaDueAt).getTime(),
  };
}

export function getStatusLabel(status) {
  return ({ received:"Получена", checking:"Проверка", quote_ready:"КП готово", sent:"Отправлено" })[status] || status;
}

function clean(value, maxLength) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/gu, " ").replace(/\s+/gu, " ").trim().slice(0, maxLength);
}

function cleanMultiline(value, maxLength) {
  return String(value ?? "").replace(/\r\n?/gu, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, "").trim().slice(0, maxLength);
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 && number <= 1440 ? number : fallback;
}

function fail(message) {
  return { ok:false, message };
}
