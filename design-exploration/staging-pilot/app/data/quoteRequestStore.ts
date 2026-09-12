import { createHash, randomBytes } from "node:crypto";
import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { deriveWorkflow, getStatusLabel, QUOTE_ASSIGNEES, validateManagerEvent } from "./quoteRequestWorkflow.mjs";

type QuoteStatus = "received" | "checking" | "quote_ready" | "sent";
type StoredAttachment = { relativePath: string; mime: string; size: number };
type AttachmentInput = { bytes: Buffer; extension: string; mime: string; size: number } | null;
type ValidatedQuote = {
  email: string;
  phone: string;
  company: string;
  city: string;
  comment: string;
  billingInn: string;
  idempotencyKey: string;
  consent: boolean;
  alternatives: boolean;
  requestedChecks: { availability: boolean; compatibility: boolean; documents: boolean };
  source: { pagePath: string; utmSource: string; utmMedium: string; utmCampaign: string };
  items: Array<{ id: string; title: string; article: string; quantity: number; price?: string; href?: string }>;
};

export type QuoteRequestSummary = {
  id: string;
  createdAt: string;
  status: QuoteStatus;
  statusLabel: string;
  itemCount: number;
  totalQuantity: number;
  email: string;
  phone: string;
  company: string;
  city: string;
  billingProvided: boolean;
  sourcePath: string;
  assignee: string | null;
  assigneeName: string | null;
  firstHandledAt: string | null;
  slaDueAt: string;
  slaBreached: boolean;
};

export type QuoteRequestEvent = {
  id: string;
  requestId: string;
  createdAt: string;
  actor: "manager";
  type: "status_changed" | "assigned" | "note_added";
  status?: QuoteStatus;
  assignee?: string;
  note?: string;
};

export type QuoteRequestDetail = QuoteRequestSummary & {
  emailFull: string;
  phoneFull: string;
  comment: string;
  billingInn: string;
  consent: boolean;
  alternatives: boolean;
  requestedChecks: ValidatedQuote["requestedChecks"];
  source: ValidatedQuote["source"];
  items: ValidatedQuote["items"];
  attachment: StoredAttachment | null;
  events: QuoteRequestEvent[];
};

type StoredQuote = Omit<ValidatedQuote, "idempotencyKey"> & {
  id: string;
  createdAt: string;
  status: "received";
  idempotencyHash: string;
  attachment: StoredAttachment | null;
  delivery: { mode: "disabled-test-contour"; email: false; max: false; crm: false };
};

type StoredEvent = QuoteRequestEvent & { idempotencyHash: string };
type StoreOptions = { dataDir?: string; now?: string | Date; responseMinutes?: number };
type ManagerEventInput = { requestId: string; idempotencyKey: string; type: string; status?: string; assignee?: string; note?: string };

let writeQueue: Promise<unknown> = Promise.resolve();

export function isQuoteTestModeEnabled(): boolean {
  return process.env.QUOTE_TEST_MODE === "1";
}

export function saveQuoteRequest(input: ValidatedQuote, attachment: AttachmentInput, options: { dataDir?: string } = {}): Promise<{ id: string; createdAt: string; duplicate: boolean; billingProvided: boolean }> {
  const task = writeQueue.then(() => saveQuoteRequestSerial(input, attachment, options));
  writeQueue = task.catch(() => undefined);
  return task;
}

export async function listQuoteRequestSummaries(limit = 50, options: StoreOptions = {}): Promise<QuoteRequestSummary[]> {
  const dataDir = resolveDataDir(options.dataDir);
  const [records, events] = await Promise.all([readRecords(dataDir), readEvents(dataDir)]);
  return records.slice(-Math.max(1, Math.min(200, limit))).reverse().map((record) => toSummary(record, eventsFor(events, record.id), options));
}

