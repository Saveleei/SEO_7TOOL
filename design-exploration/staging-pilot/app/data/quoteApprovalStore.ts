import { createHash, randomBytes } from "node:crypto";
import { mkdir, open, readFile } from "node:fs/promises";
import path from "node:path";
import { getQuoteDraftRevision, type QuoteDraft } from "./quoteDraftStore.ts";
import { QuoteWorkflowError } from "./quoteRequestStore.ts";
import { approvalStageFromEvents, validateQuoteApprovalAction } from "./quoteApprovalValidation.mjs";

export type QuoteApprovalStage = "not_submitted" | "submitted" | "changes_requested" | "approved" | "delivery_prepared";
export type QuoteApprovalEvent = {
  id: string;
  requestId: string;
  revision: number;
  quoteId: string;
  quoteFingerprint: string;
  createdAt: string;
  type: "submitted" | "approved" | "changes_requested" | "delivery_prepared";
  actorName: string;
  actorRole: string;
  checks?: Record<string, true>;
  note?: string;
  channel?: "email" | "telegram" | "max";
  recipient?: string;
  deliverySubject?: string;
  deliveryFileName?: string;
};
export type QuoteApprovalState = {
  stage: QuoteApprovalStage;
  revision: number;
  quoteFingerprint: string;
  events: QuoteApprovalEvent[];
};

type StoredEvent = QuoteApprovalEvent & { idempotencyHash: string };
type ApprovalInput = { idempotencyKey: string; type: string; actorName: unknown; actorRole: unknown; checks?: unknown; note?: unknown; channel?: unknown; recipient?: unknown };
type Options = { dataDir?: string; now?: string | Date };

let approvalWriteQueue: Promise<unknown> = Promise.resolve();

export async function getQuoteApprovalState(requestId: string, revision: number, options: Options = {}): Promise<QuoteApprovalState | null> {
  const quote = await getQuoteDraftRevision(requestId, revision, options);
  if (!quote) return null;
  const events = (await readApprovalEvents(resolveDataDir(options.dataDir))).filter((event) => event.requestId === quote.requestId && event.revision === quote.revision).map(withoutHash);
  return { stage:approvalStageFromEvents(events) as QuoteApprovalStage, revision:quote.revision, quoteFingerprint:fingerprintQuote(quote), events };
}

export function appendQuoteApprovalAction(requestId: string, revision: number, input: ApprovalInput, options: Options = {}): Promise<{ event: QuoteApprovalEvent; state: QuoteApprovalState; duplicate: boolean }> {
  const task = approvalWriteQueue.then(() => appendQuoteApprovalActionSerial(requestId, revision, input, options));
  approvalWriteQueue = task.catch(() => undefined);
  return task;
}

async function appendQuoteApprovalActionSerial(requestId: string, revision: number, input: ApprovalInput, options: Options) {
  const quote = await getQuoteDraftRevision(requestId, revision, options);
  if (!quote) throw new QuoteWorkflowError("Редакция КП не найдена.", 404);
  if (quote.status !== "ready") throw new QuoteWorkflowError("Сначала отметьте редакцию КП готовой к согласованию.", 400);
  const dataDir = resolveDataDir(options.dataDir);
  const storedEvents = await readApprovalEvents(dataDir);
  const idempotencyHash = createHash("sha256").update(String(input.idempotencyKey ?? "")).digest("hex");
  const duplicate = storedEvents.find((event) => event.requestId === quote.requestId && event.revision === quote.revision && event.idempotencyHash === idempotencyHash);
  if (duplicate) {
    const state = await getQuoteApprovalState(quote.requestId, quote.revision, options);
    return { event:withoutHash(duplicate), state:state!, duplicate:true };
  }
  assertQuotePreflightData(quote);
  const currentEvents = storedEvents.filter((event) => event.requestId === quote.requestId && event.revision === quote.revision).map(withoutHash);
  const currentStage = approvalStageFromEvents(currentEvents);
  const validation = validateQuoteApprovalAction(input, currentStage);
  if (!validation.ok) throw new QuoteWorkflowError(validation.message, 400);
  const createdAt = new Date(options.now || Date.now()).toISOString();
  const value = validation.value;
  const delivery = value.type === "delivery_prepared" ? {
    channel:value.channel,
    recipient:value.recipient,
    deliverySubject:`Коммерческое предложение ${quote.id}, редакция ${quote.revision}`,
    deliveryFileName:`${quote.id.replace(/[^a-zA-Zа-яА-Я0-9-]/gu, "-")}-r${quote.revision}.pdf`,
  } : {};
  const stored: StoredEvent = {
    id:`QA-${randomBytes(5).toString("hex").toUpperCase()}`,
    requestId:quote.requestId,
    revision:quote.revision,
    quoteId:quote.id,
    quoteFingerprint:fingerprintQuote(quote),
    createdAt,
    type:value.type,
    actorName:value.actorName,
    actorRole:value.actorRole,
    ...(value.checks ? { checks:value.checks } : {}),
    ...(value.note ? { note:value.note } : {}),
    ...delivery,
    idempotencyHash,
  };
  await mkdir(dataDir, { recursive:true });
  const handle = await open(path.join(dataDir, "quote-approval-events.jsonl"), "a");
  try {
    await handle.writeFile(`${JSON.stringify(stored)}\n`, { encoding:"utf8" });
    await handle.sync();
  } finally {
    await handle.close();
  }
  const events = [...currentEvents, withoutHash(stored)];
  return { event:withoutHash(stored), state:{ stage:approvalStageFromEvents(events) as QuoteApprovalStage, revision:quote.revision, quoteFingerprint:stored.quoteFingerprint, events }, duplicate:false };
}

export function fingerprintQuote(quote: QuoteDraft): string {
  return createHash("sha256").update(JSON.stringify(quote)).digest("hex");
}

function assertQuotePreflightData(quote: QuoteDraft) {
  if (!quote.items.length || quote.items.some((item) => item.unitPriceRub <= 0 || item.supplyStatus === "unknown" || item.shipmentText.length < 2)) throw new QuoteWorkflowError("В редакции есть неподтверждённые позиции.", 400);
  if (!quote.paymentTerms || !quote.deliveryTerms) throw new QuoteWorkflowError("Заполните условия оплаты и поставки.", 400);
  if (![0, 10, 22].includes(quote.vatRate) || quote.totalRub <= 0) throw new QuoteWorkflowError("Проверьте НДС и итоговую сумму.", 400);
}

async function readApprovalEvents(dataDir: string): Promise<StoredEvent[]> {
  try {
    const content = await readFile(path.join(dataDir, "quote-approval-events.jsonl"), "utf8");
    return content.split("\n").filter(Boolean).flatMap((line) => {
      try { return [JSON.parse(line) as StoredEvent]; } catch { return []; }
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

function withoutHash(event: StoredEvent): QuoteApprovalEvent {
  return Object.fromEntries(Object.entries(event).filter(([key]) => key !== "idempotencyHash")) as QuoteApprovalEvent;
}

function resolveDataDir(override?: string) {
  return override || process.env.QUOTE_TEST_DATA_DIR || path.join(process.cwd(), "work", "quote-requests");
}
