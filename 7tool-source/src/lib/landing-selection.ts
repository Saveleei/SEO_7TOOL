"use client";

export type LandingSelectedProduct = {
  id: string;
  title: string;
  url: string;
  price: string;
};

export const LANDING_SELECTION_EVENT = "7tool:landing-selection";

function key(category: string, intent: string): string {
  return `7tool:lp-selection:${category}:${intent}`;
}

export function readLandingSelection(category: string, intent: string): LandingSelectedProduct[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key(category, intent)) || "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is LandingSelectedProduct => Boolean(item && typeof item === "object" && "id" in item && "title" in item)).slice(0, 12);
  } catch { return []; }
}

function write(category: string, intent: string, products: LandingSelectedProduct[]) {
  window.localStorage.setItem(key(category, intent), JSON.stringify(products.slice(0, 12)));
  window.dispatchEvent(new CustomEvent(LANDING_SELECTION_EVENT, { detail: { category, intent } }));
}

export function toggleLandingSelection(category: string, intent: string, product: LandingSelectedProduct): LandingSelectedProduct[] {
  const current = readLandingSelection(category, intent);
  const next = current.some((item) => item.id === product.id) ? current.filter((item) => item.id !== product.id) : [...current, product];
  write(category, intent, next);
  return next;
}

export function clearLandingSelection(category: string, intent: string) {
  if (typeof window === "undefined") return;
  write(category, intent, []);
}

