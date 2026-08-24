import type { Product, Variant } from "@/lib/data";

export function ProductFaq({ product, variant }: { product: Product; variant: Variant }) {
  const items = buildFaq(product, variant);

  const ldjson = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: { "@type": "Answer", text: it.a },
    })),
  };

  return (
    <section id="p-faq" className="mt-12 scroll-mt-28 rounded-[18px] border border-steel-200 bg-white p-6 shadow-card">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700">
        <span className="h-px w-6 bg-amber-400" />
        Вопрос-ответ
      </div>
      <h2 className="mt-2 font-display text-[22px] font-extrabold text-steel-900">
        Что обычно спрашивают
      </h2>
      <div className="mt-5 divide-y divide-steel-100">
        {items.map((it, i) => {
          return (
            <details key={it.q} open={i === 0} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-3.5 text-left marker:hidden">
                <span className="text-[14.5px] font-bold text-steel-900">{it.q}</span>
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-amber-300 bg-amber-50 text-amber-700 transition group-open:rotate-45">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="M12 5v14M5 12h14"/></svg>
                </span>
              </summary>
              <div className="pb-4 pr-10 text-[14px] leading-relaxed text-steel-700">{it.a}</div>
            </details>
          );
        })}
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ldjson) }}
      />
    </section>
  );
}

function buildFaq(product: Product, variant: Variant) {
  const inStock = variant.available && (variant.quantity ?? 0) > 0;
  return [
    {
      q: "Есть ли товар в наличии?",
      a: inStock
        ? `Да, артикул ${variant.sku} есть на складах в Москве и Санкт-Петербурге — отгружаем в день оплаты транспортной компанией или нашей машиной.`
        : `Артикул ${variant.sku} сейчас под заказ. Точную дату поставки по этой модификации подтверждает менеджер после проверки у поставщика.`,
    },
    {
      q: "Работаете ли вы с юридическими лицами?",
      a: "Да. Выставляем счёт с НДС. После оплаты согласуем отгрузку транспортной компанией или нашей машиной.",
    },
    {
      q: "Какая гарантия на оборудование?",
      a: `Условия гарантии для ${product.brand} и конкретного артикула указаны в документации производителя. Менеджер подтвердит срок и порядок обращения до оплаты.`,
    },
    {
      q: "Можно ли вернуть, если не подойдёт?",
      a: "Условия обмена и возврата зависят от договора поставки и статуса товара. До отправки товара свяжитесь с менеджером — он проверит документы и согласует порядок действий.",
    },
    {
      q: "Что насчёт документов и сертификатов?",
      a: "Полный пакет: счёт-фактура с НДС, паспорт изделия, сертификат ТР ТС, при необходимости — оригинал сертификата производителя. Документы отправляем оригиналом по почте или ЭДО.",
    },
  ];
}
