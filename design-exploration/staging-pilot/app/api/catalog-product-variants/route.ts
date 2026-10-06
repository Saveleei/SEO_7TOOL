import { getFeedProductBySlug } from "../../data/feedCatalog.ts";
import { getProductVariantChoices } from "../../data/variantPresentation.ts";

export async function GET(request: Request) {
  const startedAt = performance.now();
  const slug = new URL(request.url).searchParams.get("product")?.trim() ?? "";
  if (!/^[a-z0-9-]{1,180}$/u.test(slug)) {
    return Response.json({ ok:false, message:"Товар не указан." }, { status:400, headers:{ "Cache-Control":"no-store" } });
  }

  const product = getFeedProductBySlug(slug);
  if (!product) {
    return Response.json({ ok:false, message:"Товар не найден." }, { status:404, headers:{ "Cache-Control":"no-store" } });
  }

  const variants = getProductVariantChoices(product).map(({ id, sku, title, price, choiceLabel, choiceContext, image, href, shippingPromise }) => ({
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
  return Response.json({ ok:true, productId:product.id, variants }, {
    headers:{
      "Cache-Control":"public, max-age=300, s-maxage=900, stale-while-revalidate=1800",
      "Server-Timing":`catalog-variants;dur=${(performance.now() - startedAt).toFixed(1)}`,
    },
  });
}
