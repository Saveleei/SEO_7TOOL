import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getQuoteDraftOrDefault } from "../../../../data/quoteDraftStore";
import { supplyStatusLabel } from "../../../../data/quoteDraftValidation.mjs";
import { getQuoteRequestDetail, isQuoteTestModeEnabled, type QuoteRequestDetail } from "../../../../data/quoteRequestStore";
import { Breadcrumbs } from "../../../../ui/Breadcrumbs";
import { PilotFooter } from "../../../../ui/PilotFooter";
import { PilotHeader } from "../../../../ui/PilotHeader";
import { QuoteBuilder } from "../../../../ui/QuoteBuilder";
import { QuotePrintButton } from "../../../../ui/QuotePrintButton";

export const metadata: Metadata = { title:"Конструктор КП — 7TOOL", robots:{ index:false, follow:false, nocache:true } };
export const dynamic = "force-dynamic";

export default async function QuoteBuilderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ mode?: string }> }) {
  if (!isQuoteTestModeEnabled()) notFound();
  const [{ id }, { mode }] = await Promise.all([params, searchParams]);
  const request = await getQuoteRequestDetail(decodeURIComponent(id));
  if (!request) notFound();
  const draft = await getQuoteDraftOrDefault(request.id);
  if (!draft) notFound();
  if (mode === "preview") return <QuotePreview request={request} draft={draft} />;
  return <div className="site-shell"><PilotHeader managerMode /><main className="inner-page quote-builder-page">
    <div className="container"><Breadcrumbs items={[{ label:"Главная", href:"/" }, { label:"Заявки", href:"/test/requests" }, { label:request.id, href:`/test/requests/${request.id}` }, { label:"Конструктор КП" }]} /></div>
    <section className="quote-builder-hero"><div className="container"><div><p className="eyebrow">Локальная подготовка документа</p><h1>Коммерческое предложение</h1><p>Запрос {request.id} · {request.company || "Компания не указана"} · {request.city || "Город не указан"}</p></div><a href={`/test/requests/${request.id}`}>← Вернуться к заявке</a></div></section>
    <section className="section"><div className="container"><QuoteBuilder initial={draft} /></div></section>
  </main><PilotFooter /></div>;
}

function QuotePreview({ request, draft }: { request: QuoteRequestDetail; draft: NonNullable<Awaited<ReturnType<typeof getQuoteDraftOrDefault>>> }) {
  const validUntil = new Date(new Date(draft.createdAt).getTime() + draft.validityDays * 86_400_000);
  return <main className="quote-document-shell">
    <nav className="quote-preview-toolbar" aria-label="Действия с предпросмотром"><a href={`/test/requests/${request.id}/quote`}>← Вернуться к редактированию</a><span>{draft.status === "ready" ? "Готово к согласованию" : "Черновик"}</span><QuotePrintButton /></nav>
    <article className="quote-document">
      {draft.status !== "ready" && <div className="quote-draft-watermark">ЧЕРНОВИК</div>}
      <header><Image src="/brand/7tool-primary.svg" alt="7TOOL" width={170} height={54} /><div><span>Коммерческое предложение</span><h1>{draft.id}</h1><p>от {date(draft.createdAt)}</p></div></header>
      <section className="quote-document-parties"><div><span>Поставщик</span><b>7TOOL</b><p>{draft.sender.name}<br />{draft.sender.role}<br />{draft.sender.phone}<br />{draft.sender.email}</p></div><div><span>Покупатель</span><b>{request.company || "Компания не указана"}</b><p>{request.city || "Город не указан"}<br />{request.emailFull}<br />{request.phoneFull}</p></div></section>
      <section><h2>Предложение по вашему запросу</h2><div className="quote-document-table"><div className="head"><span>Позиция</span><span>Кол-во</span><span>Цена</span><span>Скидка</span><span>Сумма</span></div>{draft.items.map((item) => <div className="row" key={item.id}><div className="quote-document-product">{item.productPresentation?.imageUrl && <Image src={item.productPresentation.imageUrl} alt={item.productPresentation.imageAlt} width={94} height={94} sizes="94px" />}<div><small>{item.article || "Без артикула"}</small><b>{item.title}</b>{item.productPresentation && <><strong>✓ Выбранное исполнение</strong><ul>{item.productPresentation.keySpecs.map((spec) => <li key={spec.label}><span>{spec.label}:</span> {spec.value}</li>)}</ul></>}<em>{supplyStatusLabel(item.supplyStatus)} · {item.shipmentText}</em></div></div><div data-label="Количество">{item.quantity} шт.</div><div data-label="Цена">{rub(item.unitPriceRub)}</div><div data-label="Скидка">{item.discountPercent ? `${item.discountPercent}%` : "—"}</div><div data-label="Сумма">{rub(item.lineTotalRub)}</div></div>)}</div></section>
      <section className="quote-document-total"><dl><div><dt>Итого</dt><dd>{rub(draft.totalRub)}</dd></div><div><dt>{draft.vatRate ? `В том числе НДС ${draft.vatRate}%` : "НДС"}</dt><dd>{draft.vatRate ? rub(draft.vatIncludedRub) : "Без НДС"}</dd></div></dl></section>
      <section className="quote-document-terms"><div><span>Оплата</span><p>{draft.paymentTerms || "Условия оплаты пока не подтверждены."}</p></div><div><span>Поставка</span><p>{draft.deliveryTerms || "Условия поставки пока не подтверждены."}</p></div><div><span>Предложение действительно</span><p>до {date(validUntil.toISOString())} включительно</p></div>{draft.managerComment && <div><span>Комментарий</span><p>{draft.managerComment}</p></div>}</section>
      {draft.items.some((item) => item.productPresentation?.technicalSpecs.length) && <section className="quote-technical-appendix"><div className="quote-technical-heading"><span>Техническое приложение</span><h2>Характеристики выбранного исполнения</h2><p>Параметры перенесены из фида для указанного артикула. Проверяйте применимость под вашу задачу до оплаты.</p></div>{draft.items.map((item) => item.productPresentation?.technicalSpecs.length ? <article key={item.id}><header>{item.productPresentation.imageUrl && <Image src={item.productPresentation.imageUrl} alt="" width={76} height={76} sizes="76px" />}<div><small>{item.article}</small><b>{item.title}</b><span>Исполнение {item.productPresentation.variantId}</span></div></header><dl>{item.productPresentation.technicalSpecs.map((spec) => <div key={spec.label}><dt>{spec.label}</dt><dd>{spec.value}</dd></div>)}</dl></article> : null)}</section>}
      <footer><div className="quote-signature"><b>{draft.sender.name}</b><span>{draft.sender.role}</span><span>{draft.sender.phone} · {draft.sender.email}</span>{draft.includeStamp && draft.stampAssetId && <Image src={stampAssetUrl(draft.requestId, draft.stampAssetId)} alt="Печать и подпись" width={220} height={110} unoptimized />}</div><p>Цена, наличие и срок действительны только в пределах условий этого предложения. Документ сформирован в локальном тестовом контуре и не был отправлен клиенту автоматически.</p></footer>
    </article>
  </main>;
}

function rub(value: number) {
  return `${new Intl.NumberFormat("ru-RU", { minimumFractionDigits:value % 1 ? 2 : 0, maximumFractionDigits:2 }).format(value)} ₽`;
}

function date(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { timeZone:"Europe/Moscow", day:"2-digit", month:"long", year:"numeric" }).format(new Date(value));
}

function stampAssetUrl(requestId: string, assetId: string) {
  return `/api/quote-requests/${encodeURIComponent(requestId)}/quote-assets/${encodeURIComponent(assetId)}`;
}
