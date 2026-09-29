import { open, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const REQUEST_ID_PATTERN = /^7T-\d{8}-[A-F0-9]{6}$/u;
const TARGET_REQUEST_ID_PATTERN = /^7T-\d{8}-[A-F0-9]{6}$/u;
const PRODUCTION_ENDPOINT = "https://7tool.ru/api/lead";
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000, 6 * 60 * 60_000];

export async function processQuoteIntakeOutbox(options = {}) {
  const requestedDataDir = String(options.dataDir || process.env.QUOTE_DATA_DIR || "").trim();
  if (!requestedDataDir) throw new Error("QUOTE_DATA_DIR is required");
  const dataDir = path.resolve(requestedDataDir);
  if (!path.isAbsolute(dataDir) || dataDir === path.parse(dataDir).root) throw new Error("QUOTE_DATA_DIR must be a specific absolute directory");
  const endpoint = validateEndpoint(options.endpoint || process.env.QUOTE_INTAKE_DELIVERY_ENDPOINT || "");
  const enabled = options.enabled ?? process.env.QUOTE_INTAKE_DELIVERY_ENABLED === "1";
  const now = new Date(options.now ?? Date.now());
  const limit = boundedInteger(options.limit ?? process.env.QUOTE_INTAKE_DELIVERY_BATCH, 1, 100, 20);
  const fetchImpl = options.fetchImpl || fetch;
  const requests = await readJsonLines(path.join(dataDir, "requests.jsonl"));
  const outbox = latestByRequest(await readJsonLines(path.join(dataDir, "request-intake-outbox.jsonl")));
  const journalPath = path.join(dataDir, "request-intake-delivery.jsonl");
  const journal = await readJsonLines(journalPath);
  const latestDelivery = latestByRequest(journal);
  const requestById = new Map(requests.map((request) => [request.id, request]));
  const pending = [...outbox.values()].filter((record) => eligible(record, latestDelivery.get(record.requestId), now)).slice(0, limit);

  if (!enabled) return { enabled:false, inspected:outbox.size, pending:pending.length, processed:0, delivered:0, failed:0 };

  let delivered = 0;
  let failed = 0;
  for (const record of pending) {
    const request = requestById.get(record.requestId);
    const previous = latestDelivery.get(record.requestId);
    const attempts = Number(previous?.attempts || 0) + 1;
    if (!request) {
      await appendJournal(journalPath, failureRecord(record.requestId, attempts, now, "REQUEST_NOT_FOUND"));
      failed += 1;
      continue;
    }
    try {
      const outbound = await buildOutboundRequest(request, dataDir);
      const response = await fetchImpl(endpoint, {
        method:"POST",
        headers:outbound.headers,
        body:outbound.body,
        redirect:"error",
        signal:AbortSignal.timeout(boundedInteger(options.timeoutMs ?? process.env.QUOTE_INTAKE_DELIVERY_TIMEOUT_MS, 1_000, 60_000, 15_000)),
      });
      const payload = await safeJson(response);
      if (!response.ok || payload?.ok !== true || !TARGET_REQUEST_ID_PATTERN.test(String(payload.requestId || ""))) {
        throw new DeliveryError(`HTTP_${response.status}`, response.status);
      }
      await appendJournal(journalPath, {
        requestId:record.requestId,
        attemptedAt:now.toISOString(),
        status:"delivered",
        attempts,
        targetRequestId:String(payload.requestId),
        duplicate:Boolean(payload.duplicate),
        httpStatus:response.status,
      });
      delivered += 1;
    } catch (error) {
      const code = error instanceof DeliveryError ? error.code : error?.name === "TimeoutError" ? "TIMEOUT" : "DELIVERY_FAILED";
      const status = error instanceof DeliveryError ? error.httpStatus : null;
      await appendJournal(journalPath, failureRecord(record.requestId, attempts, now, code, status));
      failed += 1;
    }
  }
  return { enabled:true, inspected:outbox.size, pending:pending.length, processed:delivered + failed, delivered, failed };
}

export function toProductionLeadPayload(request) {
  if (!request || !REQUEST_ID_PATTERN.test(String(request.id || ""))) throw new Error("Invalid quote request record");
  const items = compactItems(request.items);
  const first = items[0] || {};
  const type = request.requestType === "quick_order"
    ? "one_click"
    : request.requestType === "selection" ? "equipment_selection" : items.length > 1 ? "cart_quote" : "product_quote";
  const checks = request.requestedChecks && typeof request.requestedChecks === "object" ? request.requestedChecks : {};
  return {
    type,
    submissionId:`new-${request.id}`,
    phone:clean(request.phone, 40),
    email:clean(request.email, 160),
    company:clean(request.company, 180),
    inn:clean(request.billingInn, 20),
    message:clean(request.comment, 3_000) || `Запрос ${request.id} с новой витрины 7TOOL`,
    productId:clean(first.id, 120),
    variantId:clean(String(first.id || "").startsWith("variant:") ? String(first.id).slice(8) : "", 120),
    productTitle:clean(first.title, 500),
    category:"new-storefront",
    intent:type,
    ctaKey:`new_${request.requestType}`,
    consent:true,
    extra:{
      newRequestId:request.id,
      sourcePage:clean(request.source?.pagePath, 500),
      city:clean(request.city, 180),
      alternatives:Boolean(request.alternatives),
      requestedChecks:{ availability:Boolean(checks.availability), compatibility:Boolean(checks.compatibility), documents:Boolean(checks.documents) },
      totalPositions:items.length,
      totalQuantity:items.reduce((sum, item) => sum + item.quantity, 0),
      items,
      source:{
        utmSource:clean(request.source?.utmSource, 300),
        utmMedium:clean(request.source?.utmMedium, 300),
        utmCampaign:clean(request.source?.utmCampaign, 300),
      },
    },
  };
}

