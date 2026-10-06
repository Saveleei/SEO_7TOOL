"use client";

import Link from "next/link";
import { ReactNode, createContext, useContext, useEffect, useState } from "react";
import type { FeedProductCardModel } from "../data/feedCatalog";

export type ComparisonSelection = {
  productId: string;
  slug: string;
  title: string;
  brand: string;
  category: string;
  variantId?: string;
  variantLabel?: string;
  image?: string;
  href: string;
};

type ComparisonValue = {
  items: ComparisonSelection[];
  restored: boolean;
  toggle: (item: ComparisonSelection, placement?: string) => void;
  remove: (productId: string, placement?: string) => void;
  clear: (placement?: string) => void;
  hasProduct: (productId: string) => boolean;
  hasExact: (productId: string, variantId?: string) => boolean;
  isAtLimit: boolean;
};

const STORAGE_KEY = "7tool:comparison:v1";
const MAX_ITEMS = 4;
const ComparisonContext = createContext<ComparisonValue | null>(null);

export function ComparisonProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ComparisonSelection[]>([]);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    let storedItems: ComparisonSelection[] = [];
    try {
      storedItems = sanitizeComparisonSelections(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]"));
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    const timer = window.setTimeout(() => {
      setItems(storedItems);
      setRestored(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!restored) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, restored]);

  useEffect(() => {
    function sync(event: StorageEvent) {
      if (event.key !== STORAGE_KEY) return;
      try {
        setItems(sanitizeComparisonSelections(JSON.parse(event.newValue ?? "[]")));
      } catch {
        setItems([]);
      }
    }
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  function toggle(item: ComparisonSelection, placement = "comparison_control") {
    const safeItem = sanitizeComparisonSelections([item])[0];
    if (!safeItem) return;
    setItems((current) => {
      const existing = current.find((entry) => entry.productId === safeItem.productId);
      if (existing && sameSelection(existing, safeItem)) {
        trackComparison("comparison_remove", safeItem, placement, current.length - 1);
        return current.filter((entry) => entry.productId !== safeItem.productId);
      }
      const withoutProduct = current.filter((entry) => entry.productId !== safeItem.productId);
      if (!existing && withoutProduct.length >= MAX_ITEMS) {
        trackComparison("open_comparison", safeItem, placement, current.length, "limit");
        return current;
      }
      const next = [...withoutProduct, safeItem].slice(0, MAX_ITEMS);
      trackComparison("comparison_add", safeItem, placement, next.length, existing ? "replace" : "add");
      return next;
    });
  }

  function remove(productId: string, placement = "comparison_control") {
    setItems((current) => {
      const item = current.find((entry) => entry.productId === productId);
      if (!item) return current;
      trackComparison("comparison_remove", item, placement, current.length - 1);
      return current.filter((entry) => entry.productId !== productId);
    });
  }

  function clear(placement = "comparison_control") {
    setItems((current) => {
      if (current.length > 0) trackComparison("comparison_clear", current[0], placement, 0);
      return [];
    });
  }

  const value: ComparisonValue = {
    items,
    restored,
    toggle,
    remove,
    clear,
    hasProduct:(productId) => items.some((entry) => entry.productId === productId),
    hasExact:(productId, variantId) => items.some((entry) => entry.productId === productId && (entry.variantId ?? "") === (variantId ?? "")),
    isAtLimit:items.length >= MAX_ITEMS,
  };

  return <ComparisonContext.Provider value={value}>{children}<ComparisonTray /></ComparisonContext.Provider>;
}

export function useComparison(): ComparisonValue {
  const value = useContext(ComparisonContext);
  if (!value) throw new Error("useComparison must be used inside ComparisonProvider");
  return value;
}

export function CompareToggleButton({ item, placement, className }: { item: ComparisonSelection; placement: string; className?: string }) {
  const { hasProduct, hasExact, isAtLimit, toggle } = useComparison();
  const exact = hasExact(item.productId, item.variantId);
  const sameProduct = hasProduct(item.productId);
  const disabled = isAtLimit && !sameProduct;
  const label = exact ? "Убрать из сравнения" : sameProduct ? "Обновить в сравнении" : "Добавить к сравнению";
  return <button className={className} type="button" aria-pressed={exact} disabled={disabled} title={disabled ? "Можно сравнить не более четырёх товаров" : undefined} onClick={() => toggle(item, placement)}>{disabled ? "Максимум 4 товара" : label}</button>;
}

export function comparisonSelectionFromCard(product: FeedProductCardModel): ComparisonSelection {
  const exactVariant = product.selectedVariantCount === 1 ? product.variants[0] : undefined;
  return {
    productId:product.id,
    slug:product.slug,
    title:product.title,
    brand:product.brand,
    category:product.categorySlug,
    variantId:exactVariant?.id,
    variantLabel:exactVariant ? product.specs.slice(0, 2).map((spec) => spec.value).filter(Boolean).join(" · ") || undefined : undefined,
    image:exactVariant?.image ?? product.image,
    href:exactVariant?.href ?? `/p/${product.slug}`,
  };
}

function ComparisonTray() {
  const { items, restored, clear } = useComparison();
  if (!restored || items.length === 0) return null;
  const ready = items.length >= 2;
  return <aside className="comparison-tray" role="status" aria-live="polite">
    <div><span>Сравнение</span><b>{items.length} из {MAX_ITEMS}</b><small>{items.map((item) => item.variantLabel || item.title).join(" · ")}</small></div>
    {ready ? <Link href="/compare" onClick={() => trackComparison("open_comparison", items[0], "comparison_tray", items.length)}>Сравнить товары</Link> : <Link href={`/c/${items[0].category}`} aria-label="Добавить ещё товар для сравнения">Добавить ещё товар</Link>}
    <button type="button" aria-label="Очистить сравнение" onClick={() => clear("comparison_tray")}>×</button>
  </aside>;
}

function sanitizeComparisonSelections(value: unknown): ComparisonSelection[] {
  if (!Array.isArray(value)) return [];
  const unique = new Map<string, ComparisonSelection>();
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const candidate = entry as Partial<ComparisonSelection>;
    const productId = safeText(candidate.productId, 180);
    const slug = safeSlug(candidate.slug);
    const title = safeText(candidate.title, 240);
    const brand = safeText(candidate.brand, 100);
    const category = safeSlug(candidate.category);
    const variantId = candidate.variantId ? safeIdentifier(candidate.variantId) : undefined;
    const variantLabel = candidate.variantLabel ? safeText(candidate.variantLabel, 160) : undefined;
    const image = candidate.image && /^\/(?:[^\s]+)$/u.test(candidate.image) ? candidate.image.slice(0, 600) : candidate.image && /^https:\/\//u.test(candidate.image) ? candidate.image.slice(0, 600) : undefined;
    const href = typeof candidate.href === "string" && candidate.href.startsWith(`/p/${slug}`) ? candidate.href.slice(0, 600) : `/p/${slug}`;
    if (!productId || !slug || !title || !brand || !category) continue;
    unique.set(productId, { productId, slug, title, brand, category, variantId, variantLabel, image, href });
    if (unique.size === MAX_ITEMS) break;
  }
  return Array.from(unique.values());
}

function safeText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().replace(/[<>]/gu, "").slice(0, maxLength) : "";
}

function safeSlug(value: unknown): string {
  const normalized = typeof value === "string" ? value.trim().toLocaleLowerCase("ru-RU") : "";
  return /^[a-z0-9-]{1,180}$/u.test(normalized) ? normalized : "";
}

function safeIdentifier(value: unknown): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  return /^[\p{L}\p{N}_.:+/-]{1,180}$/u.test(normalized) ? normalized : "";
}

function sameSelection(first: ComparisonSelection, second: ComparisonSelection): boolean {
  return first.productId === second.productId && (first.variantId ?? "") === (second.variantId ?? "");
}

function trackComparison(event: string, item: ComparisonSelection, placement: string, itemCount: number, action?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("7tool:prototype-event", { detail:{ event, placement, page_type:resolvePageType(), product_id:item.productId, variant_id:item.variantId, category:item.category, item_count:itemCount, action } }));
}

function resolvePageType(): string {
  if (window.location.pathname.startsWith("/catalog/")) return "category";
  if (window.location.pathname.startsWith("/p/")) return "product";
  if (window.location.pathname === "/compare") return "comparison";
  return "other";
}
