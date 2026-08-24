import Link from "next/link";
import { company, phoneHref } from "@/lib/site-config";
import { Logo } from "@/components/Logo";

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-steel-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-[68px] max-w-[1180px] items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="7TOOL — на главную" className="shrink-0 transition hover:-translate-y-0.5">
          <Logo />
        </Link>
        <div className="hidden text-center text-[12px] leading-snug text-steel-600 md:block">
          Склады в Москве и Санкт-Петербурге<br />{company.hours}
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`mailto:${company.email}`}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-steel-200 px-3 text-[13px] font-bold text-steel-800 hover:border-amber-400 hover:bg-amber-50"
          >
            <span className="sm:hidden">Email</span><span className="hidden sm:inline">{company.email}</span>
          </a>
          <a
            href={phoneHref(company.primaryPhone)}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-amber-400 px-3 text-[13px] font-extrabold text-steel-900 shadow-amber hover:bg-amber-300 sm:px-4"
          >
            <span className="sm:hidden">Позвонить</span><span className="hidden sm:inline">{company.primaryPhone}</span>
          </a>
        </div>
      </div>
    </header>
  );
}
