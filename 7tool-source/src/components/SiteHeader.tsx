import Link from "next/link";
import { CartLink } from "./CartLink";
import { CatalogMenu } from "./CatalogMenu";
import { Logo } from "./Logo";
import { categories } from "@/lib/data";
import { manager, company } from "@/lib/site-config";
import { TrustBar } from "./TrustBar";
import { FavoritesLink } from "./FavoritesLink";

export function SiteHeader() {
  const categoryIndex = categories.map(({ slug, title, count }) => ({ slug, title, count }));
  return (
    <header className="sticky top-0 z-40 border-b border-steel-200 bg-white/95 shadow-soft backdrop-blur supports-[backdrop-filter]:bg-white/90">
      <span className="block h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-300" />

      {/* utility row — desktop */}
      <div className="hidden border-b border-steel-100 bg-steel-50/60 lg:block">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-2 text-[12.5px] text-steel-500">
          <div className="flex items-center gap-5">
            <Link href="/kontakty" className="hover:text-steel-900 transition">Контакты</Link>
            <span>Дилер Karnasch — официальные поставки в РФ</span>
            <span className="text-steel-400">{manager.hours}</span>
          </div>
          <div className="flex items-center gap-3">
            <a href={`tel:${manager.phone.replace(/\D/g, "")}`} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-display text-[14px] font-extrabold tracking-tight text-steel-900 transition hover:bg-amber-50 hover:text-amber-800">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" className="text-amber-600" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
              {manager.phone}
            </a>
            <span className="h-4 w-px bg-steel-300" />
            <a href={`mailto:${company.email}`} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-display text-[14px] font-extrabold tracking-tight text-steel-900 transition hover:bg-amber-50 hover:text-amber-800">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="text-amber-600" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
              {company.email}
            </a>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1280px] items-center gap-3 px-4 py-3 lg:gap-4 lg:px-6 lg:py-3.5">
        <Link href="/" className="shrink-0 transition hover:-translate-y-0.5" aria-label="7TOOL">
          <Logo />
        </Link>

        <CatalogMenu categories={categoryIndex} />

        <FavoritesLink />
        <CartLink />
      </div>

      {/* mobile contact strip */}
      <div className="flex items-stretch border-t border-amber-200 bg-gradient-to-r from-amber-50 via-white to-amber-50 lg:hidden">
        <a
          href={`tel:${manager.phone.replace(/\D/g, "")}`}
          className="flex min-h-11 flex-1 items-center justify-center gap-1.5 px-3 py-2.5 font-display text-[13.5px] font-extrabold tracking-tight text-steel-900"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" className="text-amber-600" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
          {manager.phone}
        </a>
        <span className="w-px bg-amber-200" />
        <a
          href={`mailto:${company.email}`}
          className="flex min-h-11 flex-1 items-center justify-center gap-1.5 px-3 py-2.5 font-display text-[13.5px] font-extrabold tracking-tight text-steel-900"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="text-amber-600" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
          {company.email}
        </a>
      </div>

      <TrustBar />
    </header>
  );
}
