import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { canManager } from "../../../../data/managerAccess";
import { requireManagerPageAccess } from "../../../../data/managerAccessPage";
import { getQuoteApprovalState, type QuoteApprovalState } from "../../../../data/quoteApprovalStore";
import { getQuoteDeliveryWorkspace } from "../../../../data/quoteDeliveryStore";
import { getQuoteDraftOrDefault, getQuoteDraftRevision, type QuoteDraft } from "../../../../data/quoteDraftStore";
import { supplyStatusLabel } from "../../../../data/quoteDraftValidation.mjs";
import { getQuoteRequestDetail, isQuoteTestModeEnabled, QuoteWorkflowError, type QuoteRequestDetail } from "../../../../data/quoteRequestStore";
import { getQuoteTemplateSettings } from "../../../../data/quoteTemplateStore";
import { Breadcrumbs } from "../../../../ui/Breadcrumbs";
import { DeliveryOutboxPanel } from "../../../../ui/DeliveryOutboxPanel";
import { PilotFooter } from "../../../../ui/PilotFooter";
import { PilotHeader } from "../../../../ui/PilotHeader";
import { QuoteApprovalPanel } from "../../../../ui/QuoteApprovalPanel";
import { QuoteBuilder } from "../../../../ui/QuoteBuilder";
import { QuotePrintButton } from "../../../../ui/QuotePrintButton";

export const metadata: Metadata = { title:"Конструктор КП — 7TOOL", robots:{ index:false, follow:false, nocache:true } };
export const dynamic = "force-dynamic";

export default async function QuoteBuilderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ mode?: string; revision?: string }> }) {
  if (!isQuoteTestModeEnabled()) notFound();
  const [{ id }, { mode, revision:revisionValue }] = await Promise.all([params, searchParams]);
  const returnTo = `/test/requests/${encodeURIComponent(id)}/quote${mode === "preview" ? `?mode=preview${revisionValue ? `&revision=${encodeURIComponent(revisionValue)}` : ""}` : ""}`;
  const actor = await requireManagerPageAccess("requests:view", returnTo);
  const request = await getQuoteRequestDetail(decodeURIComponent(id));
  if (!request) notFound();
  const requestedRevision = Number(revisionValue);
  const draft = mode === "preview" && Number.isInteger(requestedRevision) && requestedRevision > 0
    ? await getQuoteDraftRevision(request.id, requestedRevision)
    : await getQuoteDraftOrDefault(request.id);
  if (!draft) notFound();
  const approval = draft.revision > 0 ? await getQuoteApprovalState(request.id, draft.revision) : emptyApprovalState(draft.revision);
  if (mode === "preview") return <QuotePreview request={request} draft={draft} approval={approval ?? emptyApprovalState(draft.revision)} />;
  const templateSettings = await getQuoteTemplateSettings();
  let deliveryWorkspace = null;
  let deliveryWorkspaceError = "";
  if (approval?.stage === "delivery_prepared" && canManager(actor, "delivery:prepare")) {
    try {
      deliveryWorkspace = await getQuoteDeliveryWorkspace(request.id, draft.revision);
    } catch (error) {
      deliveryWorkspaceError = error instanceof QuoteWorkflowError ? error.message : "Пакет отправки недоступен.";
    }
  }
  return <div className="site-shell"><PilotHeader managerMode managerActor={actor} /><main className="inner-page quote-builder-page">
    <div className="container"><Breadcrumbs items={[{ label:"Главная", href:"/" }, { label:"Заявки", href:"/test/requests" }, { label:request.id, href:`/test/requests/${request.id}` }, { label:"Конструктор КП" }]} /></div>
    <section className="quote-builder-hero"><div className="container"><div><p className="eyebrow">Локальная подготовка документа</p><h1>Коммерческое предложение</h1><p>Запрос {request.id} · {request.company || "Компания не указана"} · {request.city || "Город не указан"}</p></div><a href={`/test/requests/${request.id}`}>← Вернуться к заявке</a></div></section>
    <section className="section"><div className="container">{canManager(actor, "quotes:edit") ? <QuoteBuilder initial={draft} senderOptions={templateSettings.senders} /> : <div className="quote-editor-readonly"><b>Редактирование недоступно этой роли</b><p>Можно проверить сохранённую редакцию и принять решение по согласованию. Изменить цены, сроки и состав может менеджер или администратор.</p><a href={`/test/requests/${request.id}/quote?mode=preview&revision=${draft.revision}`}>Открыть документ для проверки</a></div>}<QuoteApprovalPanel requestId={request.id} quoteId={draft.id} revision={draft.revision} quoteStatus={draft.status} senderName={draft.sender.name} senderRole={draft.sender.role} recipientEmail={request.emailFull} initialState={approval ?? emptyApprovalState(draft.revision)} actor={actor} canSubmit={canManager(actor, "quotes:edit")} canApprove={canManager(actor, "quotes:approve")} canPrepareDelivery={canManager(actor, "delivery:prepare")} />{deliveryWorkspace && <DeliveryOutboxPanel initial={deliveryWorkspace} />}{deliveryWorkspaceError && <div className="quote-outbox-blocked" role="alert"><b>Пакет этой редакции заблокирован</b><p>{deliveryWorkspaceError} Создайте новую редакцию КП и пройдите согласование повторно — это сохранит аудит неизменным.</p></div>}</div></section>
  </main><PilotFooter /></div>;
}