export async function getQuoteRequestDetail(requestId: string, options: StoreOptions = {}): Promise<QuoteRequestDetail | null> {
  const dataDir = resolveDataDir(options.dataDir);
  const [records, events] = await Promise.all([readRecords(dataDir), readEvents(dataDir)]);
  const record = records.find((candidate) => candidate.id === requestId.toUpperCase());
  if (!record) return null;
  const requestEvents = eventsFor(events, record.id);
  return {
    ...toSummary(record, requestEvents, options),
    emailFull:record.email,
    phoneFull:record.phone,
    comment:record.comment,
    billingInn:record.billingInn,
    consent:record.consent,
    alternatives:record.alternatives,
    requestedChecks:record.requestedChecks,
    source:record.source,
    items:record.items,
    attachment:record.attachment,
    events:requestEvents.map(withoutEventHash),
  };
}

export function appendQuoteRequestEvent(input: ManagerEventInput, options: StoreOptions = {}): Promise<{ event: QuoteRequestEvent; duplicate: boolean }> {
  const task = writeQueue.then(() => appendQuoteRequestEventSerial(input, options));
  writeQueue = task.catch(() => undefined);
  return task;
}

async function appendQuoteRequestEventSerial(input: ManagerEventInput, options: StoreOptions) {
  const dataDir = resolveDataDir(options.dataDir);
  const [records, events] = await Promise.all([readRecords(dataDir), readEvents(dataDir)]);
  const record = records.find((candidate) => candidate.id === String(input.requestId).toUpperCase());
  if (!record) throw new QuoteWorkflowError("Заявка не найдена.", 404);
  const workflow = deriveWorkflow(eventsFor(events, record.id), record.createdAt, workflowOptions(options));
  const validation = validateManagerEvent(input, workflow.status);
  if (!validation.ok) throw new QuoteWorkflowError(validation.message, 400);
  const idempotencyHash = createHash("sha256").update(validation.value.idempotencyKey).digest("hex");
  const duplicate = events.find((event) => event.requestId === record.id && event.idempotencyHash === idempotencyHash);
  if (duplicate) return { event:withoutEventHash(duplicate), duplicate:true };

  const event: StoredEvent = {
    id:`EV-${randomBytes(5).toString("hex").toUpperCase()}`,
    requestId:record.id,
    createdAt:new Date(options.now || Date.now()).toISOString(),
    actor:"manager",
    type:validation.value.type,
    ...(validation.value.status ? { status:validation.value.status as QuoteStatus } : {}),
    ...(validation.value.assignee ? { assignee:validation.value.assignee } : {}),
    ...(validation.value.note ? { note:validation.value.note } : {}),
    idempotencyHash,
  };
  await mkdir(dataDir, { recursive:true });
  await appendJsonLine(path.join(dataDir, "events.jsonl"), event);
  return { event:withoutEventHash(event), duplicate:false };
}

async function saveQuoteRequestSerial(input: ValidatedQuote, attachment: AttachmentInput, options: { dataDir?: string }) {
  const dataDir = resolveDataDir(options.dataDir);
  await mkdir(dataDir, { recursive:true });
  const idempotencyHash = createHash("sha256").update(input.idempotencyKey).digest("hex");
  const existing = (await readRecords(dataDir)).find((record) => record.idempotencyHash === idempotencyHash);
  if (existing) return { id:existing.id, createdAt:existing.createdAt, duplicate:true, billingProvided:Boolean(existing.billingInn || existing.attachment) };

  const createdAt = new Date().toISOString();
  const id = createRequestNumber(createdAt);
  let storedAttachment: StoredAttachment | null = null;
  let storedAttachmentPath = "";
  if (attachment) {
    const uploadDir = path.join(dataDir, "uploads");
    await mkdir(uploadDir, { recursive:true });
    const fileName = `${id}.${attachment.extension}`;
    const temporaryPath = path.join(uploadDir, `${fileName}.${randomBytes(4).toString("hex")}.tmp`);
    storedAttachmentPath = path.join(uploadDir, fileName);
    await writeFile(temporaryPath, attachment.bytes, { flag:"wx" });
    await rename(temporaryPath, storedAttachmentPath);
    storedAttachment = { relativePath:`uploads/${fileName}`, mime:attachment.mime, size:attachment.size };
  }

  const record: StoredQuote = {
    ...toStoredInput(input),
    id,
    createdAt,
    status:"received",
    idempotencyHash,
    attachment:storedAttachment,
    delivery:{ mode:"disabled-test-contour", email:false, max:false, crm:false },
  };

  try {
    await appendJsonLine(path.join(dataDir, "requests.jsonl"), record);
  } catch (error) {
    if (storedAttachmentPath) await rm(storedAttachmentPath, { force:true });
    throw error;
  }
  return { id, createdAt, duplicate:false, billingProvided:Boolean(input.billingInn || storedAttachment) };
}

