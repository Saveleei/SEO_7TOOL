import Link from "next/link";
import { categories, company } from "@/lib/data";
import { Logo } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden bg-steel-900 text-steel-300">
      <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
      <div className="absolute -left-40 -top-20 h-[400px] w-[400px] rounded-full bg-amber-400/10 blur-[120px]" />
      <div className="absolute -right-40 bottom-0 h-[360px] w-[360px] rounded-full bg-amber-500/10 blur-[120px]" />
      <div className="relative mx-auto max-w-[1280px] px-6 py-14">
        <div className="grid gap-10 border-b border-white/10 pb-12 lg:grid-cols-[1.3fr_2fr]">
          <div>
            <Logo inverted />
            <p className="mt-5 max-w-[320px] text-[13.5px] leading-relaxed text-steel-400">
              Промышленный инструмент и оборудование для металлообработки.
              Счёт с НДС, инженерный подбор и поставка по России.
            </p>
            <div className="mt-6 space-y-2">
              <a href={`tel:${company.phone.replace(/\D/g, "")}`} className="inline-flex items-center gap-2 font-display text-[24px] font-extrabold tracking-tight text-white hover:text-amber-300">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="text-amber-400" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                {company.phone}
              </a>
              <a href={`mailto:${company.email}`} className="flex items-center gap-2 font-display text-[18px] font-bold text-white hover:text-amber-300">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="text-amber-400" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
                {company.email}
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8">
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.22em] text-amber-300">
                Каталог
              </div>
              <ul className="mt-4 space-y-2.5">
                {categories.map((c) => (
                  <li key={c.slug}>
                    <Link href={`/c/${c.slug}`} className="text-[13.5px] text-steel-300 hover:text-white">
                      {c.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.22em] text-amber-300">
                Навигация
              </div>
              <ul className="mt-4 space-y-2.5">
                <li>
                  <Link href="/cart" className="text-[13.5px] text-steel-300 hover:text-white">
                    Корзина
                  </Link>
                </li>
                <li>
                  <Link href="/articles" className="text-[13.5px] text-steel-300 hover:text-white">
                    База знаний
                  </Link>
                </li>
                <li>
                  <Link href="/kontakty" className="text-[13.5px] text-steel-300 hover:text-white">
                    Контакты
                  </Link>
                </li>
                <li><Link href="/dostavka-i-oplata" className="text-[13.5px] text-steel-300 hover:text-white">Доставка и оплата</Link></li>
                <li><Link href="/garantiya-i-vozvrat" className="text-[13.5px] text-steel-300 hover:text-white">Гарантия и возврат</Link></li>
                <li><Link href="/politika-konfidencialnosti" className="text-[13.5px] text-steel-300 hover:text-white">Политика конфиденциальности</Link></li>
                <li><Link href="/soglasie-na-obrabotku" className="text-[13.5px] text-steel-300 hover:text-white">Согласие на обработку данных</Link></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 pt-8 text-[12px] text-steel-500 lg:flex-row lg:items-center lg:justify-between">
          <div>
            © 2026 {company.legalName}. Все товарные знаки принадлежат правообладателям.
          </div>
          <div>{company.address}</div>
        </div>
      </div>
    </footer>
  );
}
