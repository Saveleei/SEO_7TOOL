import { catalogProductMediaAssetAccess, readCatalogProductMediaAsset } from "../../../../data/catalogProductMediaStore.ts";
import { authorizeManagerRequest } from "../../../../data/managerAccessServer.ts";

export async function GET(request: Request, context: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await context.params;
  const visibility = await catalogProductMediaAssetAccess(assetId);
  if (visibility === "missing") return new Response(null, { status:404 });
  if (visibility === "private") {
    const access = await authorizeManagerRequest(request, "settings:manage");
    if (!access.ok) return access.response;
  }
  const asset = await readCatalogProductMediaAsset(assetId);
  if (!asset) return new Response(null, { status:404 });
  return new Response(asset.bytes, {
    headers:{
      "Content-Type":asset.mime,
      "Content-Length":String(asset.bytes.length),
      "Cache-Control":visibility === "published" ? "public, max-age=31536000, immutable" : "private, no-store",
      "Content-Security-Policy":"default-src 'none'; sandbox",
      "X-Content-Type-Options":"nosniff",
    },
  });
}

