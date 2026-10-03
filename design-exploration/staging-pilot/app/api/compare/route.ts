import { formatFeedPrice, getFeedProductBySlug, getFeedProductImage, getFeedProductPriceLabel, getFeedVariantTechnicalSpecs, toFeedProductCardModel } from "../../data/feedCatalog.ts";
import { getProductShippingPromise, getVariantShippingPromise } from "../../data/shippingPromise.mjs";
import { getVariantChoicePresentation } from "../../data/variantPresentation.ts";

type RequestedItem = { slug: string; variantId?: string };

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("items") ?? "";
  if (!raw || raw.length > 3_000) return response({ ok:false, message:"Выбор для сравнения не указан." }, 400);

  let requested: RequestedItem[];
  try {
    requested = sanitizeRequestedItems(JSON.parse(raw));
  } catch {
    return response({ ok:false, message:"Некорректный выбор для сравнения." }, 400);
  }
  if (requested.length === 0) return response({ ok:false, message:"Выбор для сравнения не указан." }, 400);

  const missing: string[] = [];
  const items = requested.flatMap((selection) => {
    const product = getFeedProductBySlug(selection.slug);
    if (!product) {
      missing.push(selection.slug);
      return [];
    }

    if (selection.variantId) {
      const variant = product.variants.find((candidate) => candidate.id === selection.variantId);
      if (!variant) {
        missing.push(`${selection.slug}:${selection.variantId}`);
        return [];
      }
      const shipping = getVariantShippingPromise(variant);
      const choice = getVariantChoicePresentation(product, variant);
      return [{
        key:`${product.id}:${variant.id}`,
        productId:product.id,
        variantId:variant.id,
        mode:"variant" as const,
        modeLabel:"Точное исполнение",
        slug:product.slug,
        title:product.title,
        brand:product.brand,
        sku:variant.sku || product.sku,
        choiceLabel:choice.label,
        image:variant.images?.find(Boolean) ?? getFeedProductImage(product),
        href:`/product/${product.slug}?variant=${encodeURIComponent(variant.id)}#variants`,
        price:formatFeedPrice(variant.price) ?? "Цена по запросу",
        variantCount:1,
        available:shipping.available,
        shippingLabel:shipping.label,
        shippingDetail:shipping.detail,
        specs:getFeedVariantTechnicalSpecs(product, variant).slice(0, 12),
      }];
    }

    const model = toFeedProductCardModel(product);
    const shipping = getProductShippingPromise(product.variants);
    return [{
      key:product.id,
      productId:product.id,
      mode:"series" as const,
      modeLabel:"Товарная серия",
      slug:product.slug,
      title:product.title,
      brand:product.brand,
      sku:product.sku,
      choiceLabel:`${product.variants.length} ${variantWord(product.variants.length)}`,
      image:getFeedProductImage(product),
      href:`/product/${product.slug}`,
      price:getFeedProductPriceLabel(product),
      variantCount:product.variants.length,
      available:shipping.available,
      shippingLabel:shipping.label,
      shippingDetail:shipping.detail,
      specs:model.specs,
    }];
  });

  return response({ ok:true, items, missing }, 200);
}

function sanitizeRequestedItems(value: unknown): RequestedItem[] {
  if (!Array.isArray(value)) return [];
  const unique = new Map<string, RequestedItem>();
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const candidate = entry as Partial<RequestedItem>;
    const slug = typeof candidate.slug === "string" ? candidate.slug.trim().toLocaleLowerCase("ru-RU") : "";
    const variantId = typeof candidate.variantId === "string" ? candidate.variantId.trim() : "";
    if (!/^[a-z0-9-]{1,180}$/u.test(slug)) continue;
    if (variantId && !/^[\p{L}\p{N}_.:+/-]{1,180}$/u.test(variantId)) continue;
    unique.set(slug, { slug, variantId:variantId || undefined });
    if (unique.size === 4) break;
  }
  return Array.from(unique.values());
}

function response(body: unknown, status: number) {
  return Response.json(body, { status, headers:{ "Cache-Control":"no-store", "X-Content-Type-Options":"nosniff" } });
}

function variantWord(count: number): string {
  const mod100 = count % 100;
  const mod10 = count % 10;
  if (mod100 >= 11 && mod100 <= 14) return "исполнений";
  if (mod10 === 1) return "исполнение";
  if (mod10 >= 2 && mod10 <= 4) return "исполнения";
  return "исполнений";
}
