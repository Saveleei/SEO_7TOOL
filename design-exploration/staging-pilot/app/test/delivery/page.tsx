import type { Metadata } from "next";
import Link from "next/link";
import { requireManagerPageAccess } from "../../data/managerAccessPage";
import { filterQuoteDeliveryJournal, listQuoteDeliveryJournal, type QuoteDeliveryJournalChannel, type QuoteDeliveryJournalEntry } from "../../data/quoteDeliveryStore";
import { isQuoteTestModeEnabled } from "../../data/quoteRequestStore";
import { Breadcrumbs } from "../../ui/Breadcrumbs";
import { PilotFooter } from "../../ui/PilotFooter";
import { PilotHeader } from "../../ui/PilotHeader";

export const metadata: Metadata = { title:"Очередь коммерческих предложений — 7TOOL", robots:{ index:false, follow:false, nocache:true } };
export const dynamic = "force-dynamic";

type Params = { q?: string; channel?: string };

export default async function QuoteDeliveryJournalPage({ searchParams }: { searchParams: Promise<Params> }) {
  const enabled = isQuoteTestModeEnabled();
  const raw = await searchParams;
  const normalized = filterQuoteDeliveryJournal([], raw);
  const returnTo = journalHref(normalized.q, normalized.channel);
  const actor = enabled ? await requireManagerPageAccess("delivery:prepare", returnTo) : null;
  const allEntries = enabled ? await listQuoteDeliveryJournal() : [];
  const filtered = filterQuoteDeliveryJournal(allEntries, normalized);
  const counts = channelCounts(allEntries);

  return <div className="site-shell"><PilotHeader managerMode managerActor={actor} /><main className="inner-page quote-delivery-journal-page">
    <div className="container"><Breadcrumbs items={[{ label:"Главная", href:"/" }, { label:"Заявки", href:"/test/requests" }, { label:"Очередь КП" }]} /></div>
    <section className="quote-delivery-journal-hero"><div className="container"><div><p className="eyebrow">Администраторский контроль</p><h1>Очередь коммерческих предложений</h1><p>Все пакеты, которые прошли проверку и были зафиксированы во внутренней очереди. Это журнал подготовки: ни одна запись ниже не означает фактическую отправку клиенту.</p></div><div><span>Ожидают подключения канала</span><b>{counts.all}</b><small>Автоматическая отправка отключена</small></div></div></section>
    <section className="section"><div className="container">
      {!enabled ? <Disabled /> : <>
        <div className="quote-delivery-summary" aria-label="Сводка по каналам"><SummaryLink channel="all" current={filtered.channel} count={counts.all} q={filtered.q}>Все пакеты</SummaryLink><SummaryLink channel="email" current={filtered.channel} count={counts.email} q={filtered.q}>Email</SummaryLink><SummaryLink channel="telegram" current={filtered.channel} count={counts.telegram} q={filtered.q}>Telegram</SummaryLink><SummaryLink channel="max" current={filtered.channel} count={counts.max} q={filtered.q}>MAX</SummaryLink></div>
        <form className="quote-delivery-search" action="/test/delivery" method="get" role="search"><label htmlFor="delivery-query">Найти пакет</label><div><input id="delivery-query" name="q" defaultValue={filtered.q} maxLength={100} placeholder="Номер заявки, КП, компания или получатель" /><select name="channel" defaultValue={filtered.channel} aria-label="Канал связи"><option value="all">Все каналы</option><option value="email">Email</option><option value="telegram">Telegram</option><option value="max">MAX</option></select><button type="submit">Найти</button></div><p>Показано {filtered.entries.length} из {allEntries.length}. Поиск выполняется только внутри защищённого рабочего места.</p></form>
        {filtered.entries.length ? <div className="quote-delivery-journal-list" aria-label="Пакеты во внутренней очереди">{filtered.entries.map((entry) => <DeliveryJournalCard entry={entry} key={entry.id} />)}</div> : <Empty filtered={Boolean(filtered.q || filtered.channel !== "all")} />}
      </>}
    </div></section>
  </main><PilotFooter /></div>;
}

