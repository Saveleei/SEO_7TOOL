import { saveQuoteDraft } from "../../../../data/quoteDraftStore";
import { isQuoteTestModeEnabled, QuoteWorkflowError } from "../../../../data/quoteRequestStore";
import { createMemoryRateLimiter } from "../../../../data/quoteRequestValidation.mjs";

const limiter = createMemoryRateLimiter({ limit:20, windowMs:10 * 60 * 1000 });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isQuoteTestModeEnabled()) return Response.json({ ok:false, message:"Конструктор КП отключён." }, { status:503 });
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin && origin !== requestUrl.origin) return Response.json({ ok:false, message:"Запрос отклонён проверкой источника." }, { status:403 });
  if (Number(request.headers.get("content-length") ?? 0) > 200_000) return Response.json({ ok:false, message:"Черновик превышает допустимый размер." }, { status:413 });
  const clientKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local-quote-builder";
  const rate = limiter.check(clientKey);
  if (!rate.allowed) return Response.json({ ok:false, message:"Слишком много сохранений. Повторите позже." }, { status:429, headers:{ "Retry-After":String(rate.retryAfterSeconds) } });
  try {
    const { id } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const result = await saveQuoteDraft(id, {
      idempotencyKey:String(body.idempotencyKey ?? ""),
      status:String(body.status ?? "draft"),
      validityDays:body.validityDays,
      vatRate:body.vatRate,
      paymentTerms:body.paymentTerms,
      deliveryTerms:body.deliveryTerms,
      managerComment:body.managerComment,
      items:body.items,
    });
    return Response.json({ ok:true, duplicate:result.duplicate, quoteId:result.draft.id, revision:result.draft.revision, status:result.draft.status, totalRub:result.draft.totalRub }, { status:result.duplicate ? 200 : 201, headers:{ "Cache-Control":"no-store" } });
  } catch (error) {
    if (error instanceof QuoteWorkflowError) return Response.json({ ok:false, message:error.message }, { status:error.status });
    console.error("[quote-test] draft could not be saved", error instanceof Error ? error.message : "unknown error");
    return Response.json({ ok:false, message:"Не удалось сохранить черновик КП." }, { status:500 });
  }
}
