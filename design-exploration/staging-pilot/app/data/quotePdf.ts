import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, type PDFFont, type PDFImage, type PDFPage, rgb } from "pdf-lib";
import type { QuoteApprovalState } from "./quoteApprovalStore.ts";
import type { QuoteDraft, QuoteDraftItem } from "./quoteDraftStore.ts";
import type { QuoteRequestDetail } from "./quoteRequestStore.ts";

const A4: [number, number] = [595.28, 841.89];
const margin = 42;
const contentWidth = A4[0] - margin * 2;
const logoMarkPath = "M44 0H164C166 0 166 2 163 3L73 42H0Z M143 20C145 19 146 21 144 24L68 125H7C5 125 5 123 6 121L60 51Z";
const logoWordPath = "M146 33H234C236 33 237 35 236 38L232 55C232 58 230 59 227 59H199V113C199 115 198 116 196 116H170C168 116 167 115 167 113V59H135C132 59 130 58 131 55L141 37C142 34 144 33 146 33Z M276 30H305C331 30 345 43 345 59V88C345 104 331 116 305 116H276C250 116 237 104 237 88V59C237 43 250 30 276 30ZM279 57C272 57 268 61 268 67V80C268 86 272 89 278 89H303C309 89 313 86 313 80V67C313 61 309 57 303 57Z M387 30H416C442 30 456 43 456 59V88C456 104 442 116 416 116H387C361 116 348 104 348 88V59C348 43 361 30 387 30ZM390 57C383 57 379 61 379 67V80C379 86 383 89 389 89H414C420 89 424 86 424 80V67C424 61 420 57 414 57Z M461 31H489C491 31 492 32 492 34V89H548C550 89 551 90 551 92V113C551 115 550 116 548 116H461Z";
const colors = {
  ink:rgb(0.125, 0.149, 0.129),
  muted:rgb(0.38, 0.42, 0.39),
  faint:rgb(0.93, 0.945, 0.925),
  paper:rgb(0.975, 0.98, 0.965),
  orange:rgb(0.79, 0.29, 0.07),
  green:rgb(0.03, 0.44, 0.27),
  white:rgb(1, 1, 1),
  line:rgb(0.84, 0.86, 0.83),
};

export type QuotePdfImage = { bytes: Uint8Array; mime: "image/png" | "image/jpeg" };
type Options = {
  fontDir?: string;
  productImageLoader?: (item: QuoteDraftItem) => Promise<QuotePdfImage | null>;
  stampImage?: QuotePdfImage | null;
};
type Input = { quote: QuoteDraft; request: QuoteRequestDetail; approval: QuoteApprovalState };
type Fonts = { regular: PDFFont; bold: PDFFont };

export async function generateQuotePdf({ quote, request, approval }: Input, options: Options = {}): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const fonts = await embedFonts(document, options.fontDir);
  const productImages = await Promise.all(quote.items.map((item) => loadProductImage(document, item, options.productImageLoader ?? loadQuoteProductImage)));
  const stampImage = options.stampImage ? await embedImage(document, options.stampImage) : null;
  document.setTitle(`${quote.id}, редакция ${quote.revision}`);
  document.setAuthor("7TOOL");
  document.setSubject("Коммерческое предложение на промышленное оборудование");
  document.setProducer("7TOOL quote service");
  document.setCreator("7TOOL");
  document.setCreationDate(new Date(quote.createdAt));
  document.setModificationDate(new Date(quote.createdAt));

  let page = document.addPage(A4);
  let y = drawFirstHeader(page, fonts, quote);

  const addPage = (section?: string) => {
    page = document.addPage(A4);
    y = drawContinuationHeader(page, fonts, quote, section);
  };
  const ensure = (height: number, section?: string) => {
    if (y - height < 66) addPage(section);
  };

  y = drawApprovalBar(page, fonts, y, approval);
  y = drawParties(page, fonts, y, quote, request);
  y -= 23;
  drawText(page, "Предложение по вашему запросу", margin, y, 18, fonts.bold, colors.ink);
  y -= 22;

  for (let index = 0; index < quote.items.length; index += 1) {
    const item = quote.items[index];
    const height = itemHeight(item, fonts);
    ensure(height + 12, "Состав предложения");
    y = drawItem(page, fonts, y, item, productImages[index], index + 1);
    y -= 10;
  }

  ensure(172, "Коммерческие условия");
  y = drawTotals(page, fonts, y, quote);
  y = drawTerms(page, fonts, y, quote);
  ensure(120, "Подпись");
  y = drawSignature(page, fonts, y, quote, stampImage);

  const technicalItems = quote.items.filter((item) => item.productPresentation?.technicalSpecs.length);
  if (technicalItems.length) {
    addPage("Техническое приложение");
    drawText(page, "Характеристики выбранного исполнения", margin, y, 19, fonts.bold, colors.ink);
    y -= 18;
    y = drawParagraph(page, "Параметры перенесены из товарного фида для указанного артикула. Перед оплатой проверьте применимость оборудования под производственную задачу.", margin, y, contentWidth, 8.5, fonts.regular, colors.muted, 12) - 14;
    for (const item of technicalItems) {
      const specs = item.productPresentation?.technicalSpecs ?? [];
      ensure(55 + specs.length * 18, "Техническое приложение");
      y = drawTechnicalItem(page, fonts, y, item);
      y -= 13;
    }
  }

  const pages = document.getPages();
  pages.forEach((currentPage, index) => drawFooter(currentPage, fonts, index + 1, pages.length, quote));
  return document.save({ useObjectStreams:true, addDefaultPage:false });
}

