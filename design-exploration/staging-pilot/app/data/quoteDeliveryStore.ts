import { createHash, randomBytes } from "node:crypto";
import { mkdir, open, readFile } from "node:fs/promises";
import path from "node:path";
import type { ManagerActor } from "./managerAccess.ts";
import { getQuoteApprovalState, type QuoteApprovalEvent } from "./quoteApprovalStore.ts";
import { getQuoteDraftRevision, type QuoteDraft } from "./quoteDraftStore.ts";
import { getQuoteRequestDetail, QuoteWorkflowError, type QuoteRequestDetail } from "./quoteRequestStore.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const confirmationKeys = ["recipient", "document", "authority"] as const;

export type QuoteDeliveryChannel = "email" | "telegram" | "max";
export type QuoteDeliveryConfirmations = Record<(typeof confirmationKeys)[number], true>;
export type QuoteDeliveryPackage = {
  requestId: string;
  quoteId: string;
  revision: number;
  quoteFingerprint: string;
  packageFingerprint: string;
  approvalEventId: string;
  preparedAt: string;
  preparedBy: string;
  channel: QuoteDeliveryChannel;
  recipient: string;
  subject: string;
  message: string;
  pdfFileName: string;
  pdfUrl: string;
  previewUrl: string;
};
export type QuoteDeliveryOutboxRecord = QuoteDeliveryPackage & {
  id: string;
  queuedAt: string;
  queuedBy: { id: string; name: string; role: ManagerActor["role"]; roleLabel: string };
  confirmations: QuoteDeliveryConfirmations;
  status: "held";
  transport: "disabled-test-contour";
  deliveryEnabled: false;
  attempts: 0;
};
export type QuoteDeliveryWorkspace = { package: QuoteDeliveryPackage; outbox: QuoteDeliveryOutboxRecord | null };
export type QuoteDeliveryJournalEntry = QuoteDeliveryOutboxRecord & {
  company: string;
  city: string;
  totalRub: number | null;
  itemCount: number;
};
export type QuoteDeliveryJournalChannel = "all" | QuoteDeliveryChannel;

type StoredRecord = QuoteDeliveryOutboxRecord & { idempotencyHash: string };
type DeliveryInput = { idempotencyKey: unknown; confirmations: unknown };
type Options = { dataDir?: string; now?: string | Date };

let outboxWriteQueue: Promise<unknown> = Promise.resolve();

export async function getQuoteDeliveryWorkspace(requestId: string, revision: number, options: Options = {}): Promise<QuoteDeliveryWorkspace> {
  const deliveryPackage = await buildQuoteDeliveryPackage(requestId, revision, options);
  const record = (await readOutbox(resolveDataDir(options.dataDir))).find((candidate) => sameApprovedPackage(candidate, deliveryPackage));
  return { package:deliveryPackage, outbox:record ? withoutHash(record) : null };
}

export async function listQuoteDeliveryJournal(options: Options = {}): Promise<QuoteDeliveryJournalEntry[]> {
  const records = (await readOutbox(resolveDataDir(options.dataDir))).map(withoutHash).sort((a, b) => b.queuedAt.localeCompare(a.queuedAt));
  const entries = await Promise.all(records.map(async (record) => {
    const [request, quote] = await Promise.all([
      getQuoteRequestDetail(record.requestId, options),
      getQuoteDraftRevision(record.requestId, record.revision, options),
    ]);
    return {
      ...record,
      company:request?.company || "Компания не указана",
      city:request?.city || "Город не указан",
      totalRub:quote?.totalRub ?? null,
      itemCount:quote?.items.length ?? request?.items.length ?? 0,
    };
  }));
  return entries;
}

export function filterQuoteDeliveryJournal(entries: QuoteDeliveryJournalEntry[], input: { q?: unknown; channel?: unknown }): { entries: QuoteDeliveryJournalEntry[]; q: string; channel: QuoteDeliveryJournalChannel } {
  const q = normalizeJournalSearch(input.q);
  const channel = normalizeJournalChannel(input.channel);
  const folded = q.toLocaleLowerCase("ru-RU");
  const filtered = entries.filter((entry) => {
    if (channel !== "all" && entry.channel !== channel) return false;
    if (!folded) return true;
    return [entry.id, entry.requestId, entry.quoteId, entry.company, entry.city, entry.recipient]
      .some((value) => value.toLocaleLowerCase("ru-RU").includes(folded));
  });
  return { entries:filtered, q, channel };
}

