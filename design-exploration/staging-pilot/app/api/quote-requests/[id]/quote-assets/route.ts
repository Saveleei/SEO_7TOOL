import { saveQuoteStampAsset } from "../../../../data/quoteAssetStore";
import { isQuoteTestModeEnabled, QuoteWorkflowError } from "../../../../data/quoteRequestStore";
import { createMemoryRateLimiter } from "../../../../data/quoteRequestValidation.mjs";

const limiter = createMemoryRateLimiter({ limit:10, windowMs:10 * 60 * 1000 });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isQuoteTestModeEnabled()) return Response.json({ ok:false, message:"Конструктор КП отключён." }, { status:503 });
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin && origin !== requestUrl.origin) return Response.json({ ok:false, message:"Запрос отклонён проверкой источника." }, { status:403 });
  if (Number(request.headers.get("content-length") ?? 0) > 1_700_000) return Response.json({ ok:false, message:"Файл превышает допустимый размер." }, { status:413 });
  const clientKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local-quote-asset";
  const rate = limiter.check(clientKey);
  if (!rate.allowed) return Response.json({ ok:false, message:"Слишком много загрузок. Повторите позже." }, { status:429, headers:{ "Retry-After":String(rate.retryAfterSeconds) } });
  try {
    const { id } = await context.params;
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new QuoteWorkflowError("Выберите файл печати и подписи.", 400);
    const asset = await saveQuoteStampAsset(id, file);
    return Response.json({ ok:true, ...asset, url:`/api/quote-requests/${encodeURIComponent(id)}/quote-assets/${asset.assetId}` }, { status:201, headers:{ "Cache-Control":"no-store" } });
  } catch (error) {
    if (error instanceof QuoteWorkflowError) return Response.json({ ok:false, message:error.message }, { status:error.status });
    console.error("[quote-test] stamp asset could not be saved", error instanceof Error ? error.message : "unknown error");
    return Response.json({ ok:false, message:"Не удалось сохранить файл печати и подписи." }, { status:500 });
  }
}
