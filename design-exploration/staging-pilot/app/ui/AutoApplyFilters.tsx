"use client";

import type { FormEvent, ReactNode } from "react";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type SharedFormProps = {
  action: string;
  children: ReactNode;
};

export function AutoApplyFilterPanel({
  action,
  activeFilterCount,
  children,
  resultCount,
  resetHref,
  slug,
}: SharedFormProps & {
  activeFilterCount: number;
  resultCount: number;
  resetHref: string;
  slug: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const [isPending, startTransition] = useTransition();
  const [mobileOpen, setMobileOpen] = useState(false);
  const toggleId = `feed-filters-${slug}`;

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  function applyFilters() {
    const form = formRef.current;
    if (!form) return;
    const params = serializeForm(form);
    const hash = window.matchMedia("(max-width: 1180px)").matches ? "#feed-filter-panel" : "#products";
    const href = `${action}${params.size > 0 ? `?${params.toString()}` : ""}${hash}`;
    startTransition(() => router.replace(href, { scroll:false }));
  }

  function queueApply(event: FormEvent<HTMLFormElement>) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
    window.clearTimeout(timerRef.current);
    const needsTypingPause = target instanceof HTMLInputElement && ["number", "search", "text"].includes(target.type);
    timerRef.current = window.setTimeout(applyFilters, needsTypingPause ? 520 : 120);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    window.clearTimeout(timerRef.current);
    applyFilters();
  }

  function showResults() {
    setMobileOpen(false);
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#products`);
    window.requestAnimationFrame(() => document.getElementById("feed-results-list")?.scrollIntoView({ behavior:"smooth", block:"start" }));
  }

  return <aside className="feed-filter-panel" id="feed-filter-panel" aria-busy={isPending}>
    <input className="feed-filter-toggle" type="checkbox" id={toggleId} checked={mobileOpen} onChange={(event) => setMobileOpen(event.currentTarget.checked)} aria-label="Показать или скрыть фильтры" />
    <label className="feed-filter-summary" htmlFor={toggleId}><span><b>Фильтры</b><small>{activeFilterCount > 0 ? `Выбрано: ${activeFilterCount}` : "По характеристикам товаров"}</small></span><i aria-hidden="true">+</i></label>
    <form ref={formRef} method="get" action={`${action}#products`} onChange={queueApply} onSubmit={submit}>
      {children}
      <div className="feed-filter-actions feed-filter-actions--auto">
        <span className="feed-filter-live-status" aria-live="polite">{isPending ? "Обновляем подбор…" : "Изменения применяются автоматически"}</span>
        <button className="button feed-filter-mobile-results" type="button" onClick={showResults}>{resultCount > 0 ? `К товарам · ${resultCount.toLocaleString("ru-RU")}` : "Посмотреть следующий шаг"}</button>
        <a href={resetHref}>Очистить фильтры</a>
      </div>
    </form>
  </aside>;
}

export function AutoApplySortForm({ action, children }: SharedFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = formRef.current;
    if (!form) return;
    const params = serializeForm(form);
    const href = `${action}${params.size > 0 ? `?${params.toString()}` : ""}#products`;
    startTransition(() => router.replace(href, { scroll:false }));
  }

  return <form ref={formRef} method="get" action={`${action}#products`} onChange={apply} onSubmit={apply} aria-busy={isPending}>
    {children}
    <span className="feed-sort-live-status" aria-live="polite">{isPending ? "Обновляем…" : "Сразу"}</span>
  </form>;
}

function serializeForm(form: HTMLFormElement): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of new FormData(form).entries()) {
    if (typeof value !== "string" || !value.trim() || key === "page") continue;
    params.append(key, value.trim());
  }
  return params;
}
