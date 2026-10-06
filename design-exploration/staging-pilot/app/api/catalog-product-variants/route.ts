import { getFeedProductBySlug } from "../../data/feedCatalog.ts";
import { getProductVariantChoicePage } from "../../data/variantPresentation.ts";

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 60;

export async function GET(request: Request) {
  const startedAt = performance.now();
  const searchParams = new URL(request.url).searchParams;
  const slug = searchParams.get("product")?.trim() ?? "";
  if (!/^[a-z0-9-]{1,180}$/u.test(slug)) {
    return Response.json({ ok:false, message:"Товар не указан." }, { status:400, headers:{ "Cache-Control":"no-store" } });
  }
  const query = searchParams.get("q")?.trim() ?? "";
  if (query.length > 100) {
    return Response.json({ ok:false, message:"Слишком длинный поисковый запрос." }, { status:400, headers:{ "Cache-Control":"no-store" } });
  }
  const offset = boundedInteger(searchParams.get("offset"), 0, 50_000, 0);
  const limit = boundedInteger(searchParams.get("limit"), 1, MAX_LIMIT, DEFAULT_LIMIT);
  const availableOnly = searchParams.get("stock") === "available";

  const product = getFeedProductBySlug(slug);
  if (!product) {
    return Response.json({ ok:false, message:"Товар не найден." }, { status:404, headers:{ "Cache-Control":"no-store" } });
  }

  const page = getProductVariantChoicePage(product, { offset, limit, query, availableOnly });
  const variants = page.variants.map(({ id, sku, title, price, choiceLabel, choiceContext, image, href, shippingPromise }) => ({
    id,
    sku,
    title,
    price,
    choiceLabel,
    choiceContext,
    image,
    href,
    shippingPromise,
  }));
  return Response.json({
    ok:true,
    productId:product.id,
    totalVariantCount:page.totalVariantCount,
    availableVariantCount:page.availableVariantCount,
    matchedVariantCount:page.matchedVariantCount,
    offset:page.offset,
    nextOffset:page.nextOffset,
    variants,
  }, {
    headers:{
      "Cache-Control":"public, max-age=120, s-maxage=600, stale-while-revalidate=1200",
      "Server-Timing":`catalog-variants;dur=${(performance.now() - startedAt).toFixed(1)}`,
    },
  });
}

function boundedInteger(value: string | null, minimum: number, maximum: number, fallback: number): number {
  if (value === null || value.trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}
