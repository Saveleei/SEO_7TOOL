import type { QuoteApprovalStage } from "../data/quoteApprovalStore";

export type QuoteRevisionEntry = {
  id: string;
  revision: number;
  createdAt: string;
  status: "draft" | "ready";
  approvalStage: QuoteApprovalStage;
  totalRub: number;
  itemCount: number;
  fingerprint: string;
};

export function QuoteRevisionRegister({ requestId, entries }: { requestId: string; entries: QuoteRevisionEntry[] }) {
  return <section className="manager-detail-card quote-revision-register" id="quote-revisions"><header><span>05</span><div><h2>Редакции коммерческого предложения</h2><p>Каждая строка - отдельная сохранённая версия. PDF формируется только для утверждённой редакции.</p></div></header>
    {entries.length ? <div className="quote-revision-list">{entries.map((entry, index) => {
      const downloadable = entry.status === "ready" && ["approved", "delivery_prepared"].includes(entry.approvalStage);
      return <article key={entry.revision}>
        <div className="quote-revision-id"><span>Редакция №{entry.revision}{index === 0 ? " · последняя" : ""}</span><b>{entry.id}</b><small>{formatDate(entry.createdAt)} · {entry.itemCount} поз.</small></div>
        <div className="quote-revision-state"><span className={`is-${entry.approvalStage}`}>{revisionLabel(entry.status, entry.approvalStage)}</span><b>{rub(entry.totalRub)}</b><small title={entry.fingerprint}>{entry.fingerprint ? `SHA-256 ${entry.fingerprint.slice(0, 10)}…` : "Контрольная сумма не создана"}</small></div>
        <div className="quote-revision-actions"><a href={`/test/requests/${requestId}/quote?mode=preview&revision=${entry.revision}`}>Предпросмотр</a>{downloadable ? <a className="primary" href={`/api/quote-requests/${requestId}/quote-pdf?revision=${entry.revision}`}>Скачать PDF</a> : <span>PDF после утверждения</span>}</div>
      </article>;
    })}</div> : <div className="quote-revision-empty"><b>Сохранённых редакций пока нет</b><p>Откройте конструктор, подтвердите цену и срок, затем сохраните первую редакцию.</p></div>}
  </section>;
}

function revisionLabel(status: QuoteRevisionEntry["status"], stage: QuoteApprovalStage) {
  if (status === "draft") return "Черновик";
  if (stage === "delivery_prepared") return "Пакет подготовлен";
  if (stage === "approved") return "Утверждено";
  if (stage === "submitted") return "На согласовании";
  if (stage === "changes_requested") return "На доработке";
  return "Готово к согласованию";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { timeZone:"Europe/Moscow", day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" }).format(new Date(value));
}

function rub(value: number) {
  return `${new Intl.NumberFormat("ru-RU", { minimumFractionDigits:value % 1 ? 2 : 0, maximumFractionDigits:2 }).format(value)} ₽`;
}
