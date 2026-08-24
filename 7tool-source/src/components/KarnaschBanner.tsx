import Link from "next/link";
import { products } from "@/lib/data";

export function KarnaschBanner() {
  const karnaschItems = products.filter(
    (p) => p.brand?.toLowerCase() === "karnasch",
  );
  const karnaschCount = karnaschItems.length;
  const heroProduct =
    karnaschItems.find((p) => p.stock > 0 && p.images?.length) ??
    karnaschItems.find((p) => p.images?.length);
  const heroImg = heroProduct?.images?.[0];

  return (
    <section className="relative overflow-hidden border-y border-amber-500/30 bg-steel-900 text-white">
      {/* blueprint */}
      <div className="absolute inset-0 -z-10 bg-blueprint-dark opacity-40" />
      {/* amber radial */}
      <div className="absolute -right-40 -top-40 -z-10 h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle_at_center,_rgba(245,158,11,0.40),_rgba(245,158,11,0)_60%)]" />
      <div className="absolute -bottom-40 -left-32 -z-10 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_center,_rgba(245,158,11,0.18),_rgba(245,158,11,0)_60%)]" />
      <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400 to-transparent" />

      <div className="relative mx-auto grid max-w-[1280px] items-center gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_minmax(0,440px)] lg:gap-12 lg:py-16">
        {/* Левая колонка */}
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.22em] text-amber-300">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_0_3px_rgba(245,158,11,0.25)]" />
            Made in Germany · Официальный дилер
          </div>

          <h2 className="mt-5 font-display text-[36px] font-black leading-[1] tracking-tight sm:text-[48px] lg:text-[64px]">
            <span className="bg-gradient-to-br from-white via-amber-100 to-amber-300 bg-clip-text text-transparent">
              KARNASCH
            </span>
          </h2>
          <div className="mt-2 font-display text-[18px] font-bold text-amber-300 sm:text-[20px]">
            Корончатые свёрла HSS-XE / TiN / Durablue
          </div>

          <p className="mt-4 max-w-[560px] text-[14.5px] leading-relaxed text-steel-300">
            Сверлим сталь до 1500 Н/мм², ресурс в 2–3 раза выше HSS-Co. Покрытие
            Durablue выдерживает работу всухую и по нержавейке. Со склада в РФ —
            отгрузка в день оплаты.
          </p>

          <div className="mt-6 grid grid-cols-3 gap-2 sm:max-w-[520px] sm:gap-3">
            <Stat value="12–100" unit="мм" label="диаметр" />
            <Stat value="до 110" unit="мм" label="глубина" />
            <Stat value="×2.5" unit="" label="ресурс vs HSS-Co" />
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/brand/karnasch"
              className="inline-flex items-center gap-2 rounded-md bg-amber-400 px-5 py-3 text-[14px] font-bold text-steel-900 shadow-amber transition hover:-translate-y-0.5 hover:bg-amber-300"
            >
              Каталог Karnasch
              {karnaschCount > 0 && (
                <span className="rounded-md bg-steel-900 px-2 py-0.5 text-[11px] font-extrabold tracking-wider text-amber-300">
                  {karnaschCount}
                </span>
              )}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
            </Link>
            <Link
              href="/kontakty"
              className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/5 px-5 py-3 text-[14px] font-semibold text-steel-100 transition hover:-translate-y-0.5 hover:border-amber-300 hover:text-amber-300"
            >
              Подбор под задачу
            </Link>
          </div>
        </div>

        {/* Правая колонка — реальное фото товара Karnasch */}
        {heroImg ? (
          <div className="relative hidden items-center justify-center lg:flex">
            <Link
              href={heroProduct ? `/p/${heroProduct.slug}` : "/brand/karnasch"}
              className="relative block aspect-square w-full max-w-[420px] overflow-hidden"
              aria-label={heroProduct?.title ?? "Karnasch"}
            >
              <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,_rgba(245,158,11,0.55),_transparent_65%)] blur-3xl" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroImg}
                alt={heroProduct?.title ?? "Karnasch"}
                className="relative h-full w-full object-contain drop-shadow-[0_20px_50px_rgba(245,158,11,0.45)] transition duration-500 hover:scale-105"
                loading="lazy"
              />
              <span className="pointer-events-none absolute inset-x-0 bottom-0 mx-auto h-3 w-3/4 rounded-full bg-amber-400/40 blur-md" />
            </Link>
          </div>
        ) : (
          <div className="relative hidden h-[320px] items-center justify-center lg:flex">
            <DrillBitArt />
          </div>
        )}
        {/* Мобильная урезанная версия */}
        {heroImg ? (
          <div className="relative flex h-[200px] items-center justify-center lg:hidden">
            <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,_rgba(245,158,11,0.45),_transparent_65%)] blur-2xl" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroImg}
              alt={heroProduct?.title ?? "Karnasch"}
              className="relative h-full w-auto object-contain drop-shadow-[0_12px_30px_rgba(245,158,11,0.4)]"
              loading="lazy"
            />
          </div>
        ) : (
          <div className="relative flex h-[180px] items-center justify-center lg:hidden">
            <DrillBitArt small />
          </div>
        )}
      </div>
    </section>
  );
}

