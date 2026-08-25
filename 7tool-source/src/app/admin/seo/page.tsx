import { requireAdmin } from "@/lib/auth";
import { getSeoDashboardData, SEO_INTELLIGENCE_SECTIONS } from "@/lib/seo-dashboard";

export const dynamic = "force-dynamic";

const formatNumber = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });
const formatMoney = new Intl.NumberFormat("ru-RU", {
  style: "currency", currency: "RUB", maximumFractionDigits: 0,
});

export default async function SeoIntelligencePage() {
  await requireAdmin();
  const data = getSeoDashboardData();
  return (
    <section className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700">SEO Intelligence</p>
          <h1 className="mt-2 font-display text-[30px] font-extrabold tracking-tight text-steel-900 lg:text-[36px]">Поиск, контент и коммерческий результат</h1>
          <p className="mt-2 max-w-[760px] text-[14px] leading-6 text-steel-600">
            Агрегированные проверенные данные. Refresh, pruning и publishing остаются на ручном рассмотрении.
          </p>
        </div>
        <div className="rounded-full border border-steel-200 bg-white px-4 py-2 text-[12px] font-semibold text-steel-600">
          {data.period ? `${data.period.start} — ${data.period.end}` : "Нет проверенного performance-периода"}
        </div>
      </div>

      {!data.schemaReady && (
        <div className="mt-6 rounded-[12px] border border-amber-200 bg-amber-50 px-5 py-4 text-[13px] leading-6 text-amber-950">
          Phase 21 ещё не материализована в этой базе. Дашборд показывает доступные безопасные агрегаты и не запускает миграции сам.
        </div>
      )}

      <div className="mt-7 grid gap-6 xl:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Разделы SEO Intelligence" className="h-fit rounded-[14px] border border-steel-200 bg-white p-3 shadow-soft xl:sticky xl:top-24">
          {SEO_INTELLIGENCE_SECTIONS.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-[12.5px] font-semibold text-steel-700 hover:bg-amber-50 hover:text-amber-800">
              <span>{label}</span>
              {id !== "dashboard" && <span className="text-[11px] tabular-nums text-steel-400">{data.counts[id] ?? 0}</span>}
            </a>
          ))}
        </nav>

        <div className="min-w-0 space-y-7">
          <section id="dashboard" className="scroll-mt-24">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Metric label="Organic clicks" value={formatNumber.format(data.metrics.organicClicks)} />
              <Metric label="Impressions" value={formatNumber.format(data.metrics.impressions)} />
              <Metric label="Average position" value={data.metrics.averagePosition == null ? "—" : formatNumber.format(data.metrics.averagePosition)} />
              <Metric label="Indexed pages" value={formatNumber.format(data.metrics.indexedPages)} />
              <Metric label="Organic leads" value={formatNumber.format(data.metrics.organicLeads)} />
              <Metric label="Revenue" value={formatMoney.format(data.metrics.revenueMinor / 100)} />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Signal label="Quick wins" value={data.signals.quickWins} tone="amber" />
              <Signal label="Cannibalization" value={data.signals.cannibalization} tone="red" />
              <Signal label="Indexation issues" value={data.signals.indexationIssues} tone="red" />
              <Signal label="Content decay" value={data.signals.contentDecay} tone="amber" />
            </div>
          </section>

          <div className="grid gap-5 lg:grid-cols-3">
            <Ranking title="Top categories" items={data.topCategories} />
            <Ranking title="Top articles" items={data.topArticles} />
            <Ranking title="Top products" items={data.topProducts} />
          </div>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {SEO_INTELLIGENCE_SECTIONS.filter(([id]) => !new Set(["dashboard", "performance", "publishing-queue", "errors"]).has(id)).map(([id, label]) => (
              <article key={id} id={id} className="scroll-mt-24 rounded-[14px] border border-steel-200 bg-white p-5 shadow-soft">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-steel-500">{label}</p>
                <p className="mt-3 font-display text-[30px] font-extrabold text-steel-900">{formatNumber.format(data.counts[id] ?? 0)}</p>
                <p className="mt-2 text-[12px] leading-5 text-steel-500">Проверенные записи текущего локального контура.</p>
              </article>
            ))}
          </section>

          <section id="performance" className="scroll-mt-24 rounded-[14px] border border-steel-200 bg-white p-6 shadow-soft">
            <h2 className="font-display text-[20px] font-extrabold text-steel-900">Performance</h2>
            <p className="mt-2 text-[13px] leading-6 text-steel-600">Показы, клики, позиции и коммерческие результаты берутся только из агрегированных Google, Yandex и CRM evidence snapshots.</p>
          </section>

          <section id="publishing-queue" className="scroll-mt-24 rounded-[14px] border border-steel-200 bg-white p-6 shadow-soft">
            <h2 className="font-display text-[20px] font-extrabold text-steel-900">Publishing Queue</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {data.publishingQueue.length ? data.publishingQueue.map((item) => (
                <span key={item.status} className="rounded-full border border-steel-200 bg-steel-50 px-3 py-1.5 text-[12px] font-bold text-steel-700">{item.status}: {item.count}</span>
              )) : <span className="text-[13px] text-steel-500">Очередь пуста или миграция не применена.</span>}
            </div>
          </section>

          <section id="errors" className="scroll-mt-24 rounded-[14px] border border-red-200 bg-white p-6 shadow-soft">
            <h2 className="font-display text-[20px] font-extrabold text-steel-900">Errors</h2>
            {data.errors.length ? (
              <ul className="mt-4 divide-y divide-steel-100">
                {data.errors.map((item) => <li key={item.label} className="flex justify-between gap-4 py-3 text-[13px]"><span>{item.label}</span><strong className="text-red-700">{item.value}</strong></li>)}
              </ul>
            ) : <p className="mt-3 text-[13px] text-steel-500">В доступных проверенных данных ошибок не обнаружено.</p>}
          </section>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-[14px] border border-steel-200 bg-white p-5 shadow-soft"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-steel-500">{label}</p><p className="mt-3 font-display text-[28px] font-extrabold tracking-tight text-steel-900">{value}</p></div>;
}

function Signal({ label, value, tone }: { label: string; value: number; tone: "amber" | "red" }) {
  const classes = tone === "red" ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-900";
  return <div className={`rounded-[12px] border px-4 py-3 ${classes}`}><p className="text-[11px] font-bold uppercase tracking-[0.12em]">{label}</p><p className="mt-1 font-display text-[24px] font-extrabold">{value}</p></div>;
}

function Ranking({ title, items }: { title: string; items: Array<{ label: string; value: number; detail?: string }> }) {
  return <section className="rounded-[14px] border border-steel-200 bg-white p-5 shadow-soft"><h2 className="font-display text-[18px] font-extrabold text-steel-900">{title}</h2>{items.length ? <ol className="mt-4 space-y-3">{items.map((item, index) => <li key={`${item.label}-${index}`} className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-start gap-2 text-[12px]"><span className="font-bold text-steel-400">{index + 1}</span><span className="min-w-0"><span className="block truncate font-semibold text-steel-800">{item.label}</span>{item.detail && <span className="block truncate text-[11px] text-steel-400">{item.detail}</span>}</span><strong className="tabular-nums text-steel-900">{formatNumber.format(item.value)}</strong></li>)}</ol> : <p className="mt-4 text-[12px] text-steel-500">Нет materialized данных.</p>}</section>;
}
