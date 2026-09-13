import { authorizeManagerRequest } from "../../../../data/managerAccessServer.ts";
import { enqueueQuoteDeliveryPackage, getQuoteDeliveryWorkspace } from "../../../../data/quoteDeliveryStore.ts";
import { createMemoryRateLimiter } from "../../../../data/quoteRequestValidation.mjs";
import { isQuoteTestModeEnabled, QuoteWorkflowError } from "../../../../data/quoteRequestStore.ts";
import { isSameOriginRequest } from "../../../../data/requestOrigin.ts";

const limiter = createMemoryRateLimiter({ limit:20, windowMs:10 * 60 * 1000 });

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isQuoteTestModeEnabled()) return Response.json({ ok:false, message:"Очередь отправки КП отключена." }, { status:503 });
  const access = await authorizeManagerRequest(request, "delivery:prepare");
  if (!access.ok) return access.response;
  try {
    const [{ id }, requestUrl] = await Promise.all([context.params, Promise.resolve(new URL(request.url))]);
    const revision = Number(requestUrl.searchParams.get("revision"));
    const workspace = await getQuoteDeliveryWorkspace(id, revision);
    return Response.json({ ok:true, workspace }, { headers:{ "Cache-Control":"no-store" } });
  } catch (error) {
    return errorResponse(error, "Не удалось получить пакет отправки.");
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isQuoteTestModeEnabled()) return Response.json({ ok:false, message:"Очередь отправки КП отключена." }, { status:503 });
  if (!isSameOriginRequest(request)) return Response.json({ ok:false, message:"Запрос отклонён проверкой источника." }, { status:403 });
  if (Number(request.headers.get("content-length") ?? 0) > 20_000) return Response.json({ ok:false, message:"Запрос превышает допустимый размер." }, { status:413 });
  const access = await authorizeManagerRequest(request, "delivery:prepare");
  if (!access.ok) return access.response;
  const clientKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || access.actor.id;
  const rate = limiter.check(clientKey);
  if (!rate.allowed) return Response.json({ ok:false, message:"Слишком много действий. Повторите позже." }, { status:429, headers:{ "Retry-After":String(rate.retryAfterSeconds) } });
  try {
    const { id } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const revision = Number(body.revision);
    const result = await enqueueQuoteDeliveryPackage(id, revision, {
      idempotencyKey:body.idempotencyKey,
      confirmations:body.confirmations,
    }, access.actor);
    return Response.json({ ok:true, ...result }, { status:result.duplicate ? 200 : 201, headers:{ "Cache-Control":"no-store" } });
  } catch (error) {
    return errorResponse(error, "Не удалось зафиксировать пакет во внутренней очереди.");
  }
}

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof QuoteWorkflowError) return Response.json({ ok:false, message:error.message }, { status:error.status, headers:{ "Cache-Control":"no-store" } });
  console.error("[quote-test] delivery package could not be stored", error instanceof Error ? error.message : "unknown error");
  return Response.json({ ok:false, message:fallback }, { status:500, headers:{ "Cache-Control":"no-store" } });
}
