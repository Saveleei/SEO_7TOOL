import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { recordCoreWebVital } from "@/lib/google-seo.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 4_096;
const MAX_EVENTS_PER_MINUTE = 1_200;
let rateWindowStartedAt = 0;
let rateWindowEvents = 0;

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const originUrl = new URL(origin);
    const expectedHost = request.headers.get("x-forwarded-host") || request.headers.get("host") || new URL(request.url).host;
    return originUrl.host === expectedHost;
  } catch {
    return false;
  }
}

function withinGlobalRateLimit(now: number) {
  if (now - rateWindowStartedAt >= 60_000) {
    rateWindowStartedAt = now;
    rateWindowEvents = 0;
  }
  rateWindowEvents += 1;
  return rateWindowEvents <= MAX_EVENTS_PER_MINUTE;
}

export async function POST(request: Request) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_BODY_BYTES) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  if (!sameOrigin(request)) return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  if (!withinGlobalRateLimit(Date.now())) return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  try {
    const source = await request.text();
    if (new TextEncoder().encode(source).byteLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }
    const payload = JSON.parse(source);
    recordCoreWebVital(db(), { ...payload, capturedAt: Date.now() });
    return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Invalid Core Web Vital" }, { status: 400 });
  }
}
