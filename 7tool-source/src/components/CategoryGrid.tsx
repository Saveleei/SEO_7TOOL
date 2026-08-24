import Link from "next/link";
import { listPublicCategories } from "@/lib/categories-db";
import { getAllProducts } from "@/lib/products-db";

// Для категорий, где первый товар по флагам не репрезентативный (часто оснастка/расходник),
// подбираем обложку по ключевым словам в title.
const COVER_TITLE_PRIORITY: Record<string, RegExp> = {
  "stanki-sverlilnye": /steyr-?35\b/i,
  truborezy: /электрическ|стационарн|орбитальн/i,
  "kromkorezy-dlya-trub": /станок|машин|кромкорез|фаскосниматель/i,
  "kromkorezy-po-listu": /станок|машин|кромкорез|фаскосниматель/i,
  "karetki-svarochnye": /каретк|трактор|машин|механизм/i,
  "karetki-termicheskoy-rezki": /каретк|машин|трактор|резак/i,
  "rezbonareznye-manipulyatory": /манипул|gtm|heden/i,
};

// Прямое закрепление карточки-обложки по slug продукта (приоритет выше, чем regex).
const COVER_PINNED_PRODUCT: Record<string, string> = {
  "stanki-sverlilnye": "magnitnyy-sverlilnyy-stanok-lenz-steyr-35",
};

const CTA_TEXT: Record<string, string> = {
  "stanki-sverlilnye": "Подобрать станок",
  "koronchatye-sverla": "Все свёрла",
  borfrezy: "Все борфрезы",
  truborezy: "К труборезам",
  "kromkorezy-dlya-trub": "К кромкорезам",
  "kromkorezy-po-listu": "К кромкорезам",
  "karetki-svarochnye": "Сварочные каретки",
  "karetki-termicheskoy-rezki": "Каретки терморезки",
  "rezbonareznye-manipulyatory": "Манипуляторы",
};

const SUBTITLE_TEXT: Record<string, string> = {
  "stanki-sverlilnye": "Магнитные и стационарные · до Ø100 мм",
  "koronchatye-sverla": "Karnasch BLUE/GOLD/HARD-LINE · Ø12–110 мм",
  borfrezy: "Цилиндр, конус, шар, пламя",
  truborezy: "Электрические · Ø16–Ø600 мм",
  "kromkorezy-dlya-trub": "Фаска, торцевание, шлифовка",
  "kromkorezy-po-listu": "Стационарные и переносные · фаска до 60 мм",
  "karetki-svarochnye": "MIG/MAG, TIG, плазма · прямой и круговой шов",
  "karetki-termicheskoy-rezki": "Газокислородная и плазменная резка",
  "rezbonareznye-manipulyatory": "Heden GTM · резьбонарезка М5–М48",
};

// Положение оранжевого пятна — у каждой карточки своё, чтобы убрать
// одинаковое «по центру правого верхнего угла» во всех плитках.
const GLOW_POS = [
  "left-[12%] top-[8%]",
  "right-[10%] top-[15%]",
  "left-[55%] top-[5%]",
  "right-[8%] bottom-[12%]",
  "left-[8%] bottom-[8%]",
  "right-[28%] top-[10%]",
  "left-[40%] bottom-[18%]",
];

