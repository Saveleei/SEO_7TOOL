import { NextResponse, type NextRequest } from "next/server";
import { submitLead, type LeadPayload, type LeadType, type LeadUploadedFile } from "@/lib/leads";
import { storeLeadDocument, type LeadDocumentKind } from "@/lib/specification-storage";

export const runtime = "nodejs";

const ALLOWED: LeadType[] = ["contact_form", "cart_quote", "product_quote", "one_click", "price_match", "equipment_selection", "landing_quote"];
const MAX_JSON_BYTES = 24_000;
const MAX_MULTIPART_BYTES = 20 * 1024 * 1024 + 120_000;
const WINDOW_MS = 10 * 60_000;
const LIMIT = 6;
const buckets = new Map<string, number[]>();

function text(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const clean = value.replace(/\0/g, "").trim().slice(0, max);
  return clean || undefined;
}

function safeSiteUrl(value: unknown, allowedQueryKeys: readonly string[]): string | undefined {
  const raw = text(value, 1_000);
  if (!raw) return undefined;
  try {
    const url = new URL(raw, "https://7tool.ru");
    if (url.protocol !== "https:" || !/^(?:www\.)?7tool\.ru$/i.test(url.hostname)) return undefined;
    const safe = new URL(url.pathname, "https://7tool.ru");
    for (const key of allowedQueryKeys) {
      const item = url.searchParams.get(key);
      if (item) safe.searchParams.set(key, item.slice(0, 500));
    }
    return safe.toString();
  } catch {
    return undefined;
  }
}

function safeReferrer(value: unknown): string | undefined {
  const raw = text(value, 1_000);
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (!/^(?:https?:)$/.test(url.protocol)) return undefined;
    return `${url.origin}${url.pathname}`.slice(0, 500);
  } catch { return undefined; }
}

function safeTouch(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const) {
    const item = text(raw[key], 500);
    if (item) output[key] = item;
  }
  const yclid = text(raw.yclid, 200);
  if (yclid && /^[A-Za-z0-9_-]{6,200}$/.test(yclid)) output.yclid = yclid;
  const landingPage = safeSiteUrl(raw.landingPage, ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "yclid", "variant"]);
  const referrer = safeReferrer(raw.referrer);
  const capturedAt = text(raw.capturedAt, 80);
  if (landingPage) output.landingPage = landingPage;
  if (referrer) output.referrer = referrer;
  if (capturedAt) output.capturedAt = capturedAt;
  return output;
}

function safeAttribution(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  const firstTouch = safeTouch(raw.firstTouch);
  const lastNonDirect = safeTouch(raw.lastNonDirect);
  if (firstTouch) output.firstTouch = firstTouch;
  if (lastNonDirect) output.lastNonDirect = lastNonDirect;
  const yclid = text(raw.yclid, 200);
  const ymClientId = text(raw.ymClientId, 40);
  const internalClientId = text(raw.internalClientId, 120);
  if (yclid && /^[A-Za-z0-9_-]{6,200}$/.test(yclid)) output.yclid = yclid;
  if (ymClientId && /^\d{3,40}$/.test(ymClientId)) output.ymClientId = ymClientId;
  if (internalClientId && /^[A-Za-z0-9_-]{8,120}$/.test(internalClientId)) output.internalClientId = internalClientId;
  const landingPage = safeSiteUrl(raw.landingPage, ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "yclid", "variant"]);
  const referrer = safeReferrer(raw.referrer);
  const firstVisitAt = text(raw.firstVisitAt, 80);
  if (landingPage) output.landingPage = landingPage;
  if (referrer) output.referrer = referrer;
  if (firstVisitAt) output.firstVisitAt = firstVisitAt;
  return output;
}

function limited(ip: string): boolean {
  const now = Date.now();
  const hits = (buckets.get(ip) ?? []).filter((timestamp) => now - timestamp < WINDOW_MS);
  if (hits.length >= LIMIT) {
    buckets.set(ip, hits);
    return true;
  }
  hits.push(now);
  buckets.set(ip, hits);
  if (buckets.size > 2_000) {
    for (const [key, values] of buckets) {
      if (!values.some((timestamp) => now - timestamp < WINDOW_MS)) buckets.delete(key);
    }
  }
  return false;
}

function publicRequestHost(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwarded || req.headers.get("host")?.trim() || req.nextUrl.host;
  return host.toLowerCase();
}

