"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { manager } from "@/lib/site-config";
import { ManagerPhoto } from "./ManagerPhoto";
import { trackEvent } from "@/lib/analytics";

export type CatalogSearchItem = { id: string; slug: string; title: string; brand: string; sku: string; variantSkus: string[] };
export type CatalogCategoryItem = { slug: string; title: string; count: number };

export function CatalogMenu({
  categories,
}: {
  categories: CatalogCategoryItem[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [matches, setMatches] = useState<CatalogSearchItem[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia("(max-width: 639px)");
    const upd = () => setIsMobile(mq.matches);
    upd();
    mq.addEventListener("change", upd);
    return () => mq.removeEventListener("change", upd);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current) return;
      // На мобайле попап вынесен через portal — клик «вне» проверяем по обоим контейнерам.
      const t = e.target as Node;
      const insideTrigger = ref.current.contains(t);
      const insidePopup = popupRef.current?.contains(t) ?? false;
      if (!insideTrigger && !insidePopup) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  useEffect(() => {
    if (!open || !isMobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open, isMobile]);

  const query = q.trim();
  useEffect(() => {
    const controller = new AbortController();
    if (query.length < 2) {
      setMatches([]);
      setSearching(false);
      return () => controller.abort();
    }
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`Search HTTP ${response.status}`);
        const data = await response.json() as { items?: CatalogSearchItem[] };
        setMatches(data.items ?? []);
      } catch {
        if (!controller.signal.aborted) setMatches([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 100);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  async function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    setOpen(true);
    if (query.length < 2) return;
    setSearching(true);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error(`Search HTTP ${response.status}`);
      const data = await response.json() as { items?: CatalogSearchItem[] };
      const items = data.items ?? [];
      setMatches(items);
      trackEvent("search", { page_type: "search", placement: items.length ? "results" : "empty" });
      if (items[0]) {
        setOpen(false);
        router.push(`/p/${items[0].slug}`);
      }
    } catch {
      setMatches([]);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div ref={ref} className="relative flex flex-1 items-center gap-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-md px-2.5 py-2.5 text-[13px] font-bold uppercase tracking-wider transition sm:min-h-0 sm:min-w-0 sm:px-3.5 ${
          open
            ? "bg-steel-900 text-amber-400 shadow-elev"
            : "bg-amber-400 text-steel-900 shadow-amber hover:-translate-y-0.5 hover:bg-amber-300"
        }`}
        aria-expanded={open}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
          {open ? <path d="M6 6l12 12M18 6l-12 12" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
        </svg>
        <span className="hidden sm:inline">Каталог</span>
      </button>

      <form className="relative hidden flex-1 sm:block" onSubmit={submitSearch}>
        <input
          type="search"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Артикул, название, бренд — например, Karnasch 20.1125"
          className="w-full rounded-lg border border-steel-200 bg-white py-2.5 pl-10 pr-24 text-[14px] text-steel-900 placeholder:text-steel-400 transition focus:border-amber-400 focus:outline-none"
        />
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-steel-400" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
        <button type="submit" className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md bg-steel-900 px-3 py-1.5 text-[13px] font-bold text-amber-300 transition hover:bg-steel-700">
          Найти
        </button>
      </form>

      {/* mobile-only: иконка-поиск, открывает popover с input внутри */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Поиск"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-steel-200 bg-white text-steel-700 shadow-soft transition hover:-translate-y-0.5 hover:border-amber-400 hover:text-amber-700 sm:hidden"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
      </button>

      {open && mounted && isMobile && createPortal(
        <>
          <div className="fixed inset-0 z-[60] bg-steel-900/40" onClick={() => setOpen(false)} />
          <div ref={popupRef} className="fixed inset-0 z-[70] flex flex-col overflow-y-auto bg-white">
          {/* Шапка — только мобайл */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-steel-200 bg-white px-4 py-3">
            <div className="font-display text-[16px] font-extrabold text-steel-900">Каталог</div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Закрыть"
              className="grid h-11 w-11 place-items-center rounded-md border border-steel-200 bg-white text-steel-700"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M6 6l12 12M18 6l-12 12" /></svg>
            </button>
          </div>
          <div className="p-4">
            {/* mobile-only search */}
            <form
              className="relative mb-4"
              onSubmit={submitSearch}
            >
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Артикул, название, бренд"
                autoFocus
                className="w-full rounded-md border border-steel-200 bg-white px-3 py-2.5 text-[14px] text-steel-900 placeholder:text-steel-400 focus:border-amber-400 focus:outline-none"
              />
            </form>
            {searching ? (
              <div className="px-3 py-6 text-center text-[13px] text-steel-500" aria-live="polite">Ищем…</div>
            ) : query && matches.length > 0 ? (
              <>
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-steel-500">
                  Найдено {matches.length}
                </div>
                <ul className="mt-3 space-y-1">
                  {matches.map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/p/${p.slug}`}
                        onClick={() => setOpen(false)}
                        className="flex items-center justify-between gap-3 rounded-md px-3 py-2 text-[13.5px] text-steel-800 transition hover:bg-amber-50"
                      >
                        <span className="min-w-0 flex-1 truncate">
                          <span className="font-bold text-amber-700">{p.brand}</span> · {p.title}
                        </span>
                        <span className="shrink-0 text-[12px] text-steel-500">{p.sku}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : query ? (
              <div className="rounded-md border border-dashed border-steel-200 bg-steel-50/60 px-4 py-6 text-center text-[13.5px] text-steel-600">
                По запросу «{q}» ничего не нашлось — спросите менеджера, подберёт аналог.
              </div>
            ) : (
              <>
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-700">
                  Категории
                </div>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {categories.map((c) => (
                    <li key={c.slug}>
                      <Link
                        href={`/c/${c.slug}`}
                        onClick={() => setOpen(false)}
                        className="group flex items-center justify-between gap-3 rounded-md border border-steel-200 px-3.5 py-3 transition hover:-translate-y-0.5 hover:border-amber-300 hover:bg-amber-50"
                      >
                        <span>
                          <div className="font-display text-[15px] font-bold text-steel-900 group-hover:text-amber-800">
                            {c.title}
                          </div>
                          <div className="mt-0.5 text-[11.5px] text-steel-500">
                            {c.count.toLocaleString("ru-RU")} позиций
                          </div>
                        </span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="text-steel-400 transition group-hover:translate-x-0.5 group-hover:text-amber-600">
                          <path d="M5 12h14M13 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <aside className="border-t border-steel-200 bg-gradient-to-br from-amber-50 via-white to-amber-50/40 p-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-700">
              Менеджер на связи
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="rounded-full ring-2 ring-amber-300 shadow-amber">
                <ManagerPhoto size={56} />
              </div>
              <div>
                <div className="font-display text-[15px] font-bold text-steel-900">{manager.name}</div>
                <div className="mt-0.5 inline-flex items-center gap-1 text-[11.5px] font-semibold text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.18)]" /> онлайн
                </div>
              </div>
            </div>
            <a
              href={`tel:${manager.phone.replace(/\D/g, "")}`}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-amber-400 px-3 py-2.5 text-[13px] font-bold text-steel-900 shadow-amber transition hover:-translate-y-0.5 hover:bg-amber-300"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
              {manager.phone}
            </a>
            <a
              href={`mailto:${manager.email}`}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md border border-amber-300 bg-white px-3 py-2 text-[12.5px] font-bold text-steel-900 transition hover:-translate-y-0.5 hover:border-amber-500 hover:bg-amber-50"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-600" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
              {manager.email}
            </a>
            <p className="mt-2 text-[11.5px] leading-snug text-steel-600">
              {manager.promise}
            </p>
          </aside>
        </div>
        </>,
        document.body,
      )}

      {/* Desktop popover — старый inline вариант */}
      {open && !isMobile && (
        <div ref={popupRef} className="absolute inset-x-0 top-[calc(100%+10px)] z-40 max-h-[80vh] overflow-y-auto rounded-[16px] border border-steel-200 bg-white shadow-elev sm:grid sm:grid-cols-1 md:grid-cols-[1fr_280px]">
          <div className="p-5">
            {searching ? (
              <div className="px-3 py-6 text-center text-[13px] text-steel-500" aria-live="polite">Ищем…</div>
            ) : query && matches.length > 0 ? (
              <>
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-steel-500">Найдено {matches.length}</div>
                <ul className="mt-3 space-y-1">
                  {matches.map((p) => (
                    <li key={p.id}>
                      <Link href={`/p/${p.slug}`} onClick={() => setOpen(false)} className="flex items-center justify-between gap-3 rounded-md px-3 py-2 text-[13.5px] text-steel-800 transition hover:bg-amber-50">
                        <span className="min-w-0 flex-1 truncate">
                          <span className="font-bold text-amber-700">{p.brand}</span> · {p.title}
                        </span>
                        <span className="shrink-0 text-[12px] text-steel-500">{p.sku}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : query ? (
              <div className="rounded-md border border-dashed border-steel-200 bg-steel-50/60 px-4 py-6 text-center text-[13.5px] text-steel-600">
                По запросу «{q}» ничего не нашлось — спросите менеджера, подберёт аналог.
              </div>
            ) : (
              <>
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-700">Категории</div>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {categories.map((c) => (
                    <li key={c.slug}>
                      <Link href={`/c/${c.slug}`} onClick={() => setOpen(false)} className="group flex items-center justify-between gap-3 rounded-md border border-steel-200 px-3.5 py-3 transition hover:-translate-y-0.5 hover:border-amber-300 hover:bg-amber-50">
                        <span>
                          <div className="font-display text-[15px] font-bold text-steel-900 group-hover:text-amber-800">{c.title}</div>
                          <div className="mt-0.5 text-[11.5px] text-steel-500">{c.count.toLocaleString("ru-RU")} позиций</div>
                        </span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="text-steel-400 transition group-hover:translate-x-0.5 group-hover:text-amber-600"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
          <aside className="border-t border-steel-200 bg-gradient-to-br from-amber-50 via-white to-amber-50/40 p-5 md:border-l md:border-t-0">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-700">Менеджер на связи</div>
            <div className="mt-3 flex items-center gap-3">
              <div className="rounded-full ring-2 ring-amber-300 shadow-amber"><ManagerPhoto size={56} /></div>
              <div>
                <div className="font-display text-[15px] font-bold text-steel-900">{manager.name}</div>
                <div className="mt-0.5 inline-flex items-center gap-1 text-[11.5px] font-semibold text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.18)]" /> онлайн
                </div>
              </div>
            </div>
            <a href={`tel:${manager.phone.replace(/\D/g, "")}`} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-amber-400 px-3 py-2.5 text-[13px] font-bold text-steel-900 shadow-amber transition hover:-translate-y-0.5 hover:bg-amber-300">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
              {manager.phone}
            </a>
            <a href={`mailto:${manager.email}`} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md border border-amber-300 bg-white px-3 py-2 text-[12.5px] font-bold text-steel-900 transition hover:border-amber-500 hover:bg-amber-50">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-600"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
              {manager.email}
            </a>
            <p className="mt-2 text-[11.5px] leading-snug text-steel-600">{manager.promise}</p>
          </aside>
        </div>
      )}
    </div>
  );
}