function Stat({ value, unit, label }: { value: string; unit?: string; label: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2.5 backdrop-blur">
      <div className="font-display text-[18px] font-extrabold leading-none text-white sm:text-[22px]">
        {value}
        {unit && <span className="ml-1 text-[12px] font-bold text-amber-300">{unit}</span>}
      </div>
      <div className="mt-1 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-steel-400">
        {label}
      </div>
    </div>
  );
}

function DrillBitArt({ small = false }: { small?: boolean }) {
  const size = small ? 180 : 320;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* glow */}
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,_rgba(245,158,11,0.35),_transparent_65%)] blur-2xl" />
      <svg
        viewBox="0 0 200 320"
        className="relative h-full w-full drop-shadow-[0_8px_30px_rgba(245,158,11,0.35)]"
        style={{ transform: "rotate(-12deg)" }}
      >
        <defs>
          <linearGradient id="kb-steel" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#e8ecef" />
            <stop offset="0.3" stopColor="#a9b3bb" />
            <stop offset="0.55" stopColor="#5d6a72" />
            <stop offset="0.8" stopColor="#a9b3bb" />
            <stop offset="1" stopColor="#dfe4e8" />
          </linearGradient>
          <linearGradient id="kb-blue" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#7ea7ff" />
            <stop offset="0.5" stopColor="#1c45a8" />
            <stop offset="1" stopColor="#7ea7ff" />
          </linearGradient>
          <linearGradient id="kb-amber" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#fcd34d" />
            <stop offset="1" stopColor="#d97706" />
          </linearGradient>
        </defs>

        {/* верхний хвостовик (Weldon) */}
        <rect x="80" y="10" width="40" height="40" rx="2" fill="url(#kb-steel)" />
        <rect x="80" y="22" width="40" height="3" fill="#3a4750" opacity="0.6" />
        <circle cx="100" cy="42" r="3" fill="#0f161b" opacity="0.5" />

        {/* шейка */}
        <rect x="78" y="50" width="44" height="20" fill="url(#kb-steel)" />

        {/* основное тело сверла — синее покрытие Durablue */}
        <rect x="55" y="70" width="90" height="180" rx="4" fill="url(#kb-blue)" />
        {/* отражение сверху */}
        <rect x="55" y="70" width="20" height="180" fill="url(#kb-steel)" opacity="0.2" />

        {/* спиральные канавки */}
        {Array.from({ length: 7 }).map((_, i) => (
          <path
            key={i}
            d={`M55 ${85 + i * 24} Q100 ${95 + i * 24}, 145 ${85 + i * 24}`}
            stroke="rgba(0,0,0,0.45)"
            strokeWidth="1.5"
            fill="none"
          />
        ))}
        {Array.from({ length: 7 }).map((_, i) => (
          <path
            key={`hi-${i}`}
            d={`M55 ${83 + i * 24} Q100 ${93 + i * 24}, 145 ${83 + i * 24}`}
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="1"
            fill="none"
          />
        ))}

        {/* режущая корона */}
        <polygon
          points="55,250 65,265 75,250 85,265 95,250 105,265 115,250 125,265 135,250 145,265 145,275 55,275"
          fill="url(#kb-amber)"
        />
        <polygon
          points="55,250 65,265 75,250 85,265 95,250 105,265 115,250 125,265 135,250 145,265"
          stroke="#92400e"
          strokeWidth="1"
          fill="none"
        />

        {/* искра */}
        <g opacity="0.9">
          <circle cx="40" cy="285" r="2" fill="#fcd34d" />
          <circle cx="160" cy="290" r="3" fill="#fbbf24" />
          <circle cx="100" cy="305" r="2.5" fill="#fcd34d" />
          <circle cx="55" cy="300" r="1.5" fill="#fde68a" />
          <circle cx="145" cy="305" r="1.5" fill="#fde68a" />
        </g>

        {/* лейбл KARNASCH вертикально */}
        <text
          x="100"
          y="170"
          textAnchor="middle"
          fontFamily="ui-sans-serif, system-ui"
          fontSize="14"
          fontWeight="900"
          letterSpacing="2"
          fill="rgba(255,255,255,0.85)"
        >
          KARNASCH
        </text>
      </svg>
    </div>
  );
}
