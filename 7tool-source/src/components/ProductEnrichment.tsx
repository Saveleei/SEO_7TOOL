import Link from "next/link";
import type { PublicProductEnrichment } from "@/lib/product-enrichment-db";

const SECTION_META = {
  SUITABLE_TASK: { title: "Для каких задач подходит", tone: "border-emerald-200 bg-emerald-50/45" },
  NOT_SUITABLE_TASK: { title: "Для каких задач не подходит", tone: "border-rose-200 bg-rose-50/45" },
  ADVANTAGE: { title: "Основные преимущества", tone: "border-amber-200 bg-amber-50/45" },
  BEFORE_BUYING: { title: "Что важно перед покупкой", tone: "border-cobalt-200 bg-cobalt-50/40" },
  COMPATIBLE_ACCESSORY: { title: "Совместимая оснастка", tone: "border-steel-200 bg-white" },
  ANALOG: { title: "Аналоги", tone: "border-steel-200 bg-white" },
  DIFFERENCE: { title: "Чем отличается от других моделей", tone: "border-steel-200 bg-white" },
} as const;

export function ProductEnrichment({
  enrichment,
  selectionEnabled,
}: {
  enrichment: PublicProductEnrichment;
  selectionEnabled: boolean;
}) {
  return (
    <section className="border-t border-steel-200 bg-steel-50/45 py-14" data-enrichment-version={enrichment.version}>
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
        <div className="max-w-[760px]">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700">
            <span className="h-px w-6 bg-amber-400" />
            Проверено по фактам
          </div>
          <h2 className="mt-2 font-display text-[27px] font-extrabold tracking-tight text-steel-900 sm:text-[32px]">
            Как выбрать и применять эту модель
          </h2>
          <p className="mt-3 text-[14px] leading-6 text-steel-600">
            Здесь показаны только выводы, связанные с проверенными характеристиками, применениями и совместимостью. Отсутствующий раздел означает, что подтверждённых данных для него пока недостаточно.
          </p>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          {enrichment.sections.map((section) => {
            const meta = SECTION_META[section.type];
            return (
              <section key={section.type} className={`rounded-[14px] border p-5 sm:p-6 ${meta.tone}`}>
                <h3 className="font-display text-[20px] font-extrabold text-steel-900">{meta.title}</h3>
                <ul className="mt-4 space-y-4">
                  {section.items.map((item) => (
                    <li key={item.id} className="border-t border-steel-200/70 pt-4 first:border-0 first:pt-0">
                      <div className="text-[14px] font-bold leading-5 text-steel-900">
                        {item.relatedProduct ? (
                          <Link href={item.relatedProduct.href} className="text-cobalt-700 underline decoration-cobalt-200 underline-offset-2 hover:text-cobalt-900">
                            {item.label}
                          </Link>
                        ) : item.label}
                      </div>
                      <p className="mt-1.5 text-[13px] leading-6 text-steel-700">{item.body}</p>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        {enrichment.faq.length > 0 && (
          <section className="mt-8 rounded-[14px] border border-steel-200 bg-white px-5 sm:px-7">
            <h3 className="pt-6 font-display text-[22px] font-extrabold text-steel-900">Частые вопросы по характеристикам</h3>
            <div className="mt-3 divide-y divide-steel-200">
              {enrichment.faq.map((item, index) => (
                <details key={item.id} open={index === 0} className="group py-5">
                  <summary className="cursor-pointer list-none pr-8 text-[14px] font-bold leading-6 text-steel-900 marker:content-none">
                    {item.question}
                  </summary>
                  <p className="mt-3 max-w-[900px] text-[13px] leading-6 text-steel-700">{item.answer}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        {enrichment.articles.length > 0 && (
          <section className="mt-8">
            <h3 className="font-display text-[22px] font-extrabold text-steel-900">Полезные статьи</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {enrichment.articles.map((article) => (
                <Link key={article.slug} href={article.href} className="rounded-[12px] border border-steel-200 bg-white p-5 transition hover:border-amber-300 hover:shadow-soft">
                  <span className="font-display text-[17px] font-extrabold leading-6 text-steel-900">{article.title}</span>
                  <span className="mt-2 line-clamp-3 block text-[12px] leading-5 text-steel-600">{article.excerpt}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {selectionEnabled && (
          <div className="mt-8 flex flex-col justify-between gap-4 rounded-[14px] border border-amber-300 bg-steel-900 p-5 text-white sm:flex-row sm:items-center sm:p-6">
            <div>
              <h3 className="font-display text-[20px] font-extrabold">Нужен подбор оборудования?</h3>
              <p className="mt-1 text-[13px] leading-6 text-steel-300">Передайте параметры задачи инженеру — он сверит модель, модификацию и оснастку.</p>
            </div>
            <a href="#selection-form" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-amber-400 px-5 text-[13px] font-extrabold text-steel-900 transition hover:bg-amber-300">
              Перейти к подбору
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
