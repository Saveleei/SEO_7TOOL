import { createHash, randomBytes } from "node:crypto";
import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

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
  status: "received";
  itemCount: number;
  totalQuantity: number;
  email: string;
  phone: string;
  company: string;
  city: string;
  billingProvided: boolean;
  sourcePath: string;
};

type StoredQuote = Omit<ValidatedQuote, "idempotencyKey"> & {
  id: string;
  createdAt: string;
  status: "received";
  idempotencyHash: string;
  attachment: StoredAttachment | null;
  delivery: { mode: "disabled-test-contour"; email: false; max: false; crm: false };
};

let writeQueue: Promise<unknown> = Promise.resolve();

export function isQuoteTestModeEnabled(): boolean {
  return process.env.QUOTE_TEST_MODE === "1";
}

export function saveQuoteRequest(input: ValidatedQuote, attachment: AttachmentInput, options: { dataDir?: string } = {}): Promise<{ id: string; createdAt: string; duplicate: boolean; billingProvided: boolean }> {
  const task = writeQueue.then(() => saveQuoteRequestSerial(input, attachment, options));
  writeQueue = task.catch(() => undefined);
  return task;
}

export async function listQuoteRequestSummaries(limit = 50, options: { dataDir?: string } = {}): Promise<QuoteRequestSummary[]> {
  const records = await readRecords(resolveDataDir(options.dataDir));
  return records.slice(-Math.max(1, Math.min(200, limit))).reverse().map(toSummary);
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
    const logFile = await open(path.join(dataDir, "requests.jsonl"), "a");
    try {
      await logFile.writeFile(`${JSON.stringify(record)}\n`, { encoding:"utf8" });
      await logFile.sync();
    } finally {
      await logFile.close();
    }
  } catch (error) {
    if (storedAttachmentPath) await rm(storedAttachmentPath, { force:true });
    throw error;
  }

  return { id, createdAt, duplicate:false, billingProvided:Boolean(input.billingInn || storedAttachment) };
}

async function readRecords(dataDir: string): Promise<StoredQuote[]> {
  try {
    const content = await readFile(path.join(dataDir, "requests.jsonl"), "utf8");
    return content.split("\n").filter(Boolean).flatMap((line) => {
      try { return [JSON.parse(line) as StoredQuote]; } catch { return []; }
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

function resolveDataDir(override?: string): string {
  return override || process.env.QUOTE_TEST_DATA_DIR || path.join(process.cwd(), "work", "quote-requests");
}

function createRequestNumber(isoDate: string): string {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone:"Europe/Moscow", year:"numeric", month:"2-digit", day:"2-digit" }).format(new Date(isoDate)).replace(/-/g, "");
  return `7T-${date}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

function toSummary(record: StoredQuote): QuoteRequestSummary {
  return {
    id:record.id,
    createdAt:record.createdAt,
    status:record.status,
    itemCount:record.items.length,
    totalQuantity:record.items.reduce((sum, item) => sum + item.quantity, 0),
    email:maskEmail(record.email),
    phone:maskPhone(record.phone),
    company:record.company,
    city:record.city,
    billingProvided:Boolean(record.billingInn || record.attachment),
    sourcePath:record.source.pagePath,
  };
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
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