function DeliveryJournalCard({ entry }: { entry: QuoteDeliveryJournalEntry }) {
  return <article><header><div><span className="quote-delivery-held">Удерживается · не отправлено</span><h2><Link href={`/test/requests/${encodeURIComponent(entry.requestId)}/quote`}>{entry.quoteId}</Link></h2><p>{entry.company} · {entry.city}</p></div><div className="quote-delivery-journal-time"><time dateTime={entry.queuedAt}>{formatDate(entry.queuedAt)}</time><span>{entry.id}</span></div></header><div className="quote-delivery-journal-facts"><dl><div><dt>Получатель</dt><dd><b>{channelLabel(entry.channel)}</b><span>{entry.recipient}</span></dd></div><div><dt>Документ</dt><dd><b>Редакция №{entry.revision}</b><span>{entry.pdfFileName}</span></dd></div><div><dt>Состав и сумма</dt><dd><b>{entry.itemCount} {positionWord(entry.itemCount)}</b><span>{entry.totalRub == null ? "Сумма недоступна" : rub(entry.totalRub)}</span></dd></div><div><dt>Зафиксировал</dt><dd><b>{entry.queuedBy.name}</b><span>{entry.queuedBy.roleLabel}</span></dd></div></dl><p>Тема: {entry.subject}</p></div><footer><Link href={`/test/requests/${encodeURIComponent(entry.requestId)}`}>Открыть заявку</Link><Link href={`/test/requests/${encodeURIComponent(entry.requestId)}/quote?mode=preview&revision=${entry.revision}`}>Проверить КП</Link><a className="primary" href={`/api/quote-requests/${encodeURIComponent(entry.requestId)}/quote-pdf?revision=${entry.revision}`}>Скачать PDF</a></footer></article>;
}

function SummaryLink({ channel, current, count, q, children }: { channel: QuoteDeliveryJournalChannel; current: QuoteDeliveryJournalChannel; count: number; q: string; children: React.ReactNode }) {
  return <Link className={channel === current ? "active" : ""} href={journalHref(q, channel)} aria-current={channel === current ? "page" : undefined}><span>{children}</span><b>{count}</b></Link>;
}

function Empty({ filtered }: { filtered: boolean }) {
  return <div className="quote-delivery-journal-empty"><b>{filtered ? "Подходящих пакетов нет" : "Внутренняя очередь пока пуста"}</b><p>{filtered ? "Измените запрос или сбросьте фильтры — записи не удалены." : "Пакет появится здесь после утверждения КП и трёх контрольных подтверждений администратора."}</p>{filtered ? <Link href="/test/delivery">Сбросить фильтры</Link> : <Link href="/test/requests">Открыть заявки</Link>}</div>;
}

function Disabled() {
  return <div className="quote-delivery-journal-empty"><b>Локальная очередь отключена</b><p>Запустите тестовый стенд с разрешённым локальным хранением.</p><Link href="/">Вернуться на главную</Link></div>;
}

function channelCounts(entries: QuoteDeliveryJournalEntry[]) {
  return { all:entries.length, email:entries.filter((entry) => entry.channel === "email").length, telegram:entries.filter((entry) => entry.channel === "telegram").length, max:entries.filter((entry) => entry.channel === "max").length };
}

function journalHref(q: string, channel: QuoteDeliveryJournalChannel) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (channel !== "all") params.set("channel", channel);
  const query = params.toString();
  return `/test/delivery${query ? `?${query}` : ""}`;
}

function channelLabel(channel: QuoteDeliveryJournalEntry["channel"]) {
  if (channel === "email") return "Электронная почта";
  if (channel === "telegram") return "Telegram";
  return "MAX";
}

function rub(value: number) {
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits:2 }).format(value)} ₽`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { timeZone:"Europe/Moscow", day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" }).format(new Date(value));
}

function positionWord(count: number) {
  const mod100 = count % 100;
  const mod10 = count % 10;
  if (mod100 >= 11 && mod100 <= 14) return "позиций";
  if (mod10 === 1) return "позиция";
  if (mod10 >= 2 && mod10 <= 4) return "позиции";
  return "позиций";
}
