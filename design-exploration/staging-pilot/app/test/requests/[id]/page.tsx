import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { canManager } from "../../../data/managerAccess";
import { requireManagerPageAccess } from "../../../data/managerAccessPage";
import { getQuoteApprovalState } from "../../../data/quoteApprovalStore";
import { listQuoteDrafts } from "../../../data/quoteDraftStore";
import { getQuoteRequestDetail, isQuoteTestModeEnabled, type QuoteRequestDetail, type QuoteRequestEvent } from "../../../data/quoteRequestStore";
import { Breadcrumbs } from "../../../ui/Breadcrumbs";
import { ManagerRequestActions } from "../../../ui/ManagerRequestActions";
import { PilotFooter } from "../../../ui/PilotFooter";
import { PilotHeader } from "../../../ui/PilotHeader";
import { QuoteRevisionRegister, type QuoteRevisionEntry } from "../../../ui/QuoteRevisionRegister";

export const metadata: Metadata = { title:"Карточка локальной заявки — 7TOOL", robots:{ index:false, follow:false, nocache:true } };
export const dynamic = "force-dynamic";

export default async function TestRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!isQuoteTestModeEnabled()) return <DisabledState />;
  const { id } = await params;
  const actor = await requireManagerPageAccess("requests:view", `/test/requests/${encodeURIComponent(id)}`);
  const request = await getQuoteRequestDetail(decodeURIComponent(id));
  if (!request) notFound();
  const drafts = await listQuoteDrafts(request.id);
  const revisions: QuoteRevisionEntry[] = await Promise.all(drafts.map(async (draft) => {
    const approval = await getQuoteApprovalState(request.id, draft.revision);
    return { id:draft.id, revision:draft.revision, createdAt:draft.createdAt, status:draft.status, approvalStage:approval?.stage ?? "not_submitted", totalRub:draft.totalRub, itemCount:draft.items.length, fingerprint:approval?.quoteFingerprint ?? "" };
  }));
  return <div className="site-shell"><PilotHeader managerMode managerActor={actor} /><main className="inner-page manager-request-page">
    <div className="container"><Breadcrumbs items={[{ label:"Главная", href:"/" }, { label:"Журнал заявок", href:"/test/requests" }, { label:request.id }]} /></div>
    <section className="manager-request-hero"><div className="container">
      <div className="manager-request-hero-main"><span className={`manager-status manager-status--${request.status}`}>{request.statusLabel}</span><h1>{request.id}</h1><p>{requestTypeLabel(request.requestType)} · получена {formatDate(request.createdAt)}</p></div>
      <SlaState request={request} />
    </div></section>
    <section className="section"><div className="container manager-request-layout">
      <div className="manager-request-content">
        <section className="manager-detail-card manager-detail-items"><header><span>01</span><div><h2>{request.requestType === "selection" ? "Задача и исходные данные" : "Состав запроса"}</h2><p>{request.requestType === "selection" ? "Клиент начал без артикула: используйте описание задачи и предварительное направление." : request.requestType === "quick_order" ? "Клиент выбрал точное исполнение и ждёт подтверждения по телефону." : "Именно эти исполнения и количество клиент добавил в КП."}</p></div></header><div className="manager-item-table">
          {request.items.map((item) => <article key={item.id}><div><small>{item.article || "Без артикула"}</small><h3>{item.href?.startsWith("/") ? <a href={item.href}>{item.title}</a> : item.title}</h3></div><dl><div><dt>Количество</dt><dd>{item.quantity} шт.</dd></div><div><dt>Цена на момент запроса</dt><dd>{item.price || "По запросу"}</dd></div></dl></article>)}
        </div></section>
        <section className="manager-detail-card"><header><span>02</span><div><h2>Что нужно проверить</h2><p>Чек-лист менеджера сформирован из выбора клиента.</p></div></header><div className="manager-check-grid"><Check active={request.requestedChecks.availability}>Наличие и срок</Check><Check active={request.requestedChecks.compatibility}>Комплектность и совместимость</Check><Check active={request.requestedChecks.documents}>Документы для закупки</Check><Check active={request.alternatives}>Допустимы аналоги</Check></div>{request.comment ? <div className="manager-client-comment"><span>Комментарий клиента</span><p>{request.comment}</p></div> : <p className="manager-empty-value">Комментарий к заявке не добавлен.</p>}</section>
        <section className="manager-detail-card"><header><span>03</span><div><h2>Контакты и организация</h2><p>Полные данные видны только в локальном тестовом контуре.</p></div></header><div className="manager-contact-grid"><dl><div><dt>Телефон</dt><dd><a href={`tel:${request.phoneFull}`} aria-label="Позвонить клиенту">{request.phoneFull}</a></dd></div><div><dt>Email</dt><dd>{request.emailFull ? <a href={`mailto:${request.emailFull}?subject=${encodeURIComponent(`Заявка ${request.id} — 7TOOL`)}`} aria-label="Написать клиенту по email">{request.emailFull}</a> : "Не указан — сначала позвоните"}</dd></div><div><dt>Компания</dt><dd>{request.company || "Не указана"}</dd></div><div><dt>Город</dt><dd>{request.city || "Не указан"}</dd></div></dl><div className="manager-contact-actions"><a href={`tel:${request.phoneFull}`}>Позвонить</a>{request.emailFull && <a href={`mailto:${request.emailFull}?subject=${encodeURIComponent(`Заявка ${request.id} — 7TOOL`)}`}>Подготовить email</a>}<small>{request.emailFull ? "Нажатие только открывает приложение. Автоматическая отправка отключена." : "Подбор запрошен по телефону. Email можно уточнить во время звонка."} Telegram/MAX клиента форма не запрашивала.</small></div></div></section>
        <section className="manager-detail-card"><header><span>04</span><div><h2>{request.attachment?.kind === "specification" ? "Техническое задание и источник" : "Реквизиты и источник"}</h2><p>{request.attachment?.kind === "specification" ? "Исходный файл клиента привязан к заявке и доступен только сотрудникам." : "Контекст для счёта и оценки эффективности сценария."}</p></div></header><div className="manager-meta-grid"><dl><div><dt>ИНН</dt><dd>{request.billingInn || "Не приложен"}</dd></div><div><dt>{request.attachment?.kind === "specification" ? "Файл ТЗ" : "Файл реквизитов"}</dt><dd>{request.attachment ? <><span>{attachmentLabel(request.attachment.mime)} · {formatBytes(request.attachment.size)} · {request.attachment.originalName}</span><a className="manager-attachment-download" href={`/api/quote-requests/${encodeURIComponent(request.id)}/attachment`}>Скачать файл</a></> : "Не приложен"}</dd></div></dl><dl><div><dt>Страница</dt><dd>{request.source.pagePath}</dd></div><div><dt>UTM</dt><dd>{formatUtm(request.source)}</dd></div></dl></div></section>
        <QuoteRevisionRegister requestId={request.id} entries={revisions} />
        <section className="manager-detail-card manager-history"><header><span>06</span><div><h2>История обработки</h2><p>Append-only журнал: события добавляются, но не стирают исходные данные.</p></div></header><ol><li><i aria-hidden="true" /><div><b>Заявка получена</b><span>{formatDate(request.createdAt)}</span><p>Номер присвоен после локального сохранения.</p></div></li>{request.events.map((event) => <HistoryEvent event={event} key={event.id} />)}</ol></section>
      </div>
      <aside className="manager-request-sidebar">{canManager(actor, "requests:update") ? <ManagerRequestActions requestId={request.id} status={request.status} assignee={request.assignee} canPrepareDelivery={canManager(actor, "delivery:prepare")} /> : <div className="manager-readonly-notice"><b>Режим просмотра</b><p>Текущая роль может проверять заявку, но не менять её этапы и заметки.</p></div>}<div className="manager-test-warning"><b>Тестовый контур</b><p>Внешние письма, MAX и CRM не вызываются. Для production понадобятся БД, файловое хранилище и outbox.</p></div></aside>
    </div></section>
  </main><PilotFooter /></div>;
}

