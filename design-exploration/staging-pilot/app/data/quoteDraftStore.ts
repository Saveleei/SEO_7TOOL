import { createHash } from "node:crypto";
import { mkdir, open, readFile } from "node:fs/promises";
import path from "node:path";
import { quoteStampAssetExists } from "./quoteAssetStore.ts";
import { getQuoteProductPresentation, type QuoteProductPresentation } from "./quoteProductPresentation.ts";
import { getQuoteRequestDetail, QuoteWorkflowError } from "./quoteRequestStore.ts";
import { DEFAULT_QUOTE_SENDER, parsePriceRub, validateQuoteDraft } from "./quoteDraftValidation.mjs";

export type QuoteSender = {
  name: string;
  role: string;
  phone: string;
  email: string;
};

export type QuoteDraftItem = {
  id: string;
  title: string;
  article: string;
  quantity: number;
  unitPriceRub: number;
  discountPercent: number;
  supplyStatus: "confirmed" | "supplier_confirmed" | "to_order" | "unknown";
  shipmentText: string;
  lineTotalRub: number;
  productPresentation: QuoteProductPresentation | null;
};

export type QuoteDraft = {
  id: string;
  requestId: string;
  revision: number;
  createdAt: string;
  status: "draft" | "ready";
  validityDays: number;
  vatRate: number;
  paymentTerms: string;
  deliveryTerms: string;
  managerComment: string;
  sender: QuoteSender;
  stampAssetId: string;
  includeStamp: boolean;
  items: QuoteDraftItem[];
  totalRub: number;
  vatIncludedRub: number;
};

type StoredQuoteDraft = QuoteDraft & { idempotencyHash: string };
type DraftInput = { idempotencyKey: string; status: string; validityDays: unknown; vatRate: unknown; paymentTerms: unknown; deliveryTerms: unknown; managerComment: unknown; sender?: unknown; stampAssetId?: unknown; includeStamp?: unknown; items: unknown };
type Options = { dataDir?: string; now?: string | Date };

let quoteWriteQueue: Promise<unknown> = Promise.resolve();

export async function getLatestQuoteDraft(requestId: string, options: Options = {}): Promise<QuoteDraft | null> {
  const drafts = (await readDrafts(resolveDataDir(options.dataDir))).filter((draft) => draft.requestId === requestId.toUpperCase());
  return drafts.length ? withoutHash(drafts.sort((a, b) => b.revision - a.revision)[0]) : null;
}

export async function getQuoteDraftOrDefault(requestId: string, options: Options = {}): Promise<QuoteDraft | null> {
  const request = await getQuoteRequestDetail(requestId, options);
  if (!request) return null;
  const stored = await getLatestQuoteDraft(request.id, options);
  if (stored) return stored;
  return {
    id:`КП-${request.id.slice(3)}`,
    requestId:request.id,
    revision:0,
    createdAt:request.createdAt,
    status:"draft",
    validityDays:10,
    vatRate:20,
    paymentTerms:"",
    deliveryTerms:"",
    managerComment:"",
    sender:{ ...DEFAULT_QUOTE_SENDER },
    stampAssetId:"",
    includeStamp:false,
    items:request.items.map((item) => {
      const unitPriceRub = parsePriceRub(item.price);
      return { id:item.id, title:item.title, article:item.article, quantity:item.quantity, unitPriceRub, discountPercent:0, supplyStatus:"unknown", shipmentText:"Требует подтверждения", lineTotalRub:unitPriceRub * item.quantity, productPresentation:getQuoteProductPresentation(item.id) };
    }),
    totalRub:request.items.reduce((sum, item) => sum + parsePriceRub(item.price) * item.quantity, 0),
    vatIncludedRub:0,
  };
}

export function saveQuoteDraft(requestId: string, input: DraftInput, options: Options = {}): Promise<{ draft: QuoteDraft; duplicate: boolean }> {
  const task = quoteWriteQueue.then(() => saveQuoteDraftSerial(requestId, input, options));
  quoteWriteQueue = task.catch(() => undefined);
  return task;
}

