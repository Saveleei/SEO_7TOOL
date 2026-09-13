import { getFeedProductBySlug } from "../../data/feedCatalog.ts";
import { getProductVariantChoices } from "../../data/variantPresentation.ts";

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("product")?.trim() ?? "";
  if (!/^[a-z0-9-]{1,180}$/u.test(slug)) {
    return Response.json({ ok:false, message:"Товар не указан." }, { status:400, headers:{ "Cache-Control":"no-store" } });
  }

  const product = getFeedProductBySlug(slug);
  if (!product) {
    return Response.json({ ok:false, message:"Товар не найден." }, { status:404, headers:{ "Cache-Control":"no-store" } });
  }

  return Response.json({ ok:true, productId:product.id, variants:getProductVariantChoices(product) }, {
    headers:{ "Cache-Control":"public, max-age=300, stale-while-revalidate=900" },
  });
}