export function normalizeJournalSearch(value: unknown): string {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/gu, " ").replace(/\s+/gu, " ").trim().slice(0, 100);
}

export function normalizeJournalChannel(value: unknown): QuoteDeliveryJournalChannel {
  return value === "email" || value === "telegram" || value === "max" ? value : "all";
}

export function enqueueQuoteDeliveryPackage(requestId: string, revision: number, input: DeliveryInput, actor: ManagerActor, options: Options = {}): Promise<{ workspace: QuoteDeliveryWorkspace; duplicate: boolean }> {
  const task = outboxWriteQueue.then(() => enqueueSerial(requestId, revision, input, actor, options));
  outboxWriteQueue = task.catch(() => undefined);
  return task;
}

export function validateQuoteDeliveryInput(input: DeliveryInput): { ok: true; value: { idempotencyKey: string; confirmations: QuoteDeliveryConfirmations } } | { ok: false; message: string } {
  const idempotencyKey = String(input.idempotencyKey ?? "").trim();
  if (!UUID_PATTERN.test(idempotencyKey)) return { ok:false, message:"Обновите страницу и повторите действие." };
  if (!input.confirmations || typeof input.confirmations !== "object") return { ok:false, message:"Подтвердите контрольные пункты перед постановкой в очередь." };
  const raw = input.confirmations as Record<string, unknown>;
  if (!confirmationKeys.every((key) => raw[key] === true)) return { ok:false, message:"Подтвердите получателя, документ и полномочия на отправку." };
  return { ok:true, value:{ idempotencyKey, confirmations:{ recipient:true, document:true, authority:true } } };
}

async function enqueueSerial(requestId: string, revision: number, input: DeliveryInput, actor: ManagerActor, options: Options) {
  const validation = validateQuoteDeliveryInput(input);
  if (!validation.ok) throw new QuoteWorkflowError(validation.message, 400);
  const deliveryPackage = await buildQuoteDeliveryPackage(requestId, revision, options);
  const dataDir = resolveDataDir(options.dataDir);
  const records = await readOutbox(dataDir);
  const idempotencyHash = createHash("sha256").update(validation.value.idempotencyKey).digest("hex");
  const idempotent = records.find((record) => record.requestId === deliveryPackage.requestId && record.revision === deliveryPackage.revision && record.idempotencyHash === idempotencyHash);
  if (idempotent) return { workspace:{ package:deliveryPackage, outbox:withoutHash(idempotent) }, duplicate:true };
  const alreadyQueued = records.find((record) => sameApprovedPackage(record, deliveryPackage));
  if (alreadyQueued) return { workspace:{ package:deliveryPackage, outbox:withoutHash(alreadyQueued) }, duplicate:true };

  const stored: StoredRecord = {
    ...deliveryPackage,
    id:`QD-${randomBytes(5).toString("hex").toUpperCase()}`,
    queuedAt:new Date(options.now || Date.now()).toISOString(),
    queuedBy:{ id:actor.id, name:actor.name, role:actor.role, roleLabel:actor.roleLabel },
    confirmations:validation.value.confirmations,
    status:"held",
    transport:"disabled-test-contour",
    deliveryEnabled:false,
    attempts:0,
    idempotencyHash,
  };
  await mkdir(dataDir, { recursive:true });
  const handle = await open(path.join(dataDir, "quote-delivery-outbox.jsonl"), "a");
  try {
    await handle.writeFile(`${JSON.stringify(stored)}\n`, { encoding:"utf8" });
    await handle.sync();
  } finally {
    await handle.close();
  }
  return { workspace:{ package:deliveryPackage, outbox:withoutHash(stored) }, duplicate:false };
}

