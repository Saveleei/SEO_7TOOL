import { appendQuoteApprovalAction } from "../../../../data/quoteApprovalStore.ts";
import { authorizeManagerRequest } from "../../../../data/managerAccessServer.ts";
import type { ManagerCapability } from "../../../../data/managerAccess.ts";
import { isQuoteTestModeEnabled, QuoteWorkflowError } from "../../../../data/quoteRequestStore.ts";
import { createMemoryRateLimiter } from "../../../../data/quoteRequestValidation.mjs";

const limiter = createMemoryRateLimiter({ limit:30, windowMs:10 * 60 * 1000 });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isQuoteTestModeEnabled()) return Response.json({ ok:false, message:"Согласование КП отключено." }, { status:503 });
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin && origin !== requestUrl.origin) return Response.json({ ok:false, message:"Запрос отклонён проверкой источника." }, { status:403 });
  if (Number(request.headers.get("content-length") ?? 0) > 50_000) return Response.json({ ok:false, message:"Запрос превышает допустимый размер." }, { status:413 });
  const clientKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local-quote-approval";
  const rate = limiter.check(clientKey);
  if (!rate.allowed) return Response.json({ ok:false, message:"Слишком много действий. Повторите позже." }, { status:429, headers:{ "Retry-After":String(rate.retryAfterSeconds) } });
  try {
    const { id } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const actionType = String(body.type ?? "");
    const access = await authorizeManagerRequest(request, capabilityForAction(actionType));
    if (!access.ok) return access.response;
    const revision = Number(body.revision);
    if (!Number.isInteger(revision) || revision < 1) throw new QuoteWorkflowError("Редакция КП не указана.", 400);
    const result = await appendQuoteApprovalAction(id, revision, {
      idempotencyKey:String(body.idempotencyKey ?? ""),
      type:actionType,
      actorName:access.actor.name,
      actorRole:access.actor.roleLabel,
      checks:body.checks,
      note:body.note,
      channel:body.channel,
      recipient:body.recipient,
    });
    return Response.json({ ok:true, ...result }, { status:result.duplicate ? 200 : 201, headers:{ "Cache-Control":"no-store" } });
  } catch (error) {
    if (error instanceof QuoteWorkflowError) return Response.json({ ok:false, message:error.message }, { status:error.status });
    console.error("[quote-test] approval action could not be saved", error instanceof Error ? error.message : "unknown error");
    return Response.json({ ok:false, message:"Не удалось сохранить действие согласования." }, { status:500 });
  }
}

function capabilityForAction(type: string): ManagerCapability {
  if (type === "submitted") return "quotes:edit";
  if (type === "delivery_prepared") return "delivery:prepare";
  return "quotes:approve";
}
