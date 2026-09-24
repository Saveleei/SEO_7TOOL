import { updateCatalogParameterOverride, type CatalogParameterProductIdentity } from "../../../data/catalogParameterOverrideStore.ts";
import { getPublishedFeedCatalogSnapshot } from "../../../data/feedCatalog.ts";
import { authorizeManagerRequest } from "../../../data/managerAccessServer.ts";
import { isQuoteTestModeEnabled, QuoteWorkflowError } from "../../../data/quoteRequestStore.ts";
import { createMemoryRateLimiter } from "../../../data/quoteRequestValidation.mjs";
import { isSameOriginRequest } from "../../../data/requestOrigin.ts";

const limiter = createMemoryRateLimiter({ limit:60, windowMs:10 * 60 * 1000 });
const actions = new Set(["publish", "discard_draft", "disable", "enable", "restore"]);

export async function PATCH(request: Request, context: { params: Promise<{ productId: string }> }) {
  if (!isQuoteTestModeEnabled()) return Response.json({ ok:false, message:"Управление характеристиками отключено." }, { status:503 });
  const access = await authorizeManagerRequest(request, "catalog:manage");
  if (!access.ok) return access.response;
  if (!isSameOriginRequest(request)) return Response.json({ ok:false, message:"Запрос отклонён проверкой источника." }, { status:403 });
  if (Number(request.headers.get("content-length") ?? 0) > 10_000) return Response.json({ ok:false, message:"Запрос превышает допустимый размер." }, { status:413 });
  const rate = limiter.check(request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local-catalog-parameter-action");
  if (!rate.allowed) return Response.json({ ok:false, message:"Слишком много изменений. Повторите позже." }, { status:429, headers:{ "Retry-After":String(rate.retryAfterSeconds) } });
  try {
    const { productId } = await context.params;
    const product = productIdentity(productId);
    const body = await request.json() as { action?: unknown; versionId?: unknown; revision?: unknown };
    if (!actions.has(String(body.action))) throw new QuoteWorkflowError("Неизвестное действие с характеристиками.", 400);
    const settings = await updateCatalogParameterOverride({
      product,
      action:body.action as "publish" | "discard_draft" | "disable" | "enable" | "restore",
      versionId:body.versionId,
      revision:Number(body.revision),
      actor:access.actor,
    });
    return Response.json({ ok:true, settings, record:settings.records.find((entry) => entry.id === product.id) }, { headers:{ "Cache-Control":"no-store" } });
  } catch (error) {
    if (error instanceof QuoteWorkflowError) return Response.json({ ok:false, message:error.message }, { status:error.status });
    console.error("[quote-test] catalog parameter action failed", error instanceof Error ? error.message : "unknown error");
    return Response.json({ ok:false, message:"Не удалось изменить характеристики." }, { status:500 });
  }
}

function productIdentity(rawId: string): CatalogParameterProductIdentity {
  const id = decodeURIComponent(rawId).trim().slice(0, 180);
  const product = getPublishedFeedCatalogSnapshot().products.find((entry) => entry.id === id);
  if (!product) throw new QuoteWorkflowError("Товар не найден в текущем снимке фида.", 404);
  return { id:product.id, slug:product.slug, brand:product.brand, sku:product.sku, title:product.title, variants:product.variants.map((variant) => ({ id:variant.id, sku:variant.sku, name:variant.name })) };
}