export async function loadSafeProductImage(urlValue: string): Promise<QuotePdfImage | null> {
  try {
    const url = new URL(urlValue);
    if (url.protocol !== "https:" || url.hostname !== "s3.export.k2tool.ru") return null;
    const response = await fetch(url, { signal:AbortSignal.timeout(5_000), redirect:"error" });
    if (!response.ok) return null;
    const declaredSize = Number(response.headers.get("content-length") ?? 0);
    if (declaredSize > 4_000_000) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.length || bytes.length > 4_000_000) return null;
    if (isPng(bytes)) return { bytes, mime:"image/png" };
    if (isJpeg(bytes)) return { bytes, mime:"image/jpeg" };
    return null;
  } catch {
    return null;
  }
}

export async function loadQuoteProductImage(item: QuoteDraftItem): Promise<QuotePdfImage | null> {
  const local = await loadLocalProductImage(item);
  if (local) return local;
  return item.productPresentation?.imageUrl ? loadSafeProductImage(item.productPresentation.imageUrl) : null;
}

function drawFirstHeader(page: PDFPage, fonts: Fonts, quote: QuoteDraft) {
  drawLogo(page, margin, 785);
  drawText(page, "КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ", A4[0] - margin, 798, 8, fonts.bold, colors.orange, "right");
  drawText(page, quote.id, A4[0] - margin, 778, 17, fonts.regular, colors.ink, "right");
  drawText(page, `Редакция №${quote.revision} от ${dateRu(quote.createdAt)}`, A4[0] - margin, 762, 8, fonts.regular, colors.muted, "right");
  page.drawRectangle({ x:margin, y:742, width:contentWidth, height:2.2, color:colors.ink });
  return 726;
}

function drawContinuationHeader(page: PDFPage, fonts: Fonts, quote: QuoteDraft, section?: string) {
  drawLogo(page, margin, 796, 0.68);
  drawText(page, `${quote.id} · редакция №${quote.revision}`, A4[0] - margin, 799, 8, fonts.bold, colors.ink, "right");
  if (section) drawText(page, section.toUpperCase(), A4[0] - margin, 786, 7, fonts.regular, colors.muted, "right");
  page.drawRectangle({ x:margin, y:770, width:contentWidth, height:1, color:colors.line });
  return 748;
}

function drawLogo(page: PDFPage, x: number, y: number, scale = 1) {
  const pathScale = 0.19 * scale;
  const pathX = x + 12 * pathScale;
  const pathY = y - 12 * pathScale;
  page.drawSvgPath(logoMarkPath, { x:pathX, y:pathY, scale:pathScale, color:colors.orange });
  page.drawSvgPath(logoWordPath, { x:pathX, y:pathY, scale:pathScale, color:colors.ink });
}

