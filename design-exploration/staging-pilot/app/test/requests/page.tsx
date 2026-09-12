import type { Metadata } from "next";
import Link from "next/link";
import { isQuoteTestModeEnabled, listQuoteRequestSummaries, type QuoteRequestSummary } from "../../data/quoteRequestStore";
import { Breadcrumbs } from "../../ui/Breadcrumbs";
import { PilotFooter } from "../../ui/PilotFooter";
import { PilotHeader } from "../../ui/PilotHeader";

export const metadata: Metadata = { title:"Локальный журнал заявок — 7TOOL", robots:{ index:false, follow:false, nocache:true } };
export const dynamic = "force-dynamic";

export default async function TestRequestsPage() {
  const enabled = isQuoteTestModeEnabled();
  const requests = enabled ? await listQuoteRequestSummaries() : [];
  return <div className="site-shell"><PilotHeader /><main className="inner-page quote-journal-page">
    <div className="container"><Breadcrumbs items={[{ label:"Главная", href:"/" }, { label:"Локальный журнал" }]} /></div>
    <section className="quote-journal-hero"><div className="container"><p className="eyebrow">Только для локального тестового контура</p><h1>Журнал запросов КП</h1><p>Контакты маскированы. Email, MAX и CRM отключены — записи остаются на этом компьютере и нужны только для проверки сценария.</p></div></section>
    <section className="section"><div className="container">
      {!enabled ? <div className="quote-journal-disabled"><b>Приём заявок отключён</b><p>Запустите локальное превью с `QUOTE_TEST_MODE=1`. Без явного флага API возвращает 503 и ничего не сохраняет.</p><Link href="/">Вернуться на главную</Link></div> : requests.length === 0 ? <div className="quote-journal-empty"><b>Сохранённых заявок пока нет</b><p>Добавьте точное исполнение в КП и отправьте форму с вымышленными тестовыми контактами.</p><Link href="/search?q=STEYR-35">Открыть тестовый товар</Link></div> : <div className="quote-journal-list" aria-label="Сохранённые запросы КП">{requests.map((request) => <QuoteJournalCard request={request} key={request.id} />)}</div>}
    </div></section>
  </main><PilotFooter /></div>;
}

function QuoteJournalCard({ request }: { request: QuoteRequestSummary }) {
  return <article><header><div><span>Получена</span><h2>{request.id}</h2></div><time dateTime={request.createdAt}>{formatDate(request.createdAt)}</time></header><div className="quote-journal-facts"><dl><div><dt>Состав</dt><dd>{request.itemCount} поз. · {request.totalQuantity} шт.</dd></div><div><dt>Контакт</dt><dd>{request.email}<br />{request.phone}</dd></div><div><dt>Компания / город</dt><dd>{request.company || "Не указана"}<br />{request.city || "Город не указан"}</dd></div><div><dt>Реквизиты</dt><dd>{request.billingProvided ? "Добавлены" : "Не добавлены"}</dd></div></dl><small>Источник: {request.sourcePath}</small></div><footer aria-label="Этапы обработки"><b className="active">1 · Получена</b><span>2 · Проверка</span><span>3 · КП готово</span><span>4 · Отправлено</span></footer></article>;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", { timeZone:"Europe/Moscow", day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" }).format(new Date(value));
}

