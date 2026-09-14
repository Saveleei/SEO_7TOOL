import { authorizeManagerRequest } from "../../data/managerAccessServer.ts";
import { isQuoteTestModeEnabled, QuoteWorkflowError } from "../../data/quoteRequestStore.ts";
import { createMemoryRateLimiter } from "../../data/quoteRequestValidation.mjs";
import { isSameOriginRequest } from "../../data/requestOrigin.ts";
import { getTrustContentSettings, resetTrustContentSettings, saveTrustContentSettings } from "../../data/trustContentStore.ts";

const limiter = createMemoryRateLimiter({ limit:20, windowMs:10 * 60 * 1000 });

export async function GET(request: Request) {
  if (!isQuoteTestModeEnabled()) return Response.json({ ok:false, message:"Управление контентом отключено." }, { status:503 });
  const access = await authorizeManagerRequest(request, "settings:manage");
  if (!access.ok) return access.response;
  return Response.json({ ok:true, settings:await getTrustContentSettings() }, { headers:{ "Cache-Control":"no-store" } });
}

export async function PUT(request: Request) {
  const access = await authorizeWrite(request);
  if (access) return access;
  try {
    const settings = await saveTrustContentSettings(await request.json() as Parameters<typeof saveTrustContentSettings>[0]);
    return Response.json({ ok:true, settings }, { headers:{ "Cache-Control":"no-store" } });
  } catch (error) {
    return settingsError(error);
  }
}

export async function DELETE(request: Request) {
  const access = await authorizeWrite(request);
  if (access) return access;
  try {
    const body = await request.json() as { revision?: number };
    const settings = await resetTrustContentSettings(Number(body.revision));
    return Response.json({ ok:true, settings }, { headers:{ "Cache-Control":"no-store" } });
  } catch (error) {
    return settingsError(error);
  }
}

async function authorizeWrite(request: Request): Promise<Response | null> {
  if (!isQuoteTestModeEnabled()) return Response.json({ ok:false, message:"Управление контентом отключено." }, { status:503 });
  const access = await authorizeManagerRequest(request, "settings:manage");
  if (!access.ok) return access.response;
  if (!isSameOriginRequest(request)) return Response.json({ ok:false, message:"Запрос отклонён проверкой источника." }, { status:403 });
  if (Number(request.headers.get("content-length") ?? 0) > 50_000) return Response.json({ ok:false, message:"Содержимое превышает допустимый размер." }, { status:413 });
  const clientKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local-trust-content";
  const rate = limiter.check(clientKey);
  if (!rate.allowed) return Response.json({ ok:false, message:"Слишком много сохранений. Повторите позже." }, { status:429, headers:{ "Retry-After":String(rate.retryAfterSeconds) } });
  return null;
}

function settingsError(error: unknown) {
  if (error instanceof QuoteWorkflowError) return Response.json({ ok:false, message:error.message }, { status:error.status });
  console.error("[quote-test] trust content could not be saved", error instanceof Error ? error.message : "unknown error");
  return Response.json({ ok:false, message:"Не удалось сохранить блок доверия." }, { status:500 });
}
