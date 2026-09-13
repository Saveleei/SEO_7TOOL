import { isQuoteTestModeEnabled, QuoteWorkflowError } from "../../data/quoteRequestStore.ts";
import { authorizeManagerRequest } from "../../data/managerAccessServer.ts";
import { getQuoteTemplateSettings, saveQuoteTemplateSettings } from "../../data/quoteTemplateStore.ts";
import { createMemoryRateLimiter } from "../../data/quoteRequestValidation.mjs";
import { isSameOriginRequest } from "../../data/requestOrigin.ts";

const limiter = createMemoryRateLimiter({ limit:20, windowMs:10 * 60 * 1000 });

export async function GET(request: Request) {
  if (!isQuoteTestModeEnabled()) return Response.json({ ok:false, message:"Настройки КП отключены." }, { status:503 });
  const access = await authorizeManagerRequest(request, "settings:manage");
  if (!access.ok) return access.response;
  return Response.json({ ok:true, settings:await getQuoteTemplateSettings() }, { headers:{ "Cache-Control":"no-store" } });
}

export async function PUT(request: Request) {
  if (!isQuoteTestModeEnabled()) return Response.json({ ok:false, message:"Настройки КП отключены." }, { status:503 });
  const access = await authorizeManagerRequest(request, "settings:manage");
  if (!access.ok) return access.response;
  if (!isSameOriginRequest(request)) return Response.json({ ok:false, message:"Запрос отклонён проверкой источника." }, { status:403 });
  if (Number(request.headers.get("content-length") ?? 0) > 100_000) return Response.json({ ok:false, message:"Настройки превышают допустимый размер." }, { status:413 });
  const clientKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local-quote-settings";
  const rate = limiter.check(clientKey);
  if (!rate.allowed) return Response.json({ ok:false, message:"Слишком много сохранений. Повторите позже." }, { status:429, headers:{ "Retry-After":String(rate.retryAfterSeconds) } });
  try {
    const settings = await saveQuoteTemplateSettings(await request.json() as Parameters<typeof saveQuoteTemplateSettings>[0]);
    return Response.json({ ok:true, settings }, { headers:{ "Cache-Control":"no-store" } });
  } catch (error) {
    if (error instanceof QuoteWorkflowError) return Response.json({ ok:false, message:error.message }, { status:error.status });
    console.error("[quote-test] settings could not be saved", error instanceof Error ? error.message : "unknown error");
    return Response.json({ ok:false, message:"Не удалось сохранить настройки КП." }, { status:500 });
  }
}