async function appendJsonLine(filePath: string, value: unknown) {
  const logFile = await open(filePath, "a");
  try {
    await logFile.writeFile(`${JSON.stringify(value)}\n`, { encoding:"utf8" });
    await logFile.sync();
  } finally {
    await logFile.close();
  }
}

async function readRecords(dataDir: string): Promise<StoredQuote[]> {
  return readJsonLines<StoredQuote>(path.join(dataDir, "requests.jsonl"));
}

async function readEvents(dataDir: string): Promise<StoredEvent[]> {
  return readJsonLines<StoredEvent>(path.join(dataDir, "events.jsonl"));
}

async function readJsonLines<T>(filePath: string): Promise<T[]> {
  try {
    const content = await readFile(filePath, "utf8");
    return content.split("\n").filter(Boolean).flatMap((line) => {
      try { return [JSON.parse(line) as T]; } catch { return []; }
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

function resolveDataDir(override?: string): string {
  return override || process.env.QUOTE_TEST_DATA_DIR || path.join(process.cwd(), "work", "quote-requests");
}

function responseMinutes(override?: number): number {
  const value = override ?? Number(process.env.QUOTE_FIRST_RESPONSE_MINUTES);
  return Number.isInteger(value) && value > 0 && value <= 1440 ? value : 30;
}

function workflowOptions(options: StoreOptions) {
  return { now:options.now, responseMinutes:responseMinutes(options.responseMinutes) };
}

function createRequestNumber(isoDate: string): string {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone:"Europe/Moscow", year:"numeric", month:"2-digit", day:"2-digit" }).format(new Date(isoDate)).replace(/-/g, "");
  return `7T-${date}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

function toSummary(record: StoredQuote, events: StoredEvent[], options: StoreOptions): QuoteRequestSummary {
  const workflow = deriveWorkflow(events, record.createdAt, workflowOptions(options));
  const assigneeName = QUOTE_ASSIGNEES.find((manager: { id: string; name: string }) => manager.id === workflow.assignee)?.name ?? null;
  return {
    id:record.id,
    createdAt:record.createdAt,
    status:workflow.status,
    statusLabel:getStatusLabel(workflow.status),
    itemCount:record.items.length,
    totalQuantity:record.items.reduce((sum, item) => sum + item.quantity, 0),
    email:maskEmail(record.email),
    phone:maskPhone(record.phone),
    company:record.company,
    city:record.city,
    billingProvided:Boolean(record.billingInn || record.attachment),
    sourcePath:record.source.pagePath,
    assignee:workflow.assignee,
    assigneeName,
    firstHandledAt:workflow.firstHandledAt,
    slaDueAt:workflow.slaDueAt,
    slaBreached:workflow.slaBreached,
  };
}

function eventsFor(events: StoredEvent[], requestId: string) {
  return events.filter((event) => event.requestId === requestId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function withoutEventHash(event: StoredEvent): QuoteRequestEvent {
  return {
    id:event.id,
    requestId:event.requestId,
    createdAt:event.createdAt,
    actor:event.actor,
    type:event.type,
    ...(event.status ? { status:event.status } : {}),
    ...(event.assignee ? { assignee:event.assignee } : {}),
    ...(event.note ? { note:event.note } : {}),
  };
}

function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 2)}***@${domain}`;
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `+${digits.slice(0, 1)} *** ***-${digits.slice(-4)}`;
}

function toStoredInput(input: ValidatedQuote): Omit<ValidatedQuote, "idempotencyKey"> {
  return {
    email:input.email,
    phone:input.phone,
    company:input.company,
    city:input.city,
    comment:input.comment,
    billingInn:input.billingInn,
    consent:input.consent,
    alternatives:input.alternatives,
    requestedChecks:input.requestedChecks,
    source:input.source,
    items:input.items,
  };
}

export class QuoteWorkflowError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "QuoteWorkflowError";
    this.status = status;
  }
}
