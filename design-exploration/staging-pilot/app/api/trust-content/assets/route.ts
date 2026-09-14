import { authorizeManagerRequest } from "../../../data/managerAccessServer.ts";
import { isQuoteTestModeEnabled, QuoteWorkflowError } from "../../../data/quoteRequestStore.ts";
import { createMemoryRateLimiter } from "../../../data/quoteRequestValidation.mjs";
import { isSameOriginRequest } from "../../../data/requestOrigin.ts";
import { saveTrustAsset } from "../../../data/trustAssetStore.ts";

const limiter = createMemoryRateLimiter({ limit:12, windowMs:10 * 60 * 1000 });

export async function POST(request: Request) {
  if (!isQuoteTestModeEnabled()) return Response.json({ ok:false, message:"Управление контентом отключено." }, { status:503 });
  const access = await authorizeManagerRequest(request, "settings:manage");
  if (!access.ok) return access.response;
  if (!isSameOriginRequest(request)) return Response.json({ ok:false, message:"Запрос отклонён проверкой источника." }, { status:403 });
  if (Number(request.headers.get("content-length") ?? 0) > 2_200_000) return Response.json({ ok:false, message:"Файл превышает допустимый размер." }, { status:413 });
  const clientKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local-trust-asset";
  const rate = limiter.check(clientKey);
  if (!rate.allowed) return Response.json({ ok:false, message:"Слишком много загрузок. Повторите позже." }, { status:429, headers:{ "Retry-After":String(rate.retryAfterSeconds) } });
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new QuoteWorkflowError("Выберите фотографию.", 400);
    const asset = await saveTrustAsset(file);
    return Response.json({ ok:true, ...asset, url:`/api/trust-content/assets/${asset.assetId}` }, { status:201, headers:{ "Cache-Control":"no-store" } });
  } catch (error) {
    if (error instanceof QuoteWorkflowError) return Response.json({ ok:false, message:error.message }, { status:error.status });
    console.error("[quote-test] trust asset could not be saved", error instanceof Error ? error.message : "unknown error");
    return Response.json({ ok:false, message:"Не удалось загрузить фотографию." }, { status:500 });
  }
}
