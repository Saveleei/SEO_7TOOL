import type { Metadata } from "next";
import Link from "next/link";
import { requireManagerPageAccess } from "../../data/managerAccessPage";
import { isQuoteTestModeEnabled, listQuoteRequestSummaries, type QuoteRequestSummary } from "../../data/quoteRequestStore";
import { Breadcrumbs } from "../../ui/Breadcrumbs";
import { PilotFooter } from "../../ui/PilotFooter";
import { PilotHeader } from "../../ui/PilotHeader";

export const metadata: Metadata = { title:"Рабочее место менеджера — 7TOOL", robots:{ index:false, follow:false, nocache:true } };
export const dynamic = "force-dynamic";

type Filter = "all" | "new" | "attention" | "work" | "sent";

export default async function TestRequestsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const enabled = isQuoteTestModeEnabled();
  const actor = enabled ? await requireManagerPageAccess("requests:view", "/test/requests") : null;
  const requests = enabled ? await listQuoteRequestSummaries() : [];
  const { filter:rawFilter } = await searchParams;
  const filter = normalizeFilter(rawFilter);
  const visible = requests.filter((request) => matchesFilter(request, filter));
  const counts = {
    all:requests.length,
    new:requests.filter((request) => request.status === "received").length,
    attention:requests.filter((request) => request.status === "received" && request.slaBreached).length,
    work:requests.filter((request) => request.status === "checking" || request.status === "quote_ready").length,
    sent:requests.filter((request) => request.status === "sent").length,
  };
  return <div className="site-shell"><PilotHeader managerMode managerActor={actor} /><main className="inner-page quote-journal-page">
    <div className="container"><Breadcrumbs items={[{ label:"Главная", href:"/" }, { label:"Рабочее место менеджера" }]} /></div>
    <section className="quote-journal-hero"><div className="container"><p className="eyebrow">Защищённое рабочее место</p><h1>Заявки покупателей</h1><p>В одной очереди собраны запросы КП, подбор по задаче и поиск аналогов: сначала реакция менеджера, затем проверка поставки и подготовка предложения.</p></div></section>
    <section className="section"><div className="container">
      {!enabled ? <Disabled /> : requests.length === 0 ? <Empty /> : <>
        <div className="manager-queue-summary" aria-label="Сводка по очереди"><div><span>Всего</span><b>{counts.all}</b></div><div><span>Новые</span><b>{counts.new}</b></div><div className={counts.attention ? "attention" : ""}><span>Требуют реакции</span><b>{counts.attention}</b></div><div><span>Готовятся</span><b>{counts.work}</b></div></div>
        <nav className="manager-queue-filters" aria-label="Фильтр заявок"><FilterLink value="all" current={filter} count={counts.all}>Все</FilterLink><FilterLink value="new" current={filter} count={counts.new}>Новые</FilterLink><FilterLink value="attention" current={filter} count={counts.attention}>Требуют реакции</FilterLink><FilterLink value="work" current={filter} count={counts.work}>Готовим КП</FilterLink><FilterLink value="sent" current={filter} count={counts.sent}>Отправлены</FilterLink></nav>
      {visible.length ? <div className="quote-journal-list" aria-label="Сохранённые запросы КП">{visible.map((request) => <QuoteJournalCard request={request} key={request.id} />)}</div> : <div className="manager-filter-empty"><b>В этой группе заявок нет</b><p>Выберите другой фильтр — данные не удалены.</p><Link href="/test/requests" prefetch={false}>Показать все заявки</Link></div>}
      </>}
    </div></section>
  </main><PilotFooter /></div>;
}

function QuoteJournalCard({ request }: { request: QuoteRequestSummary }) {
  return <article className={request.slaBreached ? "is-late" : ""}><header><div><span className="manager-request-kind">{requestTypeLabel(request.requestType)}</span><span className={`manager-status manager-status--${request.status}`}>{request.statusLabel}</span><h2><a href={`/test/requests/${request.id}`}>{request.id}</a></h2></div><div className="manager-card-time"><time dateTime={request.createdAt}>{formatDate(request.createdAt)}</time>{request.slaBreached && <b>Нужна реакция</b>}</div></header><div className="quote-journal-facts"><dl><div><dt>{request.requestType === "selection" ? "Исходные данные" : "Состав"}</dt><dd>{request.itemCount} поз. · {request.totalQuantity} шт.</dd></div><div><dt>Контакт</dt><dd>{request.email}<br />{request.phone}</dd></div><div><dt>Компания / город</dt><dd>{request.company || "Не указана"}<br />{request.city || "Город не указан"}</dd></div><div><dt>Ответственный</dt><dd>{request.assigneeName || "Не назначен"}<br /><small>{request.billingProvided ? "Реквизиты добавлены" : "Без реквизитов"}</small></dd></div></dl><small>Источник: {request.sourcePath}</small></div><footer aria-label="Этапы обработки">{(["received", "checking", "quote_ready", "sent"] as const).map((status, index) => <span className={status === request.status ? "active" : ""} key={status}>{index + 1} · {statusLabel(status)}</span>)}</footer><a className="manager-open-request" href={`/test/requests/${request.id}`}>Открыть заявку <span aria-hidden="true">→</span></a></article>;
}

function requestTypeLabel(requestType: QuoteRequestSummary["requestType"]): string {
  if (requestType === "selection") return "Подбор по задаче";
  if (requestType === "quick_order") return "Быстрый заказ";
  return "Запрос КП";
}

function FilterLink({ value, current, count, children }: { value: Filter; current: Filter; count: number; children: React.ReactNode }) {
  return <a className={value === current ? "active" : ""} href={filterHref(value)} aria-current={value === current ? "page" : undefined}>{children}<span>{count}</span></a>;
}

function Disabled() {
  return <div className="quote-journal-disabled"><b>Приём заявок отключён</b><p>Администратор должен включить рабочее место и настроить защищённое хранилище.</p><Link href="/" prefetch={false}>Вернуться на главную</Link></div>;
}

function Empty() {
  return <div className="quote-journal-empty"><b>Сохранённых заявок пока нет</b><p>Новые запросы покупателей появятся здесь сразу после надёжного сохранения.</p><a href="/catalog">Открыть каталог</a></div>;
}

function normalizeFilter(value?: string): Filter {
  return (["new", "attention", "work", "sent"] as const).includes(value as Exclude<Filter, "all">) ? value as Filter : "all";
}

function filterHref(value: Filter): string {
  return value === "all" ? "/test/requests" : `/test/requests?filter=${value}`;
}

function matchesFilter(request: QuoteRequestSummary, filter: Filter) {
  if (filter === "new") return request.status === "received";
  if (filter === "attention") return request.status === "received" && request.slaBreached;
  if (filter === "work") return request.status === "checking" || request.status === "quote_ready";
  if (filter === "sent") return request.status === "sent";
  return true;
}

function statusLabel(status: QuoteRequestSummary["status"]): string {
  return ({ received:"Получена", checking:"Проверка", quote_ready:"КП готово", sent:"Отправлено" })[status];
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", { timeZone:"Europe/Moscow", day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" }).format(new Date(value));
}