function DisabledState() {
  return <div className="site-shell"><PilotHeader managerMode /><main className="inner-page"><section className="section"><div className="container"><div className="quote-journal-disabled"><b>Рабочее место менеджера отключено</b><p>Запустите локальный стенд с `QUOTE_TEST_MODE=1`.</p><Link href="/" prefetch={false}>Вернуться на главную</Link></div></div></section></main><PilotFooter /></div>;
}

function Check({ active, children }: { active: boolean; children: React.ReactNode }) {
  return <div className={active ? "active" : "inactive"}><i aria-hidden="true">{active ? "✓" : "—"}</i><span>{children}</span></div>;
}

function SlaState({ request }: { request: QuoteRequestDetail }) {
  if (request.firstHandledAt) return <div className="manager-sla manager-sla--done"><span>Взята в работу</span><b>{formatDate(request.firstHandledAt)}</b><small>SLA первого действия зафиксирован</small></div>;
  return <div className={`manager-sla ${request.slaBreached ? "manager-sla--late" : ""}`}><span>{request.slaBreached ? "Требует реакции" : "Срок первого действия"}</span><b>{formatTime(request.slaDueAt)}</b><small>{request.slaBreached ? "Контрольное время прошло" : "Настраивается через окружение"}</small></div>;
}

function HistoryEvent({ event }: { event: QuoteRequestEvent }) {
  const content = event.type === "assigned" ? { title:"Назначен ответственный", description:"Евгений Савельев" } : event.type === "status_changed" ? { title:"Изменён этап", description:statusLabel(event.status) } : { title:"Внутренняя заметка", description:event.note || "" };
  return <li><i aria-hidden="true" /><div><b>{content.title}</b><span>{formatDate(event.createdAt)}{event.actorName ? ` · ${event.actorName}, ${managerRoleLabel(event.actorRole)}` : ""}</span><p>{content.description}</p></div></li>;
}

function managerRoleLabel(role?: string) {
  if (role === "admin") return "администратор";
  if (role === "approver") return "согласующий";
  return "менеджер";
}

function requestTypeLabel(requestType: QuoteRequestDetail["requestType"]): string {
  if (requestType === "selection") return "Подбор по производственной задаче";
  if (requestType === "quick_order") return "Быстрый заказ";
  return "Запрос коммерческого предложения";
}

function statusLabel(status?: string) {
  return ({ received:"Получена", checking:"Проверка", quote_ready:"КП готово", sent:"Отправлено" } as Record<string, string>)[status || ""] || "Этап не указан";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", { timeZone:"Europe/Moscow", day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" }).format(new Date(value));
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", { timeZone:"Europe/Moscow", hour:"2-digit", minute:"2-digit" }).format(new Date(value));
}

function formatUtm(source: QuoteRequestDetail["source"]): string {
  return [source.utmSource, source.utmMedium, source.utmCampaign].filter(Boolean).join(" / ") || "Нет меток";
}

function attachmentLabel(mime: string): string {
  if (mime === "application/pdf") return "PDF";
  if (mime.includes("wordprocessingml")) return "Word DOCX";
  if (mime.includes("spreadsheetml")) return "Excel XLSX";
  return "Изображение";
}

function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} КБ` : `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}