function QuotePreview({ request, draft, approval }: { request: QuoteRequestDetail; draft: QuoteDraft; approval: QuoteApprovalState }) {
  const validUntil = new Date(new Date(draft.createdAt).getTime() + draft.validityDays * 86_400_000);
  return <main className="quote-document-shell">
    <nav className="quote-preview-toolbar" aria-label="Действия с предпросмотром"><a href={`/test/requests/${request.id}/quote`}>← Вернуться к редактированию</a><span>Редакция №{draft.revision} · {approvalStatusLabel(approval.stage)}</span><QuotePrintButton /></nav>
    <article className="quote-document">
      {draft.status !== "ready" && <div className="quote-draft-watermark">ЧЕРНОВИК</div>}
      <header><Image src="/brand/7tool-primary.svg" alt="7TOOL" width={170} height={54} /><div><span>{draft.document.title}</span><h1>{draft.id}</h1><p>Редакция №{draft.revision} от {date(draft.createdAt)}</p></div></header>
      <div className="quote-version-meta"><span>{approvalStatusLabel(approval.stage)}</span><p>Контрольная сумма версии: {approval.quoteFingerprint}</p></div>
      <section className="quote-document-parties"><div><span>Поставщик</span><b>{draft.seller.legalName || draft.seller.brandName}</b><p>{sellerRegistration(draft)}{draft.seller.legalAddress}<br />{draft.sender.name}, {draft.sender.role}<br />{draft.sender.phone} · {draft.sender.email}</p></div><div><span>Покупатель</span><b>{request.company || "Компания не указана"}</b><p>{request.city || "Город не указан"}<br />{request.emailFull || "Email не указан"}<br />{request.phoneFull}</p></div></section>
      <section><h2>{draft.document.introText || "Предложение по вашему запросу"}</h2><div className="quote-document-table"><div className="head"><span>Позиция</span><span>Кол-во</span><span>Цена</span><span>Скидка</span><span>Сумма</span></div>{draft.items.map((item) => <div className="row" key={item.id}><div className="quote-document-product">{item.productPresentation?.imageUrl && <Image src={item.productPresentation.imageUrl} alt={item.productPresentation.imageAlt} width={94} height={94} sizes="94px" />}<div><small>{item.article || "Без артикула"}</small><b>{item.title}</b>{item.productPresentation && <><strong>✓ Выбранное исполнение</strong><ul>{item.productPresentation.keySpecs.map((spec) => <li key={spec.label}><span>{spec.label}:</span> {spec.value}</li>)}</ul></>}<em>{supplyStatusLabel(item.supplyStatus)} · {item.shipmentText}</em></div></div><div data-label="Количество">{item.quantity} шт.</div><div data-label="Цена">{rub(item.unitPriceRub)}</div><div data-label="Скидка">{item.discountPercent ? `${item.discountPercent}%` : "—"}</div><div data-label="Сумма">{rub(item.lineTotalRub)}</div></div>)}</div></section>
      <section className="quote-document-total"><dl><div><dt>Итого</dt><dd>{rub(draft.totalRub)}</dd></div><div><dt>{draft.vatRate ? `В том числе НДС ${draft.vatRate}%` : "НДС"}</dt><dd>{draft.vatRate ? rub(draft.vatIncludedRub) : "Без НДС"}</dd></div></dl></section>
      <section className="quote-document-terms"><div><span>Оплата</span><p>{draft.paymentTerms || "Условия оплаты пока не подтверждены."}</p></div><div><span>Поставка</span><p>{draft.deliveryTerms || "Условия поставки пока не подтверждены."}</p></div><div><span>Предложение действительно</span><p>до {date(validUntil.toISOString())} включительно</p></div>{draft.managerComment && <div><span>Комментарий</span><p>{draft.managerComment}</p></div>}</section>
      {draft.document.showBankDetails && hasBankDetails(draft) && <section className="quote-document-bank"><span>Банковские реквизиты поставщика</span><p>{draft.seller.bankName} · БИК {draft.seller.bik}<br />р/с {draft.seller.checkingAccount} · к/с {draft.seller.correspondentAccount}</p></section>}
      {draft.items.some((item) => item.productPresentation?.technicalSpecs.length) && <section className="quote-technical-appendix"><div className="quote-technical-heading"><span>Техническое приложение</span><h2>Характеристики выбранного исполнения</h2><p>Параметры перенесены из фида для указанного артикула. Проверяйте применимость под вашу задачу до оплаты.</p></div>{draft.items.map((item) => item.productPresentation?.technicalSpecs.length ? <article key={item.id}><header>{item.productPresentation.imageUrl && <Image src={item.productPresentation.imageUrl} alt="" width={76} height={76} sizes="76px" />}<div><small>{item.article}</small><b>{item.title}</b><span>Исполнение {item.productPresentation.variantId}</span></div></header><dl>{item.productPresentation.technicalSpecs.map((spec) => <div key={spec.label}><dt>{spec.label}</dt><dd>{spec.value}</dd></div>)}</dl></article> : null)}</section>}
      <footer><div className="quote-signature"><b>{draft.sender.name}</b><span>{draft.sender.role}</span><span>{draft.sender.phone} · {draft.sender.email}</span>{draft.includeStamp && draft.stampAssetId && <Image src={stampAssetUrl(draft.requestId, draft.stampAssetId)} alt="Печать и подпись" width={220} height={110} unoptimized />}</div><p>{draft.document.footerText} Документ сформирован в локальном тестовом контуре и не был отправлен клиенту автоматически.</p></footer>
    </article>
  </main>;
}

function emptyApprovalState(revision: number): QuoteApprovalState {
  return { stage:"not_submitted", revision, quoteFingerprint:"", events:[] };
}

function approvalStatusLabel(stage: QuoteApprovalState["stage"]) {
  if (stage === "submitted") return "На внутреннем согласовании";
  if (stage === "changes_requested") return "Возвращено на доработку";
  if (stage === "approved") return "Утверждено во внутреннем контуре";
  if (stage === "delivery_prepared") return "Утверждено · пакет отправки подготовлен";
  return "Не передано на согласование";
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

function sellerRegistration(draft: QuoteDraft) {
  const values = [draft.seller.inn && `ИНН ${draft.seller.inn}`, draft.seller.kpp && `КПП ${draft.seller.kpp}`, draft.seller.ogrn && `ОГРН ${draft.seller.ogrn}`].filter(Boolean);
  return values.length ? <>{values.join(" · ")}<br /></> : null;
}

function hasBankDetails(draft: QuoteDraft) {
  return Boolean(draft.seller.bankName && draft.seller.bik && draft.seller.checkingAccount && draft.seller.correspondentAccount);
}
