import { getCatalogParameterOverrideSettings, saveCatalogParameterOverrideDraft, type CatalogParameterProductIdentity } from "../../data/catalogParameterOverrideStore.ts";
import { getPublishedFeedCatalogSnapshot } from "../../data/feedCatalog.ts";
import { authorizeManagerRequest } from "../../data/managerAccessServer.ts";
import { isQuoteTestModeEnabled, QuoteWorkflowError } from "../../data/quoteRequestStore.ts";
import { createMemoryRateLimiter } from "../../data/quoteRequestValidation.mjs";
import { isSameOriginRequest } from "../../data/requestOrigin.ts";

const limiter = createMemoryRateLimiter({ limit:40, windowMs:10 * 60 * 1000 });

export async function GET(request: Request) {
  if (!isQuoteTestModeEnabled()) return Response.json({ ok:false, message:"Управление характеристиками отключено." }, { status:503 });
  const access = await authorizeManagerRequest(request, "catalog:manage");
  if (!access.ok) return access.response;
  return Response.json({ ok:true, settings:await getCatalogParameterOverrideSettings() }, { headers:{ "Cache-Control":"no-store" } });
}

export async function POST(request: Request) {
  if (!isQuoteTestModeEnabled()) return Response.json({ ok:false, message:"Управление характеристиками отключено." }, { status:503 });
  const access = await authorizeManagerRequest(request, "catalog:manage");
  if (!access.ok) return access.response;
  if (!isSameOriginRequest(request)) return Response.json({ ok:false, message:"Запрос отклонён проверкой источника." }, { status:403 });
  if (Number(request.headers.get("content-length") ?? 0) > 60_000) return Response.json({ ok:false, message:"Черновик превышает допустимый размер." }, { status:413 });
  const rate = limiter.check(request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local-catalog-parameters");
  if (!rate.allowed) return Response.json({ ok:false, message:"Слишком много изменений. Повторите позже." }, { status:429, headers:{ "Retry-After":String(rate.retryAfterSeconds) } });
  try {
    const body = await request.json() as { productId?: unknown; parameters?: unknown; sourceUrl?: unknown; note?: unknown; revision?: unknown };
    const product = productIdentity(body.productId);
    const settings = await saveCatalogParameterOverrideDraft({
      product,
      parameters:body.parameters,
      sourceUrl:body.sourceUrl,
      note:body.note,
      revision:Number(body.revision),
      actor:access.actor,
    });
    return Response.json({ ok:true, settings, record:settings.records.find((entry) => entry.id === product.id) }, { status:201, headers:{ "Cache-Control":"no-store" } });
  } catch (error) {
    return parameterError(error, "Не удалось сохранить черновик характеристик.");
  }
}

function productIdentity(value: unknown): CatalogParameterProductIdentity {
  const id = typeof value === "string" ? value.trim().slice(0, 180) : "";
  const product = getPublishedFeedCatalogSnapshot().products.find((entry) => entry.id === id);
  if (!product) throw new QuoteWorkflowError("Товар не найден в текущем снимке фида.", 404);
  return { id:product.id, slug:product.slug, brand:product.brand, sku:product.sku, title:product.title, variants:product.variants.map((variant) => ({ id:variant.id, sku:variant.sku, name:variant.name })) };
}

function parameterError(error: unknown, fallback: string) {
  if (error instanceof QuoteWorkflowError) return Response.json({ ok:false, message:error.message }, { status:error.status });
  console.error("[quote-test] catalog parameters could not be saved", error instanceof Error ? error.message : "unknown error");
  return Response.json({ ok:false, message:fallback }, { status:500 });
}
