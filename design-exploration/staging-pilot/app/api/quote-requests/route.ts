import { isQuoteTestModeEnabled, saveQuoteRequest } from "../../data/quoteRequestStore.ts";
import { createMemoryRateLimiter, validateQuoteAttachment, validateQuoteRequest, validateSpecificationAttachment } from "../../data/quoteRequestValidation.mjs";
import { isSameOriginRequest } from "../../data/requestOrigin.ts";

const limiter = createMemoryRateLimiter({ limit:8, windowMs:10 * 60 * 1000 });

export async function POST(request: Request) {
  if (!isQuoteTestModeEnabled()) return Response.json({ ok:false, message:"Тестовый контур заявок отключён." }, { status:503 });
  if (!isSameOriginRequest(request)) return Response.json({ ok:false, message:"Запрос отклонён проверкой источника." }, { status:403 });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 12 * 1024 * 1024) return Response.json({ ok:false, message:"Общий размер запроса слишком большой." }, { status:413 });

  const clientKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local-preview";
  const rate = limiter.check(clientKey);
  if (!rate.allowed) return Response.json({ ok:false, message:"Слишком много попыток. Повторите позже." }, { status:429, headers:{ "Retry-After":String(rate.retryAfterSeconds) } });

  try {
    const formData = await request.formData();
    const rawItems = parseJson(formData.get("items"), []);
    const rawSource = parseJson(formData.get("source"), {});
    const validation = validateQuoteRequest({
      requestType:formData.get("request_type"),
      email:formData.get("email"),
      phone:formData.get("phone"),
      company:formData.get("company"),
      city:formData.get("city"),
      comment:formData.get("comment"),
      billingInn:formData.get("billing_inn"),
      idempotencyKey:formData.get("idempotency_key"),
      website:formData.get("website"),
      consent:formData.get("consent"),
      alternatives:formData.get("alternatives"),
      checkAvailability:formData.get("check_availability"),
      checkSet:formData.get("check_set"),
      checkDocs:formData.get("check_docs"),
      items:rawItems,
      source:rawSource,
    });
    if (!validation.ok) return Response.json({ ok:false, message:validation.message, fieldErrors:validation.fieldErrors }, { status:400 });

    const rawBillingAttachment = formData.get("billing_file");
    const rawSpecificationAttachment = formData.get("specification_file");
    const isSpecificationRequest = validation.value.requestType === "selection" && validation.value.items.some((item) => item.id === "selection:specification");
    const attachmentValidation = isSpecificationRequest
      ? await validateSpecificationAttachment(rawSpecificationAttachment && typeof rawSpecificationAttachment === "object" ? rawSpecificationAttachment : null)
      : await validateQuoteAttachment(rawBillingAttachment && typeof rawBillingAttachment === "object" ? rawBillingAttachment : null);
    if (!attachmentValidation.ok) return Response.json({ ok:false, message:attachmentValidation.message }, { status:400 });

    const saved = await saveQuoteRequest(validation.value, attachmentValidation.value);
    return Response.json({ ok:true, requestNumber:saved.id, createdAt:saved.createdAt, duplicate:saved.duplicate, billingProvided:saved.billingProvided, delivery:"disabled-test-contour" }, { status:saved.duplicate ? 200 : 201, headers:{ "Cache-Control":"no-store" } });
  } catch (error) {
    console.error("[quote-test] request could not be saved", error instanceof Error ? error.message : "unknown error");
    return Response.json({ ok:false, message:"Не удалось сохранить заявку. Попробуйте ещё раз." }, { status:500 });
  }
}

function parseJson(value: FormDataEntryValue | null, fallback: unknown) {
  if (typeof value !== "string") return fallback;
  try { return JSON.parse(value) as unknown; } catch { return fallback; }
}

