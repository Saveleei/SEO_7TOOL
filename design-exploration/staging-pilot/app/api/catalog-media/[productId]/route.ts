import { getPublishedFeedCatalogSnapshot } from "../../../data/feedCatalog.ts";
import { updateCatalogProductMedia, type CatalogProductIdentity } from "../../../data/catalogProductMediaStore.ts";
import { authorizeManagerRequest } from "../../../data/managerAccessServer.ts";
import { isQuoteTestModeEnabled, QuoteWorkflowError } from "../../../data/quoteRequestStore.ts";
import { createMemoryRateLimiter } from "../../../data/quoteRequestValidation.mjs";
import { isSameOriginRequest } from "../../../data/requestOrigin.ts";

const limiter = createMemoryRateLimiter({ limit:40, windowMs:10 * 60 * 1000 });
const actions = new Set(["publish", "disable", "enable", "restore", "discard_draft"]);

export async function PATCH(request: Request, context: { params: Promise<{ productId: string }> }) {
  if (!isQuoteTestModeEnabled()) return Response.json({ ok:false, message:"Управление фотографиями отключено." }, { status:503 });
  const access = await authorizeManagerRequest(request, "settings:manage");
  if (!access.ok) return access.response;
  if (!isSameOriginRequest(request)) return Response.json({ ok:false, message:"Запрос отклонён проверкой источника." }, { status:403 });
  if (Number(request.headers.get("content-length") ?? 0) > 10_000) return Response.json({ ok:false, message:"Запрос превышает допустимый размер." }, { status:413 });
  const rate = limiter.check(request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local-catalog-media-action");
  if (!rate.allowed) return Response.json({ ok:false, message:"Слишком много изменений. Повторите позже." }, { status:429, headers:{ "Retry-After":String(rate.retryAfterSeconds) } });
  try {
    const { productId } = await context.params;
    const product = productIdentity(productId);
    const body = await request.json() as { action?: string; assetId?: string; revision?: number };
    if (!actions.has(String(body.action))) throw new QuoteWorkflowError("Неизвестное действие с фотографией.", 400);
    if ((body.action === "publish" || body.action === "restore") && hasNativeMedia(product.id)) throw new QuoteWorkflowError("В фиде уже появилась фотография. Ручная версия больше не публикуется.", 409);
    const settings = await updateCatalogProductMedia({
      product,
      action:body.action as "publish" | "disable" | "enable" | "restore" | "discard_draft",
      assetId:body.assetId,
      revision:Number(body.revision),
      actor:access.actor,
    });
    return Response.json({ ok:true, settings, record:settings.records.find((entry) => entry.id === product.id) }, { headers:{ "Cache-Control":"no-store" } });
  } catch (error) {
    if (error instanceof QuoteWorkflowError) return Response.json({ ok:false, message:error.message }, { status:error.status });
    console.error("[quote-test] catalog media action failed", error instanceof Error ? error.message : "unknown error");
    return Response.json({ ok:false, message:"Не удалось изменить фотографию." }, { status:500 });
  }
}

function productIdentity(rawId: string): CatalogProductIdentity {
  const id = decodeURIComponent(rawId).trim().slice(0, 160);
  const product = getPublishedFeedCatalogSnapshot().products.find((entry) => entry.id === id);
  if (!product) throw new QuoteWorkflowError("Товар не найден в текущем снимке фида.", 404);
  return { id:product.id, slug:product.slug, brand:product.brand, sku:product.sku, title:product.title };
}

function hasNativeMedia(productId: string): boolean {
  const product = getPublishedFeedCatalogSnapshot().products.find((entry) => entry.id === productId);
  return Boolean(product?.images?.some(Boolean) || product?.variants.some((variant) => variant.images?.some(Boolean)));
}

