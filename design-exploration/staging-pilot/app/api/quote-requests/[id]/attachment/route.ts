import { getQuoteRequestAttachment, isQuoteTestModeEnabled } from "../../../../data/quoteRequestStore.ts";
import { authorizeManagerRequest } from "../../../../data/managerAccessServer.ts";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isQuoteTestModeEnabled()) return Response.json({ ok:false, message:"Рабочее место менеджера отключено." }, { status:503 });
  const access = await authorizeManagerRequest(request, "requests:view");
  if (!access.ok) return access.response;
  const { id } = await context.params;
  const attachment = await getQuoteRequestAttachment(decodeURIComponent(id));
  if (!attachment) return Response.json({ ok:false, message:"Файл не найден." }, { status:404 });
  const asciiName = attachment.kind === "specification" ? "7TOOL-specification" : "7TOOL-billing-details";
  return new Response(attachment.bytes, {
    headers:{
      "Cache-Control":"private, no-store",
      "Content-Type":attachment.mime,
      "Content-Length":String(attachment.size),
      "Content-Disposition":`attachment; filename="${asciiName}.${extensionForMime(attachment.mime)}"; filename*=UTF-8''${encodeURIComponent(attachment.originalName)}`,
      "X-Content-Type-Options":"nosniff",
    },
  });
}

function extensionForMime(mime: string): string {
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  if (mime.includes("wordprocessingml")) return "docx";
  if (mime.includes("spreadsheetml")) return "xlsx";
  return "bin";
}
