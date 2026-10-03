"use client";

import { KeyboardEvent as ReactKeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { FeedShippingPromise } from "../data/feedCatalog";
import { AddRequestButton } from "./RequestCart";

const FOCUSABLE_SELECTOR = "a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex='-1'])";

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
  fullProductHref?: string;
  variantsEndpoint?: string;
  selectorLabel?: "Размер" | "Исполнение";
};

export function VariantPickerDialog(props: Props) {
  if (!props.open) return null;
  return <OpenVariantPickerDialog {...props} />;
}

function OpenVariantPickerDialog({ onClose, productId, productTitle, category, pageType, placement, items, initialVariantId, totalVariantCount = items.length, fullProductHref, variantsEndpoint, selectorLabel = "Размер" }: Props) {
  const [query, setQuery] = useState("");
  const [stockOnly, setStockOnly] = useState(false);
  const [activeId, setActiveId] = useState(initialVariantId ?? items[0]?.id ?? "");
  const [availableItems, setAvailableItems] = useState(items);
  const [variantsLoading, setVariantsLoading] = useState(Boolean(variantsEndpoint && items.length < totalVariantCount));
  const [variantsError, setVariantsError] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const selected = availableItems.find((item) => item.id === activeId) ?? availableItems[0];
  const availableCount = availableItems.filter((item) => item.shippingPromise.available).length;
  const filteredItems = useMemo(() => {
    const normalized = normalizeSearch(query);
    return availableItems.filter((item) => (!stockOnly || item.shippingPromise.available) && (!normalized || normalizeSearch([item.label, item.context, item.sku].filter(Boolean).join(" ")).includes(normalized)));
  }, [availableItems, query, stockOnly]);

  useEffect(() => {
    if (!variantsEndpoint || items.length >= totalVariantCount) return;
    const controller = new AbortController();
    void fetch(variantsEndpoint, { headers:{ Accept:"application/json" }, signal:controller.signal })
      .then(async (response) => {
        const payload = await response.json() as { ok?: boolean; variants?: unknown };
        const loaded = Array.isArray(payload.variants) ? payload.variants.filter(isVariantPickerApiItem).map(toVariantPickerItem) : [];
        if (!response.ok || !payload.ok || loaded.length < totalVariantCount) throw new Error("variant_list_unavailable");
        setAvailableItems(loaded);
        setActiveId((current) => loaded.some((item) => item.id === current) ? current : loaded[0]?.id ?? "");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setVariantsError("Не удалось загрузить всю матрицу. Откройте карточку товара или передайте размер менеджеру.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setVariantsLoading(false);
      });
    return () => controller.abort();
  }, [items, totalVariantCount, variantsEndpoint]);

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
    <button className="variant-picker-backdrop" type="button" onClick={onClose} aria-label="Закрыть выбор размера" />
    <div className="variant-picker-dialog" ref={dialogRef}>
      <header>
        <div><span>{productTitle}</span><h2 id={`variant-picker-title-${productId}`}>Выберите {selectorLabel.toLocaleLowerCase("ru-RU")}</h2><p id={`variant-picker-description-${productId}`}>{totalVariantCount} {variantWord(totalVariantCount, selectorLabel)} · {variantsLoading ? "проверяем наличие" : `${availableCount} с подтверждённым остатком`}</p></div>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Закрыть">×</button>
      </header>
      <div className="variant-picker-tools">
        <label><span>Найти по размеру или артикулу</span><input type="search" inputMode="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Например: 35 × 30" autoFocus /></label>
        <div role="group" aria-label="Фильтр наличия"><button className={!stockOnly ? "active" : undefined} type="button" aria-pressed={!stockOnly} onClick={() => setStockOnly(false)}>Все · {variantsLoading ? totalVariantCount : availableItems.length}</button><button className={stockOnly ? "active" : undefined} type="button" aria-pressed={stockOnly} disabled={variantsLoading} onClick={() => { setStockOnly(true); track("variant_picker_stock_filter"); }}>В наличии · {availableCount}</button></div>
      </div>
      <div className="variant-picker-legend" aria-label="Обозначения"><span><i className="is-available" />В наличии</span><span><i />Наличие и срок уточним</span></div>
      <div className="variant-picker-results" aria-live="polite">
        {variantsLoading ? <div className="variant-picker-loading" role="status"><b>Загружаем все {totalVariantCount} {variantWord(totalVariantCount, selectorLabel)}</b><span>Собираем полную матрицу размеров и актуального наличия.</span></div> : filteredItems.length > 0 ? <div className="variant-picker-grid" aria-label="Матрица размеров и наличия">{filteredItems.map((item) => {
          const active = item.id === selected?.id;
          return <button className={[active ? "active" : "", item.shippingPromise.available ? "is-available" : "is-unconfirmed"].filter(Boolean).join(" ")} type="button" aria-pressed={active} onClick={() => { setActiveId(item.id); track("variant_picker_select", item.id); }} key={item.id}><b>{item.label}</b><small>{item.price}</small><span><i aria-hidden="true" />{item.shippingPromise.available ? "В наличии" : "Уточним"}</span></button>;
        })}</div> : <div className="variant-picker-empty"><b>Совпадений нет</b><span>Измените размер или покажите все исполнения.</span><button type="button" onClick={() => { setQuery(""); setStockOnly(false); }}>Сбросить фильтр</button></div>}
        {variantsError && <div className="variant-picker-load-error" role="status"><span>{variantsError}</span>{fullProductHref && <a href={fullProductHref}>Открыть карточку товара →</a>}</div>}
      </div>
      {selected && <footer>
        <div className="variant-picker-selection"><span>Выбрано</span><b>{selected.label}</b><small>{selected.sku ? `Артикул ${selected.sku}` : "Артикул не указан"}</small></div>
        <div className="variant-picker-commercial"><div><b>{selected.price}</b><span className={selected.shippingPromise.available ? "is-available" : undefined}>{selected.shippingPromise.label}</span></div><a href={selected.href} onClick={() => track("variant_picker_open_product", selected.id)}>Открыть карточку</a><AddRequestButton item={{ id:`variant:${selected.id}`, title:selected.title || productTitle, article:selected.sku ? `Артикул ${selected.sku}` : "Артикул не указан в фиде", price:selected.price, image:selected.image, href:selected.href, shippingLabel:selected.shippingPromise.label, shippingDetail:selected.shippingPromise.detail }}>Добавить в КП</AddRequestButton></div>
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
