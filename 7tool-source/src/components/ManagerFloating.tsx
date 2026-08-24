"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { manager } from "@/lib/site-config";
import { ManagerPhoto } from "./ManagerPhoto";

export function ManagerFloating() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const hasMobileProductCta = pathname.startsWith("/p/");
  if (pathname.startsWith("/lp/")) return null;
  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Закрыть" : "Связаться с менеджером"}
        className={`fixed right-3 z-50 grid h-14 w-14 place-items-center rounded-full border-2 border-amber-300 bg-white shadow-elev transition hover:-translate-y-0.5 hover:scale-105 sm:right-5 ${
          hasMobileProductCta ? "bottom-[88px] sm:bottom-5" : "bottom-5"
        }`}
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7a4612" strokeWidth="2.4">
            <path d="M6 6l12 12M18 6l-12 12" />
          </svg>
        ) : (
          <span className="relative">
            <ManagerPhoto size={48} />
            <span className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-emerald-500 ring-2 ring-white">
              <span className="h-1 w-1 rounded-full bg-white" />
            </span>
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Контакты менеджера"
          className={`fixed right-3 z-50 w-[calc(100vw-24px)] max-w-[320px] overflow-hidden rounded-[var(--radius-card)] border border-steel-200 bg-white shadow-elev sm:right-5 sm:w-[320px] ${
            hasMobileProductCta ? "bottom-[156px] sm:bottom-24" : "bottom-24"
          }`}
        >
          <div className="relative bg-gradient-to-br from-amber-100 via-amber-50 to-white p-4">
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-amber-300/40 blur-3xl" />
            <div className="relative flex items-start gap-3">
              <div className="rounded-full ring-2 ring-amber-400 shadow-amber">
                <ManagerPhoto size={56} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-amber-700">
                  Менеджер на связи
                </div>
                <div className="mt-0.5 font-display text-[16px] font-bold text-steel-900">
                  {manager.name}
                </div>
              </div>
            </div>
            <p className="relative mt-3 text-[12.5px] leading-snug text-steel-700">{manager.promise}</p>
          </div>
          <div className="grid gap-2 p-4">
            <a href={`tel:${manager.phone.replace(/\D/g, "")}`} className="inline-flex items-center justify-between rounded-md bg-amber-400 px-3.5 py-2.5 text-[13px] font-bold text-steel-900 shadow-amber transition hover:bg-amber-300">
              <span className="inline-flex items-center gap-2">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                {manager.phone}
              </span>
              <span className="text-[10.5px] uppercase tracking-wider opacity-80">позвонить</span>
            </a>
            <a href={`mailto:${manager.email}`} className="inline-flex items-center justify-between rounded-md border border-amber-300 bg-white px-3.5 py-2.5 text-[13px] font-bold text-steel-900 transition hover:border-amber-500 hover:bg-amber-50">
              <span className="inline-flex items-center gap-2 min-w-0">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-amber-600" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
                <span className="truncate">{manager.email}</span>
              </span>
              <span className="text-[10.5px] uppercase tracking-wider text-amber-700">написать</span>
            </a>
            <div className="grid grid-cols-2 gap-2">
              <a href={manager.maxUrl} target="_blank" rel="noopener" className="inline-flex items-center justify-center gap-1.5 rounded-md border border-steel-200 bg-white px-3 py-2 text-[12.5px] font-bold text-steel-700 transition hover:-translate-y-0.5 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-800">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.62 7.13L4 21l1.87-5.38A8 8 0 1 1 21 12z" /></svg>
                MAX
              </a>
              <a href={`https://t.me/${manager.telegram}`} target="_blank" rel="noopener" className="inline-flex items-center justify-center gap-1.5 rounded-md border border-steel-200 bg-white px-3 py-2 text-[12.5px] font-bold text-steel-700 transition hover:-translate-y-0.5 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-800">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" /></svg>
                Telegram
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
