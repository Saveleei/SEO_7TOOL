import { readQuoteStampAsset } from "../../../../data/quoteAssetStore.ts";
import { getQuoteApprovalState } from "../../../../data/quoteApprovalStore.ts";
import { getQuoteDraftRevision } from "../../../../data/quoteDraftStore.ts";
import { generateQuotePdf, type QuotePdfImage } from "../../../../data/quotePdf.ts";
import { getQuoteRequestDetail, isQuoteTestModeEnabled } from "../../../../data/quoteRequestStore.ts";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isQuoteTestModeEnabled()) return Response.json({ ok:false, message:"Скачивание КП отключено." }, { status:503 });
  const { id } = await context.params;
  const requestId = decodeURIComponent(id);
  const revision = Number(new URL(request.url).searchParams.get("revision"));
  if (!Number.isInteger(revision) || revision < 1) return Response.json({ ok:false, message:"Укажите редакцию КП." }, { status:400 });

  const [quoteRequest, quote, approval] = await Promise.all([
    getQuoteRequestDetail(requestId),
    getQuoteDraftRevision(requestId, revision),
    getQuoteApprovalState(requestId, revision),
  ]);
  if (!quoteRequest || !quote || !approval) return Response.json({ ok:false, message:"Редакция КП не найдена." }, { status:404 });
  if (quote.status !== "ready" || !["approved", "delivery_prepared"].includes(approval.stage)) {
    return Response.json({ ok:false, message:"PDF доступен только для утверждённой редакции." }, { status:409 });
  }

  let stampImage: QuotePdfImage | null = null;
  if (quote.includeStamp && quote.stampAssetId) {
    const asset = await readQuoteStampAsset(quote.requestId, quote.stampAssetId);
    if (asset?.mime === "image/png" || asset?.mime === "image/jpeg") stampImage = { bytes:asset.bytes, mime:asset.mime };
  }

  try {
    const bytes = await generateQuotePdf({ quote, request:quoteRequest, approval }, { stampImage });
    const downloadName = `${quote.id}-r${quote.revision}.pdf`;
    const asciiName = `7TOOL-${quote.requestId}-r${quote.revision}.pdf`;
    return new Response(bytes, {
      status:200,
      headers:{
        "Content-Type":"application/pdf",
        "Content-Length":String(bytes.byteLength),
        "Content-Disposition":`attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
        "Cache-Control":"private, no-store, max-age=0",
        "X-Content-Type-Options":"nosniff",
        "X-Quote-Revision":String(quote.revision),
        "X-Quote-Fingerprint":approval.quoteFingerprint,
      },
    });
  } catch (error) {
    console.error("[quote-test] PDF could not be generated", error instanceof Error ? error.message : "unknown error");
    return Response.json({ ok:false, message:"Не удалось сформировать PDF этой редакции." }, { status:500 });
  }
}
