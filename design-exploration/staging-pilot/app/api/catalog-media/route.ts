import { getPublishedFeedCatalogSnapshot } from "../../data/feedCatalog.ts";
import { getCatalogProductMediaSettings, uploadCatalogProductMedia, type CatalogProductIdentity } from "../../data/catalogProductMediaStore.ts";
import { authorizeManagerRequest } from "../../data/managerAccessServer.ts";
import { isQuoteTestModeEnabled, QuoteWorkflowError } from "../../data/quoteRequestStore.ts";
import { createMemoryRateLimiter } from "../../data/quoteRequestValidation.mjs";
import { isSameOriginRequest } from "../../data/requestOrigin.ts";

const limiter = createMemoryRateLimiter({ limit:18, windowMs:10 * 60 * 1000 });

export async function GET(request: Request) {
  if (!isQuoteTestModeEnabled()) return Response.json({ ok:false, message:"Управление фотографиями отключено." }, { status:503 });
  const access = await authorizeManagerRequest(request, "settings:manage");
  if (!access.ok) return access.response;
  return Response.json({ ok:true, settings:await getCatalogProductMediaSettings() }, { headers:{ "Cache-Control":"no-store" } });
}

export async function POST(request: Request) {
  if (!isQuoteTestModeEnabled()) return Response.json({ ok:false, message:"Управление фотографиями отключено." }, { status:503 });
  const access = await authorizeManagerRequest(request, "settings:manage");
  if (!access.ok) return access.response;
  if (!isSameOriginRequest(request)) return Response.json({ ok:false, message:"Запрос отклонён проверкой источника." }, { status:403 });
  if (Number(request.headers.get("content-length") ?? 0) > 5_300_000) return Response.json({ ok:false, message:"Файл превышает допустимый размер." }, { status:413 });
  const clientKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local-catalog-media";
  const rate = limiter.check(clientKey);
  if (!rate.allowed) return Response.json({ ok:false, message:"Слишком много загрузок. Повторите позже." }, { status:429, headers:{ "Retry-After":String(rate.retryAfterSeconds) } });
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new QuoteWorkflowError("Выберите фотографию.", 400);
    const product = productIdentity(form.get("productId"));
    if (hasNativeMedia(product.id)) throw new QuoteWorkflowError("В фиде уже есть фотография товара. Она имеет приоритет и не заменяется вручную.", 409);
    const settings = await uploadCatalogProductMedia({
      product,
      file,
      sourceUrl:form.get("sourceUrl"),
      revision:Number(form.get("revision")),
      actor:access.actor,
    });
    const record = settings.records.find((entry) => entry.id === product.id);
    return Response.json({ ok:true, settings, record }, { status:201, headers:{ "Cache-Control":"no-store" } });
  } catch (error) {
    return mediaError(error, "Не удалось загрузить фотографию.");
  }
}

function productIdentity(value: FormDataEntryValue | null): CatalogProductIdentity {
  const id = typeof value === "string" ? value.trim().slice(0, 160) : "";
  const product = getPublishedFeedCatalogSnapshot().products.find((entry) => entry.id === id);
  if (!product) throw new QuoteWorkflowError("Товар не найден в текущем снимке фида.", 404);
  return { id:product.id, slug:product.slug, brand:product.brand, sku:product.sku, title:product.title };
}

function hasNativeMedia(productId: string): boolean {
  const product = getPublishedFeedCatalogSnapshot().products.find((entry) => entry.id === productId);
  return Boolean(product?.images?.some(Boolean) || product?.variants.some((variant) => variant.images?.some(Boolean)));
}

function mediaError(error: unknown, fallback: string) {
  if (error instanceof QuoteWorkflowError) return Response.json({ ok:false, message:error.message }, { status:error.status });
  console.error("[quote-test] catalog media could not be saved", error instanceof Error ? error.message : "unknown error");
  return Response.json({ ok:false, message:fallback }, { status:500 });
}