export async function POST(req: NextRequest) {
  const declaredLength = Number(req.headers.get("content-length") || 0);
  const multipart = req.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data") ?? false;
  if (declaredLength > (multipart ? MAX_MULTIPART_BYTES : MAX_JSON_BYTES)) {
    return NextResponse.json({ ok: false, error: "PAYLOAD_TOO_LARGE" }, { status: 413 });
  }
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      // За reverse proxy req.nextUrl.host может быть внутренним 127.0.0.1:PORT.
      // Сравниваем Origin с публичным Host, который передал прокси.
      if (new URL(origin).host.toLowerCase() !== publicRequestHost(req)) {
        return NextResponse.json({ ok: false, error: "BAD_ORIGIN" }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ ok: false, error: "BAD_ORIGIN" }, { status: 403 });
    }
  }
  let body: Partial<LeadPayload> & Record<string, unknown> = {};
  const documents: Array<{ kind: LeadDocumentKind; file: File }> = [];
  try {
    if (multipart) {
      const data = await req.formData();
      const payload = data.get("payload");
      body = typeof payload === "string" ? JSON.parse(payload) as typeof body : {};
      for (const kind of ["specification", "requisites"] as const) {
        const candidate = data.get(kind);
        if (candidate instanceof File && candidate.size > 0) documents.push({ kind, file: candidate });
      }
    } else {
      body = await req.json();
    }
  } catch { /* пустое или некорректное тело */ }
  if (JSON.stringify(body).length > MAX_JSON_BYTES) {
    return NextResponse.json({ ok: false, error: "PAYLOAD_TOO_LARGE" }, { status: 413 });
  }
  if (typeof body.website === "string" && body.website.trim()) {
    return NextResponse.json({ ok: true });
  }
  if (body.consent !== true) {
    return NextResponse.json({ ok: false, error: "CONSENT_REQUIRED" }, { status: 400 });
  }
  const type = body.type as LeadType | undefined;
  if (!type || !ALLOWED.includes(type)) {
    return NextResponse.json({ ok: false, error: "BAD_TYPE" }, { status: 400 });
  }
  const phone = text(body.phone, 40) ?? "";
  const email = text(body.email, 160) ?? "";
  if (!phone && !email) {
    return NextResponse.json({ ok: false, error: "PHONE_OR_EMAIL_REQUIRED" }, { status: 400 });
  }
  if (phone && phone.replace(/\D/g, "").length < 10) {
    return NextResponse.json({ ok: false, error: "BAD_PHONE" }, { status: 400 });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(email)) {
    return NextResponse.json({ ok: false, error: "BAD_EMAIL" }, { status: 400 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
  if (limited(ip)) {
    return NextResponse.json(
      { ok: false, error: "RATE_LIMIT" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(WINDOW_MS / 1000)) } },
    );
  }
  const ua = req.headers.get("user-agent") || null;
  let extra: Record<string, unknown> | undefined;
  if (typeof body.extra === "object" && body.extra !== null) {
    const serialized = JSON.stringify(body.extra);
    const parsed = serialized.length <= 8_000
      ? JSON.parse(serialized) as Record<string, unknown>
      : { truncated: serialized.slice(0, 7_800) };
    const attribution = safeAttribution(parsed.attribution);
    extra = { ...parsed, ...(attribution ? { attribution } : {}) };
    if (!attribution) delete extra.attribution;
  }
  const uploadedFiles: LeadUploadedFile[] = [];
  for (const document of documents) {
    try {
      const stored = await storeLeadDocument(document.file, document.kind);
      uploadedFiles.push({
        kind: document.kind,
        path: stored.path,
        originalName: document.file.name.slice(0, 180),
        size: document.file.size,
        scanStatus: stored.scanStatus,
      });
    } catch (error) {
      return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "BAD_FILE" }, { status: 400 });
    }
  }
  const uploadedFile = uploadedFiles[0]?.path;
  if (uploadedFiles.length) {
    extra = {
      ...(extra ?? {}),
      documents: uploadedFiles.map(({ kind, originalName, size, scanStatus }) => ({ kind, originalName, size, scanStatus })),
    };
  }
  const r = await submitLead(
    {
      type,
      submissionId: text(body.submissionId, 120),
      name: text(body.name, 120),
      phone,
      email,
      company: text(body.company, 180),
      inn: text(body.inn, 20),
      message: text(body.message, 4_000),
      productId: text(body.productId, 120),
      variantId: text(body.variantId, 120),
      productTitle: text(body.productTitle, 500),
      productUrl: safeSiteUrl(body.productUrl, ["variant"]),
      pageUrl: safeSiteUrl(body.pageUrl, ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "yclid", "variant"]),
      extra,
      uploadedFile,
      uploadedFiles,
    },
    { ip: ip === "unknown" ? null : ip, userAgent: ua },
  );
  return NextResponse.json(r);
}
