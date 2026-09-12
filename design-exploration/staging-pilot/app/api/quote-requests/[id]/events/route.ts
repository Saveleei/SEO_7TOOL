import { appendQuoteRequestEvent, isQuoteTestModeEnabled, QuoteWorkflowError } from "../../../../data/quoteRequestStore";
import { createMemoryRateLimiter } from "../../../../data/quoteRequestValidation.mjs";

const limiter = createMemoryRateLimiter({ limit:30, windowMs:10 * 60 * 1000 });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isQuoteTestModeEnabled()) return Response.json({ ok:false, message:"Рабочее место менеджера отключено." }, { status:503 });
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin && origin !== requestUrl.origin) return Response.json({ ok:false, message:"Запрос отклонён проверкой источника." }, { status:403 });
  if (Number(request.headers.get("content-length") ?? 0) > 20_000) return Response.json({ ok:false, message:"Данные действия слишком большие." }, { status:413 });

  const clientKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local-manager";
  const rate = limiter.check(clientKey);
  if (!rate.allowed) return Response.json({ ok:false, message:"Слишком много действий. Повторите позже." }, { status:429, headers:{ "Retry-After":String(rate.retryAfterSeconds) } });

  try {
    const { id } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const result = await appendQuoteRequestEvent({
      requestId:id,
      idempotencyKey:String(body.idempotencyKey ?? ""),
      type:String(body.type ?? ""),
      status:body.status == null ? undefined : String(body.status),
      assignee:body.assignee == null ? undefined : String(body.assignee),
      note:body.note == null ? undefined : String(body.note),
    });
    return Response.json({ ok:true, duplicate:result.duplicate, eventId:result.event.id }, { status:result.duplicate ? 200 : 201, headers:{ "Cache-Control":"no-store" } });
  } catch (error) {
    if (error instanceof QuoteWorkflowError) return Response.json({ ok:false, message:error.message }, { status:error.status });
    console.error("[quote-test] manager action could not be saved", error instanceof Error ? error.message : "unknown error");
    return Response.json({ ok:false, message:"Не удалось сохранить действие. Повторите ещё раз." }, { status:500 });
  }
}
