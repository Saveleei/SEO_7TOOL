import Link from "next/link";

type KnowledgeItem = {
  href: string;
  eyebrow: string;
  title: string;
  description: string;
  linkLabel: string;
};

const knowledgeByCategory: Record<string, KnowledgeItem[]> = {
  "koronchatye-sverla": [{
    href: "/articles/kak-vybrat-koronchatoe-sverlo",
    eyebrow: "Практическое руководство",
    title: "Как выбрать корончатое сверло",
    description: "Сравнение HSS и TCT, проверка хвостовика Weldon, рабочей глубины, направляющего штифта и совместимости со станком.",
    linkLabel: "Перейти к руководству",
  }],
  "stanki-sverlilnye/magnitnye": [
    {
      href: "/articles/kak-vybrat-magnitnyy-sverlilnyy-stanok",
      eyebrow: "Руководство по оборудованию",
      title: "Как выбрать магнитный сверлильный станок",
      description: "Подбор по диаметру и глубине сверления, габаритам, шпинделю, рабочему ходу, скоростям, реверсу и условиям установки.",
      linkLabel: "Открыть руководство по станкам",
    },
    {
      href: "/articles/kak-vybrat-koronchatoe-sverlo",
      eyebrow: "Оснастка для магнитного станка",
      title: "Подбор корончатого сверла к станку",
      description: "Что проверить перед заказом оснастки: диаметр, глубину реза, посадку, направляющий штифт и подачу СОЖ.",
      linkLabel: "Открыть руководство по подбору",
    },
  ],
};

export function CategoryKnowledgeCard({ categoryKey }: { categoryKey: string }) {
  const items = knowledgeByCategory[categoryKey];
  if (!items?.length) return null;

  return (
    <section className="border-t border-steel-200 bg-steel-50/70" aria-labelledby={`knowledge-${categoryKey.replaceAll("/", "-")}`}>
      <div className="mx-auto max-w-[980px] px-4 py-9 sm:px-6 sm:py-12">
        <h2 id={`knowledge-${categoryKey.replaceAll("/", "-")}`} className="font-display text-[22px] font-extrabold tracking-tight text-steel-900">
          Помощь с выбором оборудования и оснастки
        </h2>
        <div className="mt-5 grid gap-4">
          {items.map((item) => (
            <article key={item.href} className="rounded-[14px] border border-steel-200 bg-white p-5 shadow-sm sm:p-6">
              <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-amber-700">{item.eyebrow}</p>
              <h3 className="mt-2 font-display text-[20px] font-extrabold text-steel-900">{item.title}</h3>
              <p className="mt-2 max-w-[780px] text-[14px] leading-7 text-steel-700">{item.description}</p>
              <Link
                href={item.href}
                className="mt-4 inline-flex items-center rounded-md bg-steel-900 px-4 py-2.5 text-[13px] font-bold text-white transition hover:bg-amber-500 hover:text-steel-950"
              >
                {item.linkLabel} →
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
