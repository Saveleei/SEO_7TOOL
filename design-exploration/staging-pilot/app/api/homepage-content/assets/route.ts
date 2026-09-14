import { saveHomepageAsset } from "../../../data/homepageAssetStore.ts";
import { authorizeManagerRequest } from "../../../data/managerAccessServer.ts";
import { isQuoteTestModeEnabled, QuoteWorkflowError } from "../../../data/quoteRequestStore.ts";
import { createMemoryRateLimiter } from "../../../data/quoteRequestValidation.mjs";
import { isSameOriginRequest } from "../../../data/requestOrigin.ts";

const limiter = createMemoryRateLimiter({ limit:18, windowMs:10 * 60 * 1000 });

export async function POST(request: Request) {
  if (!isQuoteTestModeEnabled()) return Response.json({ ok:false, message:"Управление главной страницей отключено." }, { status:503 });
  const access = await authorizeManagerRequest(request, "settings:manage");
  if (!access.ok) return access.response;
  if (!isSameOriginRequest(request)) return Response.json({ ok:false, message:"Запрос отклонён проверкой источника." }, { status:403 });
  if (Number(request.headers.get("content-length") ?? 0) > 2_200_000) return Response.json({ ok:false, message:"Файл превышает допустимый размер." }, { status:413 });
  const clientKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local-homepage-asset";
  const rate = limiter.check(clientKey);
  if (!rate.allowed) return Response.json({ ok:false, message:"Слишком много загрузок. Повторите позже." }, { status:429, headers:{ "Retry-After":String(rate.retryAfterSeconds) } });
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new QuoteWorkflowError("Выберите фотографию.", 400);
    const asset = await saveHomepageAsset(file);
    return Response.json({ ok:true, ...asset, url:`/api/homepage-content/assets/${asset.assetId}` }, { status:201, headers:{ "Cache-Control":"no-store" } });
  } catch (error) {
    if (error instanceof QuoteWorkflowError) return Response.json({ ok:false, message:error.message }, { status:error.status });
    console.error("[quote-test] homepage asset could not be saved", error instanceof Error ? error.message : "unknown error");
    return Response.json({ ok:false, message:"Не удалось загрузить фотографию." }, { status:500 });
  }
}
