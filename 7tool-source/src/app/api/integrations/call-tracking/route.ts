import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { queueOfflineConversion } from "@/lib/offline-conversions";

export const runtime = "nodejs";

function authorized(request: NextRequest): boolean {
  const expected = process.env.CALL_TRACKING_WEBHOOK_SECRET?.trim();
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!expected || !provided) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(provided);
  return left.length === right.length && timingSafeEqual(left, right);
}

function value(input: unknown, length: number): string | null {
  return typeof input === "string" && input.trim() ? input.trim().slice(0, length) : null;
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const providerCallId = value(body.provider_call_id, 160);
    if (!providerCallId) return NextResponse.json({ ok: false, error: "PROVIDER_CALL_ID_REQUIRED" }, { status: 400 });
    const requestId = value(body.request_id, 160);
    const clientIdRaw = value(body.client_id, 40);
    const clientId = clientIdRaw && /^\d+$/.test(clientIdRaw) ? clientIdRaw : null;
    const yclidRaw = value(body.yclid, 200);
    const yclid = yclidRaw && /^[A-Za-z0-9_-]+$/.test(yclidRaw) ? yclidRaw : null;
    const startedAt = Number(body.started_at);
    const conversionAt = Number.isFinite(startedAt) && startedAt > 0
      ? Math.trunc(startedAt < 1_000_000_000_000 ? startedAt * 1_000 : startedAt)
      : Date.now();
    const duration = Math.max(0, Math.min(86_400, Math.trunc(Number(body.duration_seconds) || 0)));
    const qualified = body.qualified === true;
    const info = db().prepare(`
      INSERT INTO call_tracking_events (
        provider_call_id, request_id, client_id, yclid, source, campaign, answered,
        is_unique, duration_seconds, qualified, result, started_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(provider_call_id) DO UPDATE SET
        request_id=excluded.request_id, client_id=excluded.client_id, yclid=excluded.yclid,
        source=excluded.source, campaign=excluded.campaign, answered=excluded.answered,
        is_unique=excluded.is_unique, duration_seconds=excluded.duration_seconds,
        qualified=excluded.qualified, result=excluded.result
    `).run(
      providerCallId, requestId, clientId, yclid, value(body.source, 160), value(body.campaign, 160),
      body.answered === true ? 1 : 0, (body.is_unique === true || body.unique === true) ? 1 : 0, duration, qualified ? 1 : 0,
      value(body.result, 500), conversionAt, Date.now(),
    );
    if (qualified && requestId) {
      const lead = db().prepare<unknown[], { id: number }>("SELECT id FROM leads WHERE request_id = ?").get(requestId);
      if (lead) queueOfflineConversion(lead.id, "qualified_call", conversionAt, null);
    }
    return NextResponse.json({ ok: true, created: info.changes > 0 });
  } catch {
    return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  }
}
