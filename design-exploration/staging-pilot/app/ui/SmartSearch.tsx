"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CatalogSearchHit, CatalogSearchResponse } from "../data/catalogSearchTypes";

const examples = ["STEYR-35", "снять фаску с трубы", "автоматизировать сварку"];

export function SmartSearch({ placement }: { placement: "header" | "hero" }) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState<CatalogSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const normalized = query.trim();
  const items = useMemo(() => response ? [...response.products, ...response.categories, ...response.tasks] : [], [response]);
  const hasResults = items.length > 0;
  const panelId = `${placement}-catalog-search-results`;

  useEffect(() => {
    if (normalized.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setOpen(true);
      try {
        const result = await fetch(`/api/catalog-search?q=${encodeURIComponent(normalized)}`, { signal:controller.signal });
        if (!result.ok) throw new Error("search unavailable");
        setResponse(await result.json() as CatalogSearchResponse);
        setActiveIndex(-1);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setResponse({ query:normalized, interpretation:"поиск по каталогу", products:[], categories:[], tasks:[] });
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [normalized]);

  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!normalized) return;
    trackSearch("search_submit", { placement, query_length:normalized.length, result_count:items.length, query_type:response?.interpretation ?? "unknown" });
    if (activeIndex >= 0 && items[activeIndex]) router.push(items[activeIndex].href);
    else router.push(`/search?q=${encodeURIComponent(normalized)}`);
    setOpen(false);
  }

  function handleKeyboard(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (!open || items.length === 0 || !["ArrowDown", "ArrowUp"].includes(event.key)) return;
    event.preventDefault();
    const direction = event.key === "ArrowDown" ? 1 : -1;
    setActiveIndex((current) => current < 0 ? (direction > 0 ? 0 : items.length - 1) : (current + direction + items.length) % items.length);
  }

  function applyExample(value: string) {
    setQuery(value);
    setOpen(true);
    inputRef.current?.focus();
  }

  const rootClass = placement === "hero" ? "hero-search-wrap smart-search smart-search--hero" : "header-search-wrap smart-search smart-search--header";
  const formClass = placement === "hero" ? "hero-search" : "header-search-form";
  const panelClass = placement === "hero" ? "search-panel smart-search-panel" : "header-search-panel smart-search-panel";

  return <div className={rootClass} id={placement === "hero" ? "search" : undefined} ref={rootRef}>
    <form className={formClass} onSubmit={submit} role="search">
      <span aria-hidden="true">⌕</span>
      <input
        ref={inputRef}
        value={query}
        onChange={(event) => {
          const value = event.target.value;
          setQuery(value);
          if (value.trim().length < 2) {
            setResponse(null);
            setLoading(false);
            setOpen(false);
          }
        }}
        onFocus={() => normalized.length >= 2 && setOpen(true)}
        onKeyDown={handleKeyboard}
        aria-label="Поиск по каталогу"
        aria-autocomplete="list"
        aria-controls={panelId}
        aria-expanded={open && normalized.length >= 2}
        aria-activedescendant={activeIndex >= 0 ? `${panelId}-option-${activeIndex}` : undefined}
        role="combobox"
        autoComplete="off"
        placeholder={placement === "hero" ? "Например, магнитный станок Ø35 или снять фаску" : "Модель, товар или задача"}
      />
      <button type="submit">Найти</button>
    </form>

    {placement === "hero" && <div className="search-examples"><span>Попробуйте:</span>{examples.map((item) => <button key={item} type="button" onClick={() => applyExample(item)}>{item}</button>)}</div>}

    {open && normalized.length >= 2 && <div className={panelClass} id={panelId} role="listbox" aria-label="Подсказки поиска">
      <div className="smart-search-status" aria-live="polite"><span>{loading ? "Ищем в каталоге…" : "Запрос распознан как"}</span>{!loading && <b>{response?.interpretation ?? "товар, категория или задача"}</b>}</div>
      {!loading && response && hasResults && <>
        <SearchGroup title="Товары" items={response.products} allItems={items} activeIndex={activeIndex} panelId={panelId} onChoose={(item, index) => { trackSearch("search_select", { placement, result_type:item.kind, result_position:index + 1 }); setOpen(false); }} />
        <SearchGroup title="Категории" items={response.categories} allItems={items} activeIndex={activeIndex} panelId={panelId} onChoose={(item, index) => { trackSearch("search_select", { placement, result_type:item.kind, result_position:index + 1 }); setOpen(false); }} />
        <SearchGroup title="По производственной задаче" items={response.tasks} allItems={items} activeIndex={activeIndex} panelId={panelId} onChoose={(item, index) => { trackSearch("search_select", { placement, result_type:item.kind, result_position:index + 1 }); setOpen(false); }} />
      </>}
      {!loading && response && !hasResults && <div className="smart-search-empty"><b>Точного совпадения в каталоге нет</b><p>Это не означает, что задача нерешаема. Проверьте похожие позиции или передайте исходный запрос инженеру.</p><div><Link href={`/search?q=${encodeURIComponent(normalized)}`} onClick={() => { trackSearch("search_zero_action", { placement, action:"similar" }); setOpen(false); }}>Проверить похожее</Link><Link href={`/?task=${encodeURIComponent(normalized)}#quick-order`} onClick={() => { trackSearch("search_zero_action", { placement, action:"guided_selection" }); setOpen(false); }}>Подобрать по задаче</Link></div></div>}
      {!loading && response && hasResults && <div className="smart-search-footer"><Link href={`/search?q=${encodeURIComponent(normalized)}`} onClick={() => { trackSearch("search_all_results", { placement, result_count:items.length }); setOpen(false); }}>Все результаты по запросу →</Link><Link href={`/?task=${encodeURIComponent(normalized)}#quick-order`} onClick={() => { trackSearch("search_guided_selection", { placement }); setOpen(false); }}>Не уверены? Передать задачу</Link></div>}
    </div>}
  </div>;
}

function SearchGroup({ title, items, allItems, activeIndex, panelId, onChoose }: { title: string; items: CatalogSearchHit[]; allItems: CatalogSearchHit[]; activeIndex: number; panelId: string; onChoose: (item: CatalogSearchHit, index: number) => void }) {
  if (items.length === 0) return null;
  return <section className="smart-search-group" aria-label={title}><h3>{title}</h3>{items.map((item) => {
    const index = allItems.findIndex((candidate) => candidate.id === item.id);
    return <Link className={`smart-search-option ${index === activeIndex ? "active" : ""}`} id={`${panelId}-option-${index}`} role="option" aria-selected={index === activeIndex} href={item.href} onClick={() => onChoose(item, index)} key={item.id}>
      {item.image ? <Image src={item.image} alt="" width={56} height={56} unoptimized /> : <span className="smart-search-fallback" aria-hidden="true">7T</span>}
      <span><small>{item.eyebrow}</small><b>{item.title}</b><em>{item.meta}{item.specs?.length ? ` · ${item.specs.slice(0, 2).join(" · ")}` : ""}</em></span>
      <span className="smart-search-commercial">{item.price && <b>{item.price}</b>}{item.availability && <small>{item.availability}</small>}</span>
    </Link>;
  })}</section>;
}

function trackSearch(event: string, detail: Record<string, string | number>) {
  window.dispatchEvent(new CustomEvent("7tool:prototype-event", { detail:{ event, page_type:"search", ...detail } }));
}