export function CategoryGrid() {
  const categories = listPublicCategories();
  const products = getAllProducts();
  return (
    <section id="categories" className="relative overflow-hidden border-b border-steel-200 bg-white py-10 sm:py-16 lg:py-20">
      <div className="absolute -left-40 top-32 -z-10 h-[480px] w-[480px] rounded-full bg-[radial-gradient(circle_at_center,_rgba(245,158,11,0.18),_transparent_60%)]" />
      <div className="absolute -right-40 bottom-20 -z-10 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle_at_center,_rgba(245,158,11,0.14),_transparent_60%)]" />
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <SectionEyebrow>Каталог 7TOOL</SectionEyebrow>
            <h2 className="mt-3 font-display text-[24px] font-extrabold tracking-tight text-steel-900 sm:text-[32px] lg:text-[42px]">
              <span className="sm:hidden">Каталог</span>
              <span className="hidden sm:inline">Девять направлений · одно окно поставки</span>
            </h2>
            <p className="mt-2 hidden max-w-[640px] text-[15px] text-steel-600 sm:mt-3 sm:block">
              Каждая категория — реальный склад в Москве, согласованные сроки и
              инженерный подбор. Кликайте — увидите всё, что есть прямо сейчас.
            </p>
          </div>
          <Link
            href="/kontakty"
            className="hidden items-center gap-2 rounded-md border border-steel-200 bg-white px-4 py-2.5 text-[13.5px] font-semibold text-steel-700 shadow-soft transition hover:-translate-y-0.5 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-800 sm:inline-flex"
          >
            Не нашли позицию? Запросите подбор
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:mt-10 sm:grid-cols-2 sm:gap-5 lg:grid-cols-12">
          {categories.map((c, i) => {
            const items = products.filter((p) => p.category === c.slug);
            const stocked = items.filter((p) => p.stock > 0).length;
            const onSale = items.filter((p) => p.discountPct).length;
            const totalSku = items.reduce((a, p) => a + p.variants.length, 0);
            const sampleBrands = Array.from(new Set(items.map((p) => p.brand).filter((b) => b && b !== "—"))).slice(0, 3);

            const titlePriority = COVER_TITLE_PRIORITY[c.slug];
            const pinnedSlug = COVER_PINNED_PRODUCT[c.slug];
            const candidates = items.filter((p) => p.images?.length);
            const pinnedImg = pinnedSlug
              ? candidates.find((p) => p.slug === pinnedSlug)?.images?.[0]
              : undefined;
            // Ручная обложка из админки всегда главная. Фото товара из фида
            // используем только как автоматический fallback, если обложка не задана.
            const hasManualCover = Boolean(c.coverImage);
            const cover =
              c.coverImage ??
              pinnedImg ??
              (titlePriority &&
                (candidates.find((p) => p.stock > 0 && titlePriority.test(p.title))?.images?.[0] ??
                  candidates.find((p) => titlePriority.test(p.title))?.images?.[0])) ??
              candidates.find((p) => p.stock > 0)?.images?.[0] ??
              candidates[0]?.images?.[0];

            // 7 → 4 узких + 3 широких; 8 → 4+4 узкие; 9 → 3+3+3 широкие; иначе узкие.
            const total = categories.length;
            const isWide = total === 7 ? i >= 4 : total === 9 ? true : false;
            const span = isWide ? "lg:col-span-4" : "lg:col-span-3";
            const aspect = isWide ? "aspect-[16/10]" : "aspect-[4/3]";
            const glow = GLOW_POS[i % GLOW_POS.length];

            return (
              <Link
                key={c.slug}
                href={`/c/${c.slug}`}
                className={`group relative flex flex-col overflow-hidden rounded-[18px] border border-steel-200 bg-white shadow-card transition duration-300 hover:-translate-y-1 hover:border-amber-300 hover:shadow-elev ${span}`}
              >
                {/* «отпечаток» — только у трети карточек, в случайных позициях */}
                {i % 2 === 0 && (
                  <div
                    aria-hidden
                    className={`pointer-events-none absolute z-0 h-[200px] w-[200px] rounded-full bg-[radial-gradient(circle_at_center,_rgba(245,158,11,0.20),_transparent_60%)] blur-md ${glow}`}
                  />
                )}
                {/* фото-зона */}
                <div className={`relative ${aspect} overflow-hidden bg-amber-50/40`}>
                  <div className="absolute inset-0 bg-blueprint opacity-30" />
                  {cover ? (
                    // Выбранная обложка показывается как готовый баннер; fallback из фида — как товар.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={cover}
                      alt={c.imageAlt ?? c.title}
                      loading="lazy"
                      decoding="async"
                      style={hasManualCover ? undefined : { mixBlendMode: "multiply" }}
                      className={`absolute inset-0 h-full w-full transition duration-500 group-hover:scale-[1.05] ${
                        hasManualCover ? "object-cover" : "object-contain p-7"
                      }`}
                    />
                  ) : null}

                  {/* верхняя плашка */}
                  <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-4">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-steel-900/85 px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.16em] text-amber-300 shadow-soft backdrop-blur">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_0_3px_rgba(245,158,11,0.25)]" />
                      {c.count.toLocaleString("ru-RU")} позиций
                    </span>
                    {onSale > 0 && (
                      <span className="rounded-md bg-amber-400 px-2 py-1 text-[10.5px] font-extrabold uppercase tracking-wider text-steel-900 shadow-amber">
                        −{onSale} акций
                      </span>
                    )}
                  </div>
                </div>

                {/* инфо */}
                <div className={`relative flex flex-1 flex-col gap-2.5 ${isWide ? "px-5 pb-5 pt-4" : "px-4 pb-4 pt-3.5"}`}>
                  <h3 className={`font-display font-extrabold leading-[1.1] tracking-tight text-steel-900 ${isWide ? "text-[22px] sm:text-[24px]" : "text-[16.5px] sm:text-[17.5px]"}`}>
                    {c.title}
                  </h3>
                  {(c.subtitle ?? SUBTITLE_TEXT[c.slug]) && (
                    <p className={`leading-snug text-steel-500 ${isWide ? "text-[12.5px]" : "text-[11.5px] line-clamp-2"}`}>
                      {c.subtitle ?? SUBTITLE_TEXT[c.slug]}
                    </p>
                  )}

                  {sampleBrands.length > 0 && (
                    <div className="hidden flex-wrap items-center gap-1.5 sm:flex">
                      {sampleBrands.map((b) => (
                        <span
                          key={b}
                          className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-800 ring-1 ring-amber-200"
                        >
                          {b}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className={`mt-auto hidden grid-cols-3 gap-px overflow-hidden rounded-md bg-steel-100/70 ring-1 ring-steel-100 sm:grid`}>
                    <Stat v={totalSku} l="артикулов" compact={!isWide} />
                    <Stat v={stocked} l="в наличии" tone="emerald" compact={!isWide} />
                    <Stat v={onSale} l="со скидкой" tone="amber" compact={!isWide} />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-amber-400 font-bold uppercase tracking-wider text-steel-900 shadow-amber transition group-hover:-translate-y-0.5 ${isWide ? "px-3 py-1.5 text-[12px]" : "px-2.5 py-1.5 text-[11px] tracking-[0.06em]"}`}>
                      {c.ctaText ?? CTA_TEXT[c.slug] ?? "Открыть"}
                      <svg width={isWide ? 13 : 11} height={isWide ? 13 : 11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" className="transition group-hover:translate-x-0.5"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Stat({ v, l, tone = "neutral", compact = false }: { v: number; l: string; tone?: "neutral" | "emerald" | "amber"; compact?: boolean }) {
  const valTone =
    tone === "emerald" ? "text-emerald-700"
    : tone === "amber" ? "text-amber-700"
    : "text-steel-900";
  return (
    <div className={`bg-white text-center ${compact ? "px-2 py-1.5" : "px-3 py-2"}`}>
      <div className={`font-display font-extrabold leading-none tracking-tight ${valTone} ${compact ? "text-[13px]" : "text-[16px]"}`}>{v}</div>
      <div className={`mt-0.5 font-bold uppercase tracking-[0.10em] text-steel-500 ${compact ? "text-[8px]" : "text-[10px]"}`}>{l}</div>
    </div>
  );
}

export function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700">
      <span className="h-px w-6 bg-amber-400" />
      {children}
    </div>
  );
}
