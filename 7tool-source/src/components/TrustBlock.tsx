import { products } from "@/lib/data";
import { SectionEyebrow } from "./CategoryGrid";

const proofCards = [
  {
    image: "/site/why-stock.webp",
    alt: "Реальный склад промышленного оборудования 7TOOL",
    badge: "Складские остатки",
  },
  {
    image: "/site/why-engineer.webp",
    alt: "Инженер проверяет инструмент и параметры обработки",
    badge: "Техническая экспертиза",
  },
  {
    image: "/site/why-documents.webp",
    alt: "Подготовка документов и комплектация заказа на складе",
    badge: "Комплектация заказа",
  },
] as const;

export function TrustBlock() {
  const skuCount = products.reduce((a, p) => a + p.variants.length, 0);
  const stockCount = products.filter((p) => p.stock > 0).length;
  const groupCount = products.filter((p) => p.isGroup).length;

  return (
    <section className="relative overflow-hidden border-y border-steel-200 bg-white py-16 lg:py-20">
      <div className="absolute -left-40 top-1/2 -z-10 h-[460px] w-[460px] -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_center,_rgba(245,158,11,0.16),_transparent_60%)]" />
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
        <SectionEyebrow>Почему 7TOOL</SectionEyebrow>
        <h2 className="mt-3 font-display text-[28px] font-bold tracking-tight text-steel-900 lg:text-[36px]">
          Промышленный инструмент со склада, не со слов менеджера
        </h2>
        <p className="mt-3 max-w-[640px] text-[15px] text-steel-600">
          Реальные остатки, реальные сроки, реальные специалисты. Никаких «уточним у поставщика».
        </p>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          <Card
            {...proofCards[0]}
            title={`${skuCount.toLocaleString("ru-RU")}+`}
            sub="артикулов в каталоге"
            body={`Группируем в ${groupCount} линеек, ${stockCount} продуктов на складе прямо сейчас.`}
          />
          <Card
            {...proofCards[1]}
            title="12 минут"
            sub="среднее время ответа"
            body="Инженер подберёт аналог под задачу, расскажет про материал и серию."
            highlight
          />
          <Card
            {...proofCards[2]}
            title="Постоплата"
            sub="для юрлиц по реквизитам"
            body="Счёт-фактура, ТТН, сертификаты. Безналичная оплата с НДС."
          />
        </div>
      </div>
    </section>
  );
}

function Card({
  title,
  sub,
  body,
  image,
  alt,
  badge,
  highlight,
}: {
  title: string;
  sub: string;
  body: string;
  image: string;
  alt: string;
  badge: string;
  highlight?: boolean;
}) {
  return (
    <article className={`group relative overflow-hidden rounded-[var(--radius-card)] border ${highlight ? "border-amber-300" : "border-steel-200"} bg-white shadow-card transition hover:-translate-y-1 hover:border-amber-400 hover:shadow-elev`}>
      <div className="relative aspect-[5/3] overflow-hidden bg-steel-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.035]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-steel-950/65 via-transparent to-transparent" />
        <span className="absolute bottom-3 left-3 rounded-full border border-white/20 bg-steel-950/75 px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-amber-300 backdrop-blur-sm">
          {badge}
        </span>
      </div>
      <div className={`p-6 ${highlight ? "bg-gradient-to-br from-amber-50/80 via-white to-white" : "bg-white"}`}>
        <div className="font-display text-[28px] font-extrabold tracking-tight text-steel-900">{title}</div>
        <div className="mt-1 text-[12px] font-bold uppercase tracking-[0.16em] text-amber-700">{sub}</div>
        <p className="mt-3 text-[13.5px] leading-snug text-steel-600">{body}</p>
      </div>
    </article>
  );
}