function drawApprovalBar(page: PDFPage, fonts: Fonts, startY: number, approval: QuoteApprovalState) {
  const approved = approval.stage === "approved" || approval.stage === "delivery_prepared";
  const approvalEvent = [...approval.events].reverse().find((event) => event.type === "approved");
  page.drawRectangle({ x:margin, y:startY - 40, width:contentWidth, height:40, color:approved ? rgb(0.91, 0.96, 0.93) : colors.faint });
  drawText(page, approvalLabel(approval.stage).toUpperCase(), margin + 12, startY - 17, 7.5, fonts.bold, approved ? colors.green : colors.muted);
  if (approvalEvent) drawText(page, `Согласовал: ${approvalEvent.actorName}, ${approvalEvent.actorRole}`, margin + 12, startY - 30, 6.5, fonts.regular, colors.muted);
  const fingerprint = approval.quoteFingerprint || "не зафиксирована";
  drawText(page, `SHA-256: ${fingerprint}`, A4[0] - margin - 12, startY - 17, 5.2, fonts.regular, colors.muted, "right");
  if (approvalEvent) drawText(page, dateTimeRu(approvalEvent.createdAt), A4[0] - margin - 12, startY - 30, 6.3, fonts.regular, colors.muted, "right");
  return startY - 53;
}

function drawParties(page: PDFPage, fonts: Fonts, startY: number, quote: QuoteDraft, request: QuoteRequestDetail) {
  const gap = 12;
  const width = (contentWidth - gap) / 2;
  const height = 92;
  drawPartyCard(page, fonts, margin, startY, width, height, "ПОСТАВЩИК", "7TOOL", [quote.sender.name, quote.sender.role, quote.sender.phone, quote.sender.email]);
  drawPartyCard(page, fonts, margin + width + gap, startY, width, height, "ПОКУПАТЕЛЬ", request.company || "Компания не указана", [request.billingInn ? `ИНН ${request.billingInn}` : "ИНН не указан", request.city || "Город не указан", request.emailFull, request.phoneFull]);
  return startY - height;
}

function drawPartyCard(page: PDFPage, fonts: Fonts, x: number, top: number, width: number, height: number, label: string, title: string, lines: string[]) {
  page.drawRectangle({ x, y:top - height, width, height, color:colors.paper, borderColor:colors.line, borderWidth:0.6 });
  page.drawRectangle({ x, y:top - height, width:3, height, color:colors.line });
  drawText(page, label, x + 14, top - 17, 7, fonts.bold, colors.muted);
  drawText(page, title, x + 14, top - 34, 10, fonts.bold, colors.ink);
  lines.filter(Boolean).slice(0, 4).forEach((line, index) => drawText(page, line, x + 14, top - 49 - index * 10.5, 7.5, fonts.regular, colors.muted));
}

function itemHeight(item: QuoteDraftItem, fonts: Fonts) {
  const titleLines = wrapText(normalize(item.title), 275, fonts.bold, 10.5).length;
  const specRows = Math.ceil(Math.min(6, item.productPresentation?.keySpecs.length ?? 0) / 2);
  return Math.max(126, 77 + titleLines * 12 + specRows * 15);
}

function drawItem(page: PDFPage, fonts: Fonts, top: number, item: QuoteDraftItem, image: PDFImage | null, position: number) {
  const height = itemHeight(item, fonts);
  page.drawRectangle({ x:margin, y:top - height, width:contentWidth, height, color:colors.white, borderColor:colors.line, borderWidth:0.8 });
  page.drawRectangle({ x:margin, y:top - 25, width:contentWidth, height:25, color:colors.ink });
  drawText(page, `ПОЗИЦИЯ ${position}`, margin + 10, top - 16, 7, fonts.bold, colors.white);
  drawText(page, item.article ? `АРТИКУЛ ${articleValue(item.article)}` : "БЕЗ АРТИКУЛА", margin + 16, top - 42, 7, fonts.bold, colors.orange);
  const imageBox = { x:margin + 16, y:top - height + 14, width:82, height:height - 63 };
  if (image) drawContainedImage(page, image, imageBox.x, imageBox.y, imageBox.width, imageBox.height);
  else drawImagePlaceholder(page, fonts, imageBox.x, imageBox.y, imageBox.width, imageBox.height);

  const textX = margin + 112;
  let textY = top - 43;
  const titleLines = wrapText(normalize(item.title), 274, fonts.bold, 10.5).slice(0, 3);
  titleLines.forEach((line) => { drawText(page, line, textX, textY, 10.5, fonts.bold, colors.ink); textY -= 12.5; });
  drawText(page, "Выбранное исполнение", textX, textY - 1, 7, fonts.bold, colors.green);
  textY -= 16;
  const specs = (item.productPresentation?.keySpecs ?? []).slice(0, 6);
  specs.forEach((spec, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = textX + column * 143;
    drawText(page, `${normalize(spec.label)}:`, x, textY - row * 15, 6.5, fonts.regular, colors.muted);
    drawText(page, truncateToWidth(normalize(spec.value), 132, fonts.bold, 7), x, textY - 7 - row * 15, 7, fonts.bold, colors.ink);
  });
  const statusY = top - height + 18;
  drawText(page, `${supplyStatus(item.supplyStatus)} · ${normalize(item.shipmentText)}`, textX, statusY, 7, fonts.bold, item.supplyStatus === "unknown" ? colors.orange : colors.green);
  const amountX = A4[0] - margin - 12;
  drawText(page, `${item.quantity} шт. × ${rub(item.unitPriceRub)}`, amountX, top - 47, 7, fonts.regular, colors.muted, "right");
  if (item.discountPercent) drawText(page, `Скидка ${formatNumber(item.discountPercent)}%`, amountX, top - 60, 7, fonts.regular, colors.orange, "right");
  drawText(page, rub(item.lineTotalRub), amountX, top - 78, 12, fonts.bold, colors.ink, "right");
  return top - height;
}