async function buildQuoteDeliveryPackage(requestId: string, revision: number, options: Options): Promise<QuoteDeliveryPackage> {
  if (!Number.isInteger(revision) || revision < 1) throw new QuoteWorkflowError("Редакция КП не указана.", 400);
  const [quote, approval, quoteRequest] = await Promise.all([
    getQuoteDraftRevision(requestId, revision, options),
    getQuoteApprovalState(requestId, revision, options),
    getQuoteRequestDetail(requestId, options),
  ]);
  if (!quote || !quoteRequest) throw new QuoteWorkflowError("Заявка или редакция КП не найдена.", 404);
  if (quote.status !== "ready" || approval?.stage !== "delivery_prepared") throw new QuoteWorkflowError("Сначала утвердите редакцию и подготовьте получателя.", 409);
  const deliveryEvent = [...approval.events].reverse().find((event) => event.type === "delivery_prepared");
  assertCanonicalDeliveryEvent(deliveryEvent, quote, approval.quoteFingerprint);
  const canonical = {
    requestId:quote.requestId,
    quoteId:quote.id,
    revision:quote.revision,
    quoteFingerprint:approval.quoteFingerprint,
    approvalEventId:deliveryEvent.id,
    preparedAt:deliveryEvent.createdAt,
    preparedBy:deliveryEvent.actorName,
    channel:deliveryEvent.channel,
    recipient:deliveryEvent.recipient,
    subject:deliveryEvent.deliverySubject,
    message:composeMessage(deliveryEvent.channel, quote, quoteRequest, deliveryEvent.deliveryFileName),
    pdfFileName:deliveryEvent.deliveryFileName,
    pdfUrl:`/api/quote-requests/${encodeURIComponent(quote.requestId)}/quote-pdf?revision=${quote.revision}`,
    previewUrl:`/test/requests/${encodeURIComponent(quote.requestId)}/quote?mode=preview&revision=${quote.revision}`,
  };
  return { ...canonical, packageFingerprint:createHash("sha256").update(JSON.stringify(canonical)).digest("hex") };
}

function assertCanonicalDeliveryEvent(event: QuoteApprovalEvent | undefined, quote: QuoteDraft, quoteFingerprint: string): asserts event is QuoteApprovalEvent & Required<Pick<QuoteApprovalEvent, "channel" | "recipient" | "deliverySubject" | "deliveryFileName">> {
  if (!event || event.quoteId !== quote.id || event.quoteFingerprint !== quoteFingerprint || !event.channel || !event.recipient || !event.deliverySubject || !event.deliveryFileName) {
    throw new QuoteWorkflowError("Данные утверждённого пакета не совпадают с редакцией КП.", 409);
  }
}

function composeMessage(channel: QuoteDeliveryChannel, quote: QuoteDraft, request: QuoteRequestDetail, pdfFileName: string): string {
  const company = request.company ? ` для компании ${request.company}` : "";
  const total = new Intl.NumberFormat("ru-RU", { maximumFractionDigits:2 }).format(quote.totalRub);
  const greeting = channel === "email" ? "Здравствуйте!" : "Добрый день!";
  const lines = [
    greeting,
    `Подготовили коммерческое предложение ${quote.id}, редакция №${quote.revision}${company}, по запросу ${request.id}.`,
    `Сумма предложения — ${total} ₽${quote.vatRate ? `, включая НДС ${quote.vatRate}%` : ", без НДС"}.`,
    `PDF-файл: ${pdfFileName}. Условия оплаты и поставки указаны внутри документа.`,
    `Контакт: ${quote.sender.name}, ${quote.sender.role}, ${quote.sender.phone}, ${quote.sender.email}.`,
  ];
  return lines.join("\n\n");
}

function sameApprovedPackage(record: Pick<QuoteDeliveryOutboxRecord, "requestId" | "revision" | "quoteFingerprint" | "approvalEventId">, deliveryPackage: QuoteDeliveryPackage) {
  return record.requestId === deliveryPackage.requestId
    && record.revision === deliveryPackage.revision
    && record.quoteFingerprint === deliveryPackage.quoteFingerprint
    && record.approvalEventId === deliveryPackage.approvalEventId;
}

async function readOutbox(dataDir: string): Promise<StoredRecord[]> {
  try {
    const content = await readFile(path.join(dataDir, "quote-delivery-outbox.jsonl"), "utf8");
    return content.split("\n").filter(Boolean).flatMap((line) => {
      try { return [JSON.parse(line) as StoredRecord]; } catch { return []; }
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

function withoutHash(record: StoredRecord): QuoteDeliveryOutboxRecord {
  return Object.fromEntries(Object.entries(record).filter(([key]) => key !== "idempotencyHash")) as QuoteDeliveryOutboxRecord;
}

function resolveDataDir(override?: string) {
  return override || process.env.QUOTE_TEST_DATA_DIR || path.join(process.cwd(), "work", "quote-requests");
}
