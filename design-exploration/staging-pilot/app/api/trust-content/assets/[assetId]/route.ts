import { readTrustAsset } from "../../../../data/trustAssetStore.ts";

export async function GET(_request: Request, context: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await context.params;
  const asset = await readTrustAsset(assetId);
  if (!asset) return new Response(null, { status:404 });
  return new Response(asset.bytes, {
    headers:{
      "Content-Type":asset.mime,
      "Content-Length":String(asset.bytes.length),
      "Cache-Control":"public, max-age=31536000, immutable",
      "Content-Security-Policy":"default-src 'none'; sandbox",
      "X-Content-Type-Options":"nosniff",
    },
  });
}