function drawTotals(page: PDFPage, fonts: Fonts, startY: number, quote: QuoteDraft) {
  const width = 255;
  const height = 65;
  const x = A4[0] - margin - width;
  page.drawRectangle({ x, y:startY - height, width, height, color:colors.paper, borderColor:colors.line, borderWidth:0.8 });
  drawText(page, "ИТОГО", x + 14, startY - 22, 8, fonts.bold, colors.muted);
  drawText(page, rub(quote.totalRub), x + width - 14, startY - 24, 17, fonts.bold, colors.ink, "right");
  const vatText = quote.vatRate ? `В том числе НДС ${quote.vatRate}%: ${rub(quote.vatIncludedRub)}` : "Без НДС";
  drawText(page, vatText, x + width - 14, startY - 45, 8, fonts.regular, colors.muted, "right");
  return startY - height - 18;
}

function drawTerms(page: PDFPage, fonts: Fonts, startY: number, quote: QuoteDraft) {
  const gap = 10;
  const width = (contentWidth - gap) / 2;
  const paymentLines = wrapText(normalize(quote.paymentTerms), width - 24, fonts.regular, 8);
  const deliveryLines = wrapText(normalize(quote.deliveryTerms), width - 24, fonts.regular, 8);
  const height = Math.max(69, 39 + Math.max(paymentLines.length, deliveryLines.length) * 10.5);
  drawTermCard(page, fonts, margin, startY, width, height, "ОПЛАТА", paymentLines);
  drawTermCard(page, fonts, margin + width + gap, startY, width, height, "ПОСТАВКА", deliveryLines);
  const validUntil = new Date(new Date(quote.createdAt).getTime() + quote.validityDays * 86_400_000);
  drawText(page, `Предложение действительно до ${dateRu(validUntil.toISOString())} включительно.`, margin, startY - height - 17, 7.5, fonts.regular, colors.muted);
  if (quote.managerComment) return drawParagraph(page, `Комментарий: ${normalize(quote.managerComment)}`, margin, startY - height - 33, contentWidth, 8, fonts.regular, colors.ink, 11) - 12;
  return startY - height - 31;
}

function drawTermCard(page: PDFPage, fonts: Fonts, x: number, top: number, width: number, height: number, label: string, lines: string[]) {
  page.drawRectangle({ x, y:top - height, width, height, color:colors.paper });
  drawText(page, label, x + 12, top - 17, 7, fonts.bold, colors.muted);
  lines.slice(0, 8).forEach((line, index) => drawText(page, line, x + 12, top - 33 - index * 10.5, 8, fonts.regular, colors.ink));
}

function drawSignature(page: PDFPage, fonts: Fonts, startY: number, quote: QuoteDraft, stamp: PDFImage | null) {
  page.drawRectangle({ x:margin, y:startY - 1, width:contentWidth, height:1, color:colors.ink });
  drawText(page, quote.sender.name, margin, startY - 24, 10, fonts.bold, colors.ink);
  drawText(page, quote.sender.role, margin, startY - 39, 8, fonts.regular, colors.muted);
  drawText(page, `${quote.sender.phone} · ${quote.sender.email}`, margin, startY - 52, 8, fonts.regular, colors.muted);
  if (stamp) drawContainedImage(page, stamp, margin + 245, startY - 84, 170, 78);
  return startY - 92;
}

