"use client";

import { KeyboardEvent as ReactKeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { FeedShippingPromise } from "../data/feedCatalog";
import { AddRequestButton } from "./RequestCart";

const FOCUSABLE_SELECTOR = "a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex='-1'])";
const VARIANT_PAGE_SIZE = 24;
const SEARCH_DEBOUNCE_MS = 180;

export type VariantPickerItem = {
  id: string;
  sku: string;
  title: string;
  label: string;
  context?: string;
  price: string;
  image?: string;
  href: string;
  shippingPromise: FeedShippingPromise;
};

type VariantPickerPage = {
  items: VariantPickerItem[];
  totalVariantCount: number;
  availableVariantCount: number;
  matchedVariantCount: number;
  offset: number;
  nextOffset: number | null;
};

const variantRequestCache = new Map<string, Promise<VariantPickerPage>>();

export function preloadVariantPickerItems(endpoint: string): void {
  void loadVariantPickerPage(endpoint, { offset:0 }).catch(() => undefined);
}

type Props = {
  open: boolean;
  onClose: () => void;
  productId: string;
  productTitle: string;
  category: string;
  pageType: "category" | "product";
  placement: string;
  items: VariantPickerItem[];
  initialVariantId?: string;
  totalVariantCount?: number;
  initialAvailableVariantCount?: number;
  initialNextOffset?: number | null;
  fullProductHref?: string;
  variantsEndpoint?: string;
  selectorLabel?: "Размер" | "Исполнение";
};

export function VariantPickerDialog(props: Props) {
  if (!props.open) return null;
  return <OpenVariantPickerDialog {...props} />;
}

function OpenVariantPickerDialog({ onClose, productId, productTitle, category, pageType, placement, items, initialVariantId, totalVariantCount = items.length, initialAvailableVariantCount, initialNextOffset, fullProductHref, variantsEndpoint, selectorLabel = "Размер" }: Props) {
  const requiresRemoteMatrix = Boolean(variantsEndpoint && items.length < totalVariantCount);
  const needsInitialPage = requiresRemoteMatrix && initialNextOffset === undefined;
  const [query, setQuery] = useState("");
  const [stockOnly, setStockOnly] = useState(false);
  const [activeId, setActiveId] = useState(initialVariantId ?? items[0]?.id ?? "");
  const [availableItems, setAvailableItems] = useState(items);
  const [nextOffset, setNextOffset] = useState<number | null>(requiresRemoteMatrix ? (initialNextOffset === undefined ? 0 : initialNextOffset) : null);
  const [remoteItems, setRemoteItems] = useState<VariantPickerItem[] | null>(null);
  const [remoteNextOffset, setRemoteNextOffset] = useState<number | null>(null);
  const [matchedVariantCount, setMatchedVariantCount] = useState(totalVariantCount);
  const [availableVariantCount, setAvailableVariantCount] = useState(initialAvailableVariantCount ?? items.filter((item) => item.shippingPromise.available).length);
  const [initialPageLoading, setInitialPageLoading] = useState(needsInitialPage);
  const [filterLoading, setFilterLoading] = useState(false);
  const [moreLoading, setMoreLoading] = useState(false);
  const [variantsError, setVariantsError] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const normalizedQuery = normalizeSearch(query);
  const remoteFilterActive = requiresRemoteMatrix && Boolean(normalizedQuery || stockOnly);
  const selectableItems = useMemo(() => mergeVariantItems(remoteItems ?? [], availableItems), [availableItems, remoteItems]);
  const selected = selectableItems.find((item) => item.id === activeId) ?? selectableItems[0];
  const filteredItems = useMemo(() => {
    if (remoteFilterActive) return remoteItems ?? [];
    return availableItems.filter((item) => (!stockOnly || item.shippingPromise.available) && (!normalizedQuery || normalizeSearch([item.label, item.context, item.sku].filter(Boolean).join(" ")).includes(normalizedQuery)));
  }, [availableItems, normalizedQuery, remoteFilterActive, remoteItems, stockOnly]);
  const variantsLoading = initialPageLoading || filterLoading;
  const activeNextOffset = remoteFilterActive ? remoteNextOffset : nextOffset;

  function clearRemoteFilterState() {
    setRemoteItems(null);
    setRemoteNextOffset(null);
    setMatchedVariantCount(totalVariantCount);
    setFilterLoading(false);
  }

  useEffect(() => {
    if (!variantsEndpoint || !needsInitialPage) return;
    const controller = new AbortController();
    void loadVariantPickerPage(variantsEndpoint, { offset:0 }, controller.signal)
      .then((page) => {
        setAvailableItems((current) => mergeVariantItems(page.items, current));
        setNextOffset(page.nextOffset);
        setAvailableVariantCount(page.availableVariantCount);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setVariantsError("Не удалось догрузить следующие исполнения. Первые варианты уже доступны для выбора.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setInitialPageLoading(false);
      });
    return () => controller.abort();
  }, [needsInitialPage, variantsEndpoint]);

  useEffect(() => {
    if (!variantsEndpoint || !remoteFilterActive) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setFilterLoading(true);
      setVariantsError("");
      void loadVariantPickerPage(variantsEndpoint, { offset:0, query, availableOnly:stockOnly }, controller.signal)
        .then((page) => {
          setRemoteItems(page.items);
          setRemoteNextOffset(page.nextOffset);
          setMatchedVariantCount(page.matchedVariantCount);
          setAvailableVariantCount(page.availableVariantCount);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setVariantsError("Поиск по полной матрице временно недоступен. Можно открыть карточку товара или передать артикул менеджеру.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setFilterLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query, remoteFilterActive, stockOnly, totalVariantCount, variantsEndpoint]);

  useEffect(() => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => closeRef.current?.focus());
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    window.dispatchEvent(new CustomEvent("7tool:prototype-event", { detail:{ event:"variant_picker_open", placement, page_type:pageType, product_id:productId, variant_id:initialVariantId ?? items[0]?.id, category } }));
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
      returnFocusRef.current?.focus();
    };
  }, [category, initialVariantId, items, onClose, pageType, placement, productId]);

  function track(event: string, variantId = selected?.id) {
    window.dispatchEvent(new CustomEvent("7tool:prototype-event", { detail:{ event, placement, page_type:pageType, product_id:productId, variant_id:variantId, category } }));
  }

  async function loadMoreVariants() {
    if (!variantsEndpoint || activeNextOffset == null || moreLoading) return;
    setMoreLoading(true);
    setVariantsError("");
    try {
      const page = await loadVariantPickerPage(variantsEndpoint, { offset:activeNextOffset, query:remoteFilterActive ? query : "", availableOnly:remoteFilterActive && stockOnly });
      if (remoteFilterActive) {
        setRemoteItems((current) => mergeVariantItems(current ?? [], page.items));
        setRemoteNextOffset(page.nextOffset);
        setMatchedVariantCount(page.matchedVariantCount);
      } else {
        setAvailableItems((current) => mergeVariantItems(current, page.items));
        setNextOffset(page.nextOffset);
      }
      setAvailableVariantCount(page.availableVariantCount);
      track("variant_picker_load_more");
    } catch {
      setVariantsError("Не удалось загрузить следующую порцию. Уже показанные исполнения остаются доступными.");
    } finally {
      setMoreLoading(false);
    }
  }

  function trapFocus(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []).filter((element) => element.offsetParent !== null);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  if (typeof document === "undefined") return null;

  const dialog = <div className="variant-picker-layer" role="dialog" aria-modal="true" aria-labelledby={`variant-picker-title-${productId}`} aria-describedby={`variant-picker-description-${productId}`} onKeyDown={trapFocus}>
    <button className="variant-picker-backdrop" type="button" onClick={onClose} aria-label={`Закрыть выбор: ${selectorLabel.toLocaleLowerCase("ru-RU")}`} />
    <div className={`variant-picker-dialog variant-picker-dialog--${selectorLabel === "Размер" ? "sizes" : "executions"}`} ref={dialogRef}>
      <header>
        <div><span>{productTitle}</span><h2 id={`variant-picker-title-${productId}`}>Выберите {selectorLabel.toLocaleLowerCase("ru-RU")}</h2><p id={`variant-picker-description-${productId}`}>{totalVariantCount} {variantWord(totalVariantCount, selectorLabel)} · {availableVariantCount} с подтверждённым остатком{initialPageLoading ? " · уточняем список" : ""}</p></div>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Закрыть">×</button>
      </header>
      <div className="variant-picker-tools">
        <label><span>Найти по размеру или артикулу</span><input type="search" inputMode="search" value={query} onChange={(event) => { clearRemoteFilterState(); setQuery(event.target.value); }} placeholder="Например: 35 × 30" autoFocus /></label>
        <div role="group" aria-label="Фильтр наличия"><button className={!stockOnly ? "active" : undefined} type="button" aria-pressed={!stockOnly} onClick={() => { clearRemoteFilterState(); setStockOnly(false); }}>Все · {totalVariantCount}</button><button className={stockOnly ? "active" : undefined} type="button" aria-pressed={stockOnly} onClick={() => { clearRemoteFilterState(); setStockOnly(true); track("variant_picker_stock_filter"); }}>В наличии · {availableVariantCount}</button></div>
      </div>
      <div className="variant-picker-legend" aria-label="Обозначения"><span><i className="is-available" />В наличии</span><span><i />Наличие и срок уточним</span></div>
      <div className="variant-picker-results" aria-live="polite">
        {filteredItems.length > 0 ? <div className="variant-picker-grid" aria-label="Матрица размеров и наличия">{filteredItems.map((item) => {
          const active = item.id === selected?.id;
          return <button className={[active ? "active" : "", item.shippingPromise.available ? "is-available" : "is-unconfirmed"].filter(Boolean).join(" ")} type="button" aria-pressed={active} onClick={() => { setActiveId(item.id); track("variant_picker_select", item.id); }} key={item.id}><b>{item.label}</b>{item.context && <em>{item.context}</em>}<small>{item.price}</small><span><i aria-hidden="true" />{item.shippingPromise.available ? "В наличии" : "Уточним"}</span></button>;
        })}</div> : !filterLoading ? <div className="variant-picker-empty"><b>Совпадений нет</b><span>Измените размер или покажите все исполнения.</span><button type="button" onClick={() => { clearRemoteFilterState(); setQuery(""); setStockOnly(false); }}>Сбросить фильтр</button></div> : null}
        {initialPageLoading && <div className="variant-picker-loading variant-picker-loading--inline" role="status"><b>Первые варианты уже доступны</b><span>Подгружаем следующую порцию, не блокируя выбор.</span></div>}
        {filterLoading && <div className="variant-picker-loading variant-picker-loading--inline" role="status"><b>Ищем по всем {totalVariantCount} исполнениям</b><span>Поиск охватывает полную матрицу, включая ещё не показанные позиции.</span></div>}
        {activeNextOffset != null && !variantsLoading && <button className="variant-picker-more" type="button" onClick={() => void loadMoreVariants()} disabled={moreLoading}>{moreLoading ? "Загружаем…" : `Показать ещё ${Math.min(VARIANT_PAGE_SIZE, Math.max(0, matchedVariantCount - activeNextOffset))}`}</button>}
        {!variantsLoading && filteredItems.length > 0 && <p className="variant-picker-progress">Показано {filteredItems.length} из {matchedVariantCount}</p>}
        {variantsError && <div className="variant-picker-load-error" role="status"><span>{variantsError}</span>{fullProductHref && <a href={fullProductHref}>Открыть карточку товара →</a>}</div>}
      </div>
      {selected && <footer>
        <div className="variant-picker-selection"><span>Выбрано</span><b>{selected.label}</b><small>{selected.sku ? `Артикул ${selected.sku}` : "Артикул не указан"}</small></div>
        <div className="variant-picker-commercial"><div><b>{selected.price}</b><span className={selected.shippingPromise.available ? "is-available" : undefined}>{selected.shippingPromise.label}</span></div><a href={selected.href} onClick={() => track("variant_picker_open_product", selected.id)}>Открыть карточку</a><AddRequestButton className="feed-quote-secondary" item={{ id:`variant:${selected.id}`, title:selected.title || productTitle, article:selected.sku ? `Артикул ${selected.sku}` : "Артикул не указан в фиде", price:selected.price, image:selected.image, href:selected.href, shippingLabel:selected.shippingPromise.label, shippingDetail:selected.shippingPromise.detail }}>В запрос</AddRequestButton><AddRequestButton className="feed-quote-primary" openAfterAdd item={{ id:`variant:${selected.id}`, title:selected.title || productTitle, article:selected.sku ? `Артикул ${selected.sku}` : "Артикул не указан в фиде", price:selected.price, image:selected.image, href:selected.href, shippingLabel:selected.shippingPromise.label, shippingDetail:selected.shippingPromise.detail }}>Получить КП</AddRequestButton></div>
      </footer>}
    </div>
  </div>;

  return createPortal(dialog, document.body);
}

function normalizeSearch(value: string): string {
  return value.toLocaleLowerCase("ru-RU").replace(/ё/gu, "е").replace(/[×хx*]/gu, "x").replace(/[^a-zа-я0-9]+/giu, " ").trim();
}

function variantWord(count: number, selectorLabel: "Размер" | "Исполнение"): string {
  const forms = selectorLabel === "Размер" ? ["размер", "размера", "размеров"] : ["исполнение", "исполнения", "исполнений"];
  const mod100 = count % 100;
  const mod10 = count % 10;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

type VariantPickerApiItem = {
  id: string;
  sku: string;
  title: string;
  price: string;
  choiceLabel: string;
  choiceContext: string;
  image?: string;
  href: string;
  shippingPromise: FeedShippingPromise;
};

function isVariantPickerApiItem(value: unknown): value is VariantPickerApiItem {
  if (!value || typeof value !== "object") return false;
  const variant = value as Partial<VariantPickerApiItem>;
  return typeof variant.id === "string"
    && typeof variant.sku === "string"
    && typeof variant.title === "string"
    && typeof variant.price === "string"
    && typeof variant.choiceLabel === "string"
    && typeof variant.choiceContext === "string"
    && typeof variant.href === "string"
    && isShippingPromise(variant.shippingPromise);
}

function isShippingPromise(value: unknown): value is FeedShippingPromise {
  if (!value || typeof value !== "object") return false;
  const promise = value as Partial<FeedShippingPromise>;
  return typeof promise.available === "boolean"
    && typeof promise.label === "string"
    && typeof promise.detail === "string";
}

function loadVariantPickerPage(endpoint: string, options: { offset: number; query?: string; availableOnly?: boolean }, signal?: AbortSignal): Promise<VariantPickerPage> {
  const requestUrl = variantPageUrl(endpoint, options);
  const cached = variantRequestCache.get(requestUrl);
  if (cached) return cached;
  const request = fetch(requestUrl, { headers:{ Accept:"application/json" }, signal })
    .then(async (response) => {
      const payload = await response.json() as { ok?: boolean; variants?: unknown; totalVariantCount?: unknown; availableVariantCount?: unknown; matchedVariantCount?: unknown; offset?: unknown; nextOffset?: unknown };
      const loaded = Array.isArray(payload.variants) ? payload.variants.filter(isVariantPickerApiItem).map(toVariantPickerItem) : [];
      if (!response.ok || !payload.ok
        || !isNonNegativeInteger(payload.totalVariantCount)
        || !isNonNegativeInteger(payload.availableVariantCount)
        || !isNonNegativeInteger(payload.matchedVariantCount)
        || !isNonNegativeInteger(payload.offset)
        || !(payload.nextOffset === null || isNonNegativeInteger(payload.nextOffset))
        || (loaded.length === 0 && payload.matchedVariantCount > 0)) throw new Error("variant_list_unavailable");
      return {
        items:loaded,
        totalVariantCount:payload.totalVariantCount,
        availableVariantCount:payload.availableVariantCount,
        matchedVariantCount:payload.matchedVariantCount,
        offset:payload.offset,
        nextOffset:payload.nextOffset,
      };
    })
    .catch((error) => {
      variantRequestCache.delete(requestUrl);
      throw error;
    });
  variantRequestCache.set(requestUrl, request);
  return request;
}

function variantPageUrl(endpoint: string, { offset, query = "", availableOnly = false }: { offset: number; query?: string; availableOnly?: boolean }): string {
  const params = new URLSearchParams({ offset:String(offset), limit:String(VARIANT_PAGE_SIZE) });
  if (query.trim()) params.set("q", query.trim());
  if (availableOnly) params.set("stock", "available");
  return `${endpoint}${endpoint.includes("?") ? "&" : "?"}${params.toString()}`;
}

function mergeVariantItems(primary: VariantPickerItem[], secondary: VariantPickerItem[]): VariantPickerItem[] {
  const merged: VariantPickerItem[] = [];
  const seen = new Set<string>();
  for (const item of [...primary, ...secondary]) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  return merged;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function toVariantPickerItem(variant: VariantPickerApiItem): VariantPickerItem {
  return {
    id:variant.id,
    sku:variant.sku,
    title:variant.title,
    label:variant.choiceLabel,
    context:variant.choiceContext,
    price:variant.price,
    image:variant.image,
    href:variant.href,
    shippingPromise:variant.shippingPromise,
  };
}
