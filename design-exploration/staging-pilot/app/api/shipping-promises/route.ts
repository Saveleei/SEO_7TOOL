import { getFeedProductVariantById } from "../../data/feedCatalog";
import { getVariantShippingPromise } from "../../data/shippingPromise.mjs";

const VARIANT_ID = /^[A-Za-z0-9._:-]{1,160}$/u;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const variantIds = Array.from(new Set(url.searchParams.getAll("variant").filter((id) => VARIANT_ID.test(id)))).slice(0, 50);
  const promises = Object.fromEntries(variantIds.map((id) => {
    const match = getFeedProductVariantById(id);
    return [id, getVariantShippingPromise(match?.variant)];
  }));
  return Response.json({ ok:true, promises }, { headers:{ "Cache-Control":"no-store, max-age=0" } });
}