function drawTechnicalItem(page: PDFPage, fonts: Fonts, startY: number, item: QuoteDraftItem) {
  const specs = item.productPresentation?.technicalSpecs ?? [];
  drawText(page, item.article ? `АРТИКУЛ ${articleValue(item.article)}` : "ТОЧНОЕ ИСПОЛНЕНИЕ", margin, startY, 7, fonts.bold, colors.orange);
  drawText(page, truncateToWidth(normalize(item.title), contentWidth, fonts.bold, 11), margin, startY - 15, 11, fonts.bold, colors.ink);
  let y = startY - 31;
  specs.forEach((spec, index) => {
    const shade = index % 2 === 0 ? colors.paper : colors.white;
    page.drawRectangle({ x:margin, y:y - 16, width:contentWidth, height:16, color:shade, borderColor:colors.line, borderWidth:0.35 });
    drawText(page, truncateToWidth(normalize(spec.label), contentWidth * 0.58 - 14, fonts.regular, 7), margin + 8, y - 11, 7, fonts.regular, colors.muted);
    drawText(page, truncateToWidth(normalize(spec.value), contentWidth * 0.42 - 14, fonts.bold, 7), margin + contentWidth * 0.58 + 8, y - 11, 7, fonts.bold, colors.ink);
    y -= 16;
  });
  return y;
}

function drawFooter(page: PDFPage, fonts: Fonts, pageNumber: number, totalPages: number, quote: QuoteDraft) {
  page.drawRectangle({ x:margin, y:49, width:contentWidth, height:0.7, color:colors.line });
  drawText(page, "Цена, наличие и срок действительны только в пределах условий этого предложения.", margin, 34, 6.5, fonts.regular, colors.muted);
  drawText(page, `${quote.id} · стр. ${pageNumber} из ${totalPages}`, A4[0] - margin, 34, 6.5, fonts.bold, colors.muted, "right");
}

async function embedFonts(document: PDFDocument, override?: string): Promise<Fonts> {
  const fontDir = override || path.join(process.cwd(), "assets", "fonts");
  const [regularBytes, boldBytes] = await Promise.all([readFile(path.join(fontDir, "Ubuntu-R.ttf")), readFile(path.join(fontDir, "Ubuntu-B.ttf"))]);
  return {
    regular:await document.embedFont(regularBytes, { subset:true }),
    bold:await document.embedFont(boldBytes, { subset:true }),
  };
}

async function loadProductImage(document: PDFDocument, item: QuoteDraftItem, loader: (item: QuoteDraftItem) => Promise<QuotePdfImage | null>) {
  return embedImage(document, await loader(item));
}

async function embedImage(document: PDFDocument, image: QuotePdfImage | null): Promise<PDFImage | null> {
  if (!image) return null;
  try {
    return image.mime === "image/png" ? await document.embedPng(image.bytes) : await document.embedJpg(image.bytes);
  } catch {
    return null;
  }
}

function drawContainedImage(page: PDFPage, image: PDFImage, x: number, y: number, width: number, height: number) {
  const scale = Math.min(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  page.drawImage(image, { x:x + (width - drawWidth) / 2, y:y + (height - drawHeight) / 2, width:drawWidth, height:drawHeight });
}

function drawImagePlaceholder(page: PDFPage, fonts: Fonts, x: number, y: number, width: number, height: number) {
  page.drawRectangle({ x, y, width, height, color:colors.paper, borderColor:colors.line, borderWidth:0.5 });
  drawText(page, "ФОТО", x + width / 2, y + height / 2 - 3, 7, fonts.bold, colors.muted, "center");
}

function drawParagraph(page: PDFPage, value: string, x: number, startY: number, maxWidth: number, size: number, font: PDFFont, color: ReturnType<typeof rgb>, lineHeight: number) {
  let y = startY;
  wrapText(normalize(value), maxWidth, font, size).forEach((line) => { drawText(page, line, x, y, size, font, color); y -= lineHeight; });
  return y;
}

function wrapText(value: string, maxWidth: number, font: PDFFont, size: number) {
  const paragraphs = normalize(value).split("\n");
  const lines: string[] = [];
  paragraphs.forEach((paragraph, paragraphIndex) => {
    const words = paragraph.split(/\s+/u).filter(Boolean);
    let line = "";
    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate;
      else {
        if (line) lines.push(line);
        if (font.widthOfTextAtSize(word, size) <= maxWidth) line = word;
        else {
          const chunks = breakWord(word, maxWidth, font, size);
          lines.push(...chunks.slice(0, -1));
          line = chunks.at(-1) ?? "";
        }
      }
    });
    if (line) lines.push(line);
    if (paragraphIndex < paragraphs.length - 1) lines.push("");
  });
  return lines.length ? lines : [""];
}