async function buildOutboundRequest(request, dataDir) {
  const payload = toProductionLeadPayload(request);
  const attachment = normalizeAttachment(request.attachment, request.id, dataDir);
  if (!attachment) return { headers:{ "content-type":"application/json", "user-agent":"7tool-new-intake-bridge/1.0" }, body:JSON.stringify(payload) };
  const bytes = await readFile(attachment.absolutePath);
  if (bytes.length !== attachment.size) throw new Error("Attachment size mismatch");
  const form = new FormData();
  form.set("payload", JSON.stringify(payload));
  form.set(attachment.kind === "specification" ? "specification" : "requisites", new Blob([bytes], { type:attachment.mime }), attachment.originalName);
  return { headers:{ "user-agent":"7tool-new-intake-bridge/1.0" }, body:form };
}

function normalizeAttachment(value, requestId, dataDir) {
  if (!value || typeof value !== "object") return null;
  if (!REQUEST_ID_PATTERN.test(requestId) || !new RegExp(`^uploads/${requestId.replace(/[-]/gu, "\\-")}\\.[a-z0-9]+$`, "u").test(String(value.relativePath || ""))) throw new Error("Unsafe attachment path");
  const absolutePath = path.resolve(dataDir, value.relativePath);
  if (!absolutePath.startsWith(`${path.resolve(dataDir)}${path.sep}`)) throw new Error("Unsafe attachment path");
  return {
    absolutePath,
    kind:value.kind === "specification" ? "specification" : "billing",
    mime:clean(value.mime, 120) || "application/octet-stream",
    originalName:clean(value.originalName, 180) || `${requestId}.bin`,
    size:boundedInteger(value.size, 1, 20 * 1024 * 1024, 0),
  };
}

function eligible(record, delivery, now) {
  if (!record || record.deliveryEnabled !== true || record.status !== "pending" || record.transport !== "production-lead-bridge") return false;
  if (!REQUEST_ID_PATTERN.test(String(record.requestId || ""))) return false;
  if (delivery?.status === "delivered") return false;
  if (Number(delivery?.attempts || 0) >= 12) return false;
  const next = delivery?.nextAttemptAt ? new Date(delivery.nextAttemptAt) : null;
  return !next || !Number.isFinite(next.getTime()) || next <= now;
}

function latestByRequest(records) {
  const latest = new Map();
  for (const record of records) if (record && typeof record.requestId === "string") latest.set(record.requestId, record);
  return latest;
}

function compactItems(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 25).map((item) => ({
    id:clean(item?.id, 120),
    title:clean(item?.title, 500),
    article:clean(item?.article, 180),
    quantity:boundedInteger(item?.quantity, 1, 999, 1),
    price:clean(item?.price, 80),
    href:clean(item?.href, 500),
  }));
}

function failureRecord(requestId, attempts, now, errorCode, httpStatus = null) {
  const delay = RETRY_DELAYS_MS[Math.min(attempts - 1, RETRY_DELAYS_MS.length - 1)];
  return { requestId, attemptedAt:now.toISOString(), status:"failed", attempts, errorCode, httpStatus, nextAttemptAt:new Date(now.getTime() + delay).toISOString() };
}

async function appendJournal(filePath, value) {
  const handle = await open(filePath, "a");
  try {
    await handle.writeFile(`${JSON.stringify(value)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function readJsonLines(filePath) {
  try {
    const source = await readFile(filePath, "utf8");
    return source.split("\n").filter(Boolean).flatMap((line) => {
      try { return [JSON.parse(line)]; } catch { return []; }
    });
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

async function safeJson(response) {
  try { return JSON.parse(await response.text()); } catch { return null; }
}

function validateEndpoint(value) {
  if (value !== PRODUCTION_ENDPOINT) throw new Error(`QUOTE_INTAKE_DELIVERY_ENDPOINT must equal ${PRODUCTION_ENDPOINT}`);
  return value;
}

function clean(value, limit) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/gu, " ").replace(/\s+/gu, " ").trim().slice(0, limit);
}

function boundedInteger(value, minimum, maximum, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

class DeliveryError extends Error {
  constructor(code, httpStatus) {
    super(code);
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

const entry = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (entry === import.meta.url) {
  processQuoteIntakeOutbox().then((result) => {
    console.log(JSON.stringify(result));
    if (result.failed > 0) process.exitCode = 1;
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
