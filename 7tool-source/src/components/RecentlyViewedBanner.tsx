"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { products, productById } from "@/lib/data";
import { ProductImage } from "./ProductImage";

const KEY = "7tool.last-viewed.v1";
const DISMISS_KEY = "7tool.recent-banner.dismiss";

export function RecentlyViewedBanner() {
  const [show, setShow] = useState(false);
  const [item, setItem] = useState<{ id: string; ts: number } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // 1) Записать просмотр, если мы на /p/<slug>
    const path = window.location.pathname;
    if (path.startsWith("/p/")) {
      const slug = path.slice(3);
      const p = products.find((pp) => pp.slug === slug);
      if (p) {
        const entry = { id: p.id, ts: Date.now() };
        try { localStorage.setItem(KEY, JSON.stringify(entry)); } catch {}
        return; // на самой странице товара баннер не показываем
      }
    }
    // 2) На остальных — показать, если есть «просмотренный» и dismiss не свежий
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const entry = JSON.parse(raw) as { id: string; ts: number };
      if (Date.now() - entry.ts > 1000 * 60 * 60 * 24) return; // старше 24ч
      const dismissed = Number(localStorage.getItem(DISMISS_KEY) || 0);
      if (Date.now() - dismissed < 1000 * 60 * 30) return; // прячем на 30 мин после закрытия
      setItem(entry);
      const t = window.setTimeout(() => setShow(true), 7000);
      return () => window.clearTimeout(t);
    } catch {}
  }, []);

  if (!show || !item) return null;
  const ref = productById(item.id);
  if (!ref) return null;

  const close = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
    setShow(false);
  };

  return (
    <div className="fixed bottom-24 left-5 z-40 w-[300px] animate-[slideUp_.35s_cubic-bezier(.2,.8,.2,1)] sm:bottom-5 sm:left-auto sm:right-24">
      <div className="overflow-hidden rounded-[14px] border border-amber-300 bg-white shadow-elev">
        <div className="bg-gradient-to-r from-amber-400 to-amber-500 px-3 py-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.16em] text-steel-900">
          Вы смотрели · бронь 24 ч
        </div>
        <div className="flex items-center gap-3 p-3">
          <Link href={`/p/${ref.slug}`} className="overflow-hidden rounded-md border border-steel-200">
            <ProductImage p={ref} className="h-14 w-14" sizes="56px" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-amber-700">
              {ref.brand}
            </div>
            <Link href={`/p/${ref.slug}`} className="mt-0.5 line-clamp-2 block text-[12.5px] font-semibold text-steel-900 hover:text-amber-700">
              {ref.title}
            </Link>
          </div>
          <button
            onClick={close}
            aria-label="Закрыть"
            className="grid h-7 w-7 place-items-center rounded-full text-steel-400 transition hover:bg-steel-50 hover:text-steel-700"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M6 6l12 12M18 6l-12 12"/></svg>
          </button>
        </div>
        <Link
          href={`/p/${ref.slug}`}
          className="block bg-amber-50 px-3 py-2 text-center text-[12px] font-bold text-amber-800 hover:bg-amber-100"
        >
          Вернуться к товару →
        </Link>
      </div>
    </div>
  );
}