function breakWord(word: string, maxWidth: number, font: PDFFont, size: number) {
  const chunks: string[] = [];
  let chunk = "";
  Array.from(word).forEach((character) => {
    if (chunk && font.widthOfTextAtSize(`${chunk}${character}`, size) > maxWidth) { chunks.push(chunk); chunk = character; }
    else chunk += character;
  });
  if (chunk) chunks.push(chunk);
  return chunks;
}

function truncateToWidth(value: string, maxWidth: number, font: PDFFont, size: number) {
  if (font.widthOfTextAtSize(value, size) <= maxWidth) return value;
  let result = value;
  while (result.length > 1 && font.widthOfTextAtSize(`${result}…`, size) > maxWidth) result = result.slice(0, -1);
  return `${result}…`;
}

function drawText(page: PDFPage, value: string, x: number, y: number, size: number, font: PDFFont, color: ReturnType<typeof rgb>, align: "left" | "center" | "right" = "left") {
  const text = normalize(value);
  const width = font.widthOfTextAtSize(text, size);
  const drawX = align === "right" ? x - width : align === "center" ? x - width / 2 : x;
  page.drawText(text, { x:drawX, y, size, font, color });
}

function normalize(value: unknown) {
  return String(value ?? "").replace(/[‐‑‒–—―]/gu, "-").replace(/\u00a0/gu, " ").replace(/[\u0000-\u001f\u007f]/gu, " ").replace(/\s+/gu, " ").trim();
}

function rub(value: number) {
  return `${formatNumber(value)} руб.`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ru-RU", { minimumFractionDigits:value % 1 ? 2 : 0, maximumFractionDigits:2 }).format(value);
}

function dateRu(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { timeZone:"Europe/Moscow", day:"2-digit", month:"long", year:"numeric" }).format(new Date(value));
}

function dateTimeRu(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { timeZone:"Europe/Moscow", day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" }).format(new Date(value));
}

function approvalLabel(stage: QuoteApprovalState["stage"]) {
  if (stage === "delivery_prepared") return "Утверждено · пакет отправки подготовлен";
  if (stage === "approved") return "Утверждено во внутреннем контуре";
  if (stage === "submitted") return "На внутреннем согласовании";
  if (stage === "changes_requested") return "Возвращено на доработку";
  return "Не передано на согласование";
}

function supplyStatus(status: QuoteDraftItem["supplyStatus"]) {
  if (status === "confirmed") return "В наличии подтверждено";
  if (status === "supplier_confirmed") return "Подтверждено поставщиком";
  if (status === "to_order") return "Под заказ";
  return "Требует подтверждения";
}

function isPng(bytes: Uint8Array) {
  return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
}

function isJpeg(bytes: Uint8Array) {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

async function loadLocalProductImage(item: QuoteDraftItem): Promise<QuotePdfImage | null> {
  const productHref = item.productPresentation?.productHref ?? "";
  const hrefSlug = /^\/product\/(?<slug>[a-z0-9-]+)(?:\?|$)/u.exec(productHref)?.groups?.slug ?? "";
  const brand = /\b(?<brand>[A-Z][A-Z0-9-]{2,})\b/u.exec(item.title)?.groups?.brand?.toLowerCase() ?? "";
  const article = articleValue(item.article).toLowerCase().replace(/[^a-z0-9-]/gu, "");
  const slugs = [...new Set([hrefSlug, brand && article ? `${brand}-${article}` : "", article].filter((value) => /^[a-z0-9-]+$/u.test(value)))];
  for (const slug of slugs) {
    for (const extension of ["jpg", "png"] as const) {
      try {
        const bytes = new Uint8Array(await readFile(path.join(process.cwd(), "public", "products", `${slug}.${extension}`)));
        if (extension === "jpg" && isJpeg(bytes)) return { bytes, mime:"image/jpeg" };
        if (extension === "png" && isPng(bytes)) return { bytes, mime:"image/png" };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
  }
  return null;
}

function articleValue(value: string) {
  return normalize(value).replace(/^артикул\s*/iu, "");
}
