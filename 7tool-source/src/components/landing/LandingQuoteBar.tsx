"use client";

import { useEffect, useState } from "react";
import { LANDING_SELECTION_EVENT, readLandingSelection, type LandingSelectedProduct } from "@/lib/landing-selection";

export function LandingQuoteBar({ category, intent }: { category: string; intent: string }) {
  const [products, setProducts] = useState<LandingSelectedProduct[]>([]);
  useEffect(() => {
    const refresh = () => setProducts(readLandingSelection(category, intent));
    refresh();
    window.addEventListener(LANDING_SELECTION_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => { window.removeEventListener(LANDING_SELECTION_EVENT, refresh); window.removeEventListener("storage", refresh); };
  }, [category, intent]);
  if (products.length === 0) return null;
  return (
    <aside className="fixed inset-x-0 bottom-0 z-50 border-t border-amber-300 bg-steel-900 p-2 text-white shadow-elev sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[360px] sm:rounded-xl sm:border sm:p-3" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <div><div className="hidden text-[11px] font-bold uppercase tracking-[0.12em] text-amber-300 sm:block">Запрос КП</div><div className="text-[13px] font-extrabold sm:mt-0.5"><span className="sm:hidden">Выбрано: </span><span className="hidden sm:inline">Выбрано моделей: </span>{products.length}</div></div>
        <a href="#request-lower" className="inline-flex min-h-10 items-center rounded-lg bg-amber-400 px-4 text-[12px] font-extrabold text-steel-900 hover:bg-amber-300">Продолжить</a>
      </div>
      <p className="mt-2 hidden line-clamp-1 text-[11px] text-steel-300 sm:block">{products.map((product) => product.title).join(" · ")}</p>
    </aside>
  );
}