async function saveQuoteDraftSerial(requestId: string, input: DraftInput, options: Options) {
  const request = await getQuoteRequestDetail(requestId, options);
  if (!request) throw new QuoteWorkflowError("Заявка не найдена.", 404);
  const validation = validateQuoteDraft(input, request.items);
  if (!validation.ok) throw new QuoteWorkflowError(validation.message, 400);
  if (validation.value.includeStamp && !(await quoteStampAssetExists(request.id, validation.value.stampAssetId, options))) throw new QuoteWorkflowError("Файл печати и подписи не найден. Загрузите его повторно или отключите показ.", 400);
  const dataDir = resolveDataDir(options.dataDir);
  const drafts = await readDrafts(dataDir);
  const idempotencyHash = createHash("sha256").update(validation.value.idempotencyKey).digest("hex");
  const duplicate = drafts.find((draft) => draft.requestId === request.id && draft.idempotencyHash === idempotencyHash);
  if (duplicate) return { draft:withoutHash(duplicate), duplicate:true };
  const previousRevision = drafts.filter((draft) => draft.requestId === request.id).reduce((max, draft) => Math.max(max, draft.revision), 0);
  const stored: StoredQuoteDraft = {
    id:`КП-${request.id.slice(3)}`,
    requestId:request.id,
    revision:previousRevision + 1,
    createdAt:new Date(options.now || Date.now()).toISOString(),
    status:validation.value.status,
    validityDays:validation.value.validityDays,
    vatRate:validation.value.vatRate,
    paymentTerms:validation.value.paymentTerms,
    deliveryTerms:validation.value.deliveryTerms,
    managerComment:validation.value.managerComment,
    sender:validation.value.sender,
    stampAssetId:validation.value.stampAssetId,
    includeStamp:validation.value.includeStamp,
    items:validation.value.items.map((item: Omit<QuoteDraftItem, "productPresentation">) => ({ ...item, productPresentation:getQuoteProductPresentation(item.id) })),
    totalRub:validation.value.totalRub,
    vatIncludedRub:validation.value.vatIncludedRub,
    idempotencyHash,
  };
  await mkdir(dataDir, { recursive:true });
  const handle = await open(path.join(dataDir, "quote-drafts.jsonl"), "a");
  try {
    await handle.writeFile(`${JSON.stringify(stored)}\n`, { encoding:"utf8" });
    await handle.sync();
  } finally {
    await handle.close();
  }
  return { draft:withoutHash(stored), duplicate:false };
}

async function readDrafts(dataDir: string): Promise<StoredQuoteDraft[]> {
  try {
    const content = await readFile(path.join(dataDir, "quote-drafts.jsonl"), "utf8");
    return content.split("\n").filter(Boolean).flatMap((line) => {
      try { return [JSON.parse(line) as StoredQuoteDraft]; } catch { return []; }
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

function resolveDataDir(override?: string) {
  return override || process.env.QUOTE_TEST_DATA_DIR || path.join(process.cwd(), "work", "quote-requests");
}

function withoutHash(draft: StoredQuoteDraft): QuoteDraft {
  return {
    id:draft.id,
    requestId:draft.requestId,
    revision:draft.revision,
    createdAt:draft.createdAt,
    status:draft.status,
    validityDays:draft.validityDays,
    vatRate:draft.vatRate,
    paymentTerms:draft.paymentTerms,
    deliveryTerms:draft.deliveryTerms,
    managerComment:draft.managerComment,
    sender:draft.sender ?? { ...DEFAULT_QUOTE_SENDER },
    stampAssetId:draft.stampAssetId ?? "",
    includeStamp:Boolean(draft.includeStamp && draft.stampAssetId),
    items:draft.items.map((item) => ({ ...item, productPresentation:item.productPresentation ?? getQuoteProductPresentation(item.id) })),
    totalRub:draft.totalRub,
    vatIncludedRub:draft.vatIncludedRub,
  };
}
