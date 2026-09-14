import { authorizeManagerRequest } from "../../data/managerAccessServer.ts";
import { isQuoteTestModeEnabled, QuoteWorkflowError } from "../../data/quoteRequestStore.ts";
import { isSameOriginRequest } from "../../data/requestOrigin.ts";
import { getShippingRuntimeDiagnostic, invalidateShippingRuntimeSettingsCache } from "../../data/shippingRuntimeSettings.mjs";
import { getShippingSettings, saveShippingSettings } from "../../data/shippingSettingsStore.ts";
import { createMemoryRateLimiter } from "../../data/quoteRequestValidation.mjs";

const limiter = createMemoryRateLimiter({ limit:20, windowMs:10 * 60 * 1000 });

export async function GET(request: Request) {
  if (!isQuoteTestModeEnabled()) return Response.json({ ok:false, message:"Настройки отгрузки отключены." }, { status:503 });
  const access = await authorizeManagerRequest(request, "settings:manage");
  if (!access.ok) return access.response;
  return Response.json({ ok:true, settings:await getShippingSettings(), diagnostic:getShippingRuntimeDiagnostic() }, { headers:{ "Cache-Control":"no-store" } });
}

export async function PUT(request: Request) {
  if (!isQuoteTestModeEnabled()) return Response.json({ ok:false, message:"Настройки отгрузки отключены." }, { status:503 });
  const access = await authorizeManagerRequest(request, "settings:manage");
  if (!access.ok) return access.response;
  if (!isSameOriginRequest(request)) return Response.json({ ok:false, message:"Запрос отклонён проверкой источника." }, { status:403 });
  if (Number(request.headers.get("content-length") ?? 0) > 30_000) return Response.json({ ok:false, message:"Настройки превышают допустимый размер." }, { status:413 });
  const clientKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local-shipping-settings";
  const rate = limiter.check(clientKey);
  if (!rate.allowed) return Response.json({ ok:false, message:"Слишком много сохранений. Повторите позже." }, { status:429, headers:{ "Retry-After":String(rate.retryAfterSeconds) } });
  try {
    const settings = await saveShippingSettings(await request.json() as Parameters<typeof saveShippingSettings>[0]);
    invalidateShippingRuntimeSettingsCache();
    return Response.json({ ok:true, settings, diagnostic:getShippingRuntimeDiagnostic() }, { headers:{ "Cache-Control":"no-store" } });
  } catch (error) {
    if (error instanceof QuoteWorkflowError) return Response.json({ ok:false, message:error.message }, { status:error.status });
    console.error("[shipping-settings] settings could not be saved", error instanceof Error ? error.message : "unknown error");
    return Response.json({ ok:false, message:"Не удалось сохранить настройки отгрузки." }, { status:500 });
  }
}
