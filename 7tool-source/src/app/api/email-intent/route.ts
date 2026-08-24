import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

const buckets = new Map<string, number[]>();
const WINDOW_MS = 10 * 60_000;

function limited(ip: string): boolean {
  const now = Date.now();
  const hits = (buckets.get(ip) ?? []).filter((timestamp) => now - timestamp < WINDOW_MS);
  if (hits.length >= 10) return true;
  hits.push(now);
  buckets.set(ip, hits);
  return false;
}

function requestHost(req: NextRequest): string {
  return (req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || req.headers.get("host") || req.nextUrl.host).toLowerCase();
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  try {
    if (origin && new URL(origin).host.toLowerCase() !== requestHost(req)) {
      return NextResponse.json({ ok: false, error: "BAD_ORIGIN" }, { status: 403 });
    }
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
    if (limited(ip)) return NextResponse.json({ ok: false, error: "RATE_LIMIT" }, { status: 429 });
    const body = await req.json() as Record<string, unknown>;
    const category = typeof body.category === "string" ? body.category.slice(0, 120) : "";
    const intent = typeof body.intent === "string" ? body.intent.slice(0, 120) : "";
    if (!category || !intent) return NextResponse.json({ ok: false, error: "BAD_CONTEXT" }, { status: 400 });
    // Это только диагностическое намерение открыть почтовый клиент. Фактического
    // контакта ещё нет, поэтому строка не создаётся в очереди продаж/БД лидов.
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  }
}
