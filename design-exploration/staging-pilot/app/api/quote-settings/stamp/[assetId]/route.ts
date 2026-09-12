import { readQuoteTemplateStampAsset } from "../../../../data/quoteAssetStore.ts";
import { isQuoteTestModeEnabled } from "../../../../data/quoteRequestStore.ts";

export async function GET(_: Request, context: { params: Promise<{ assetId: string }> }) {
  if (!isQuoteTestModeEnabled()) return new Response(null, { status:404 });
  const { assetId } = await context.params;
  const asset = await readQuoteTemplateStampAsset(assetId);
  if (!asset) return new Response(null, { status:404 });
  return new Response(asset.bytes, {
    headers:{
      "Content-Type":asset.mime,
      "Content-Length":String(asset.bytes.length),
      "Cache-Control":"private, max-age=31536000, immutable",
      "Content-Security-Policy":"default-src 'none'; sandbox",
      "X-Content-Type-Options":"nosniff",
    },
  });
}
