"use client";

import { YANDEX_METRIKA_ID } from "./metrika-config";
import { createMetrikaDispatcher } from "./metrika-dispatch.mjs";

export type AnalyticsEvent =
  | "view_product"
  | "view_category"
  | "click_phone"
  | "click_email"
  | "click_messenger"
  | "click_get_quote"
  | "open_one_click"
  | "submit_one_click"
  | "submit_product_quote"
  | "add_to_cart"
  | "remove_from_cart"
  | "begin_checkout"
  | "submit_order"
  | "submit_contact"
  | "submit_equipment_selection"
  | "submit_cart_quote"
  | "submit_price_match"
  | "search"
  | "select_variant"
  | "open_warehouse_gallery"
  | "lp_view"
  | "lp_selector_start"
  | "lp_selector_complete"
  | "lp_form_start"
  | "lp_lead_submit"
  | "lp_product_click"
  | "lp_quick_choice"
  | "lp_email_intent"
  | "download_catalog"
  | "download_kp";

export type AnalyticsParams = {
  form_id?: string;
  page_type?: string;
  category?: string;
  subcategory?: string;
  product_id?: string;
  variant_id?: string;
  brand?: string;
  intent?: string;
  placement?: string;
  channel?: string;
  list?: string;
};

export type EcommerceProduct = {
  id: string;
  name: string;
  brand?: string;
  category?: string;
  price?: number;
  quantity?: number;
  variant?: string;
  list?: string;
};

type MetrikaWindow = Window & {
  ym?: (id: number, method: string, target: string, params?: Record<string, unknown>) => void;
  dataLayer?: Array<Record<string, unknown>>;
};

let dispatcher: ReturnType<typeof createMetrikaDispatcher> | undefined;

const SAFE_PARAM_KEYS = new Set<keyof AnalyticsParams>([
  "form_id", "page_type", "category", "subcategory", "product_id", "variant_id",
  "brand", "intent", "placement", "channel", "list",
]);

function safeParams(params: AnalyticsParams): AnalyticsParams {
  return Object.fromEntries(
    Object.entries(params)
      .filter(([key, value]) => SAFE_PARAM_KEYS.has(key as keyof AnalyticsParams) && typeof value === "string" && value.trim())
      .map(([key, value]) => [key, String(value).slice(0, 160)]),
  ) as AnalyticsParams;
}

function debug(kind: string, payload: unknown) {
  if (process.env.NODE_ENV !== "production" && typeof console !== "undefined") {
    console.info(`[7tool analytics] ${kind}`, payload);
  }
}

function getDispatcher() {
  dispatcher ??= createMetrikaDispatcher({
    deliver(event, params) {
      const ym = (window as MetrikaWindow).ym;
      if (typeof ym !== "function") return false;
      try {
        ym(YANDEX_METRIKA_ID, "reachGoal", event, params);
        return true;
      } catch {
        return false;
      }
    },
    schedule(callback, delay) {
      return window.setTimeout(callback, delay);
    },
    readOnce(key) {
      try {
        return window.sessionStorage.getItem(key) === "1";
      } catch {
        return false;
      }
    },
    writeOnce(key) {
      try {
        window.sessionStorage.setItem(key, "1");
      } catch { /* in-memory защита от дубля остаётся активной */ }
    },
  });
  return dispatcher;
}

export function trackEvent(event: AnalyticsEvent, params: AnalyticsParams = {}) {
  if (typeof window === "undefined") return;
  const clean = safeParams(params);
  debug(event, clean);
  getDispatcher().send(event, clean);
}

export function trackEventOnce(key: string, event: AnalyticsEvent, params: AnalyticsParams = {}) {
  if (typeof window === "undefined") return;
  const storageKey = `7tool.analytics.once.${key}`;
  const clean = safeParams(params);
  debug(event, clean);
  getDispatcher().sendOnce(storageKey, event, clean);
}

/**
 * Sends one client-side goal for a lead that the API confirmed as persisted.
 * A repeated idempotent response is intentionally allowed: if the first HTTP
 * response was lost, this is the first opportunity the browser has to report
 * the conversion. Session storage prevents a normal double submit from
 * producing a second goal.
 */
export function trackConfirmedLead(requestId: string | undefined, event: AnalyticsEvent, params: AnalyticsParams = {}) {
  if (!requestId) return;
  trackEventOnce(`confirmed-lead:${requestId}:${event}`, event, params);
}

function cleanProducts(products: EcommerceProduct[]): EcommerceProduct[] {
  return products
    .filter((product) => product.id?.trim() && product.name?.trim())
    .map((product) => ({
      id: String(product.id).slice(0, 160),
      name: String(product.name).slice(0, 500),
      ...(product.brand ? { brand: String(product.brand).slice(0, 160) } : {}),
      ...(product.category ? { category: String(product.category).slice(0, 160) } : {}),
      ...(Number.isFinite(product.price) && (product.price as number) > 0 ? { price: product.price } : {}),
      ...(Number.isFinite(product.quantity) && (product.quantity as number) > 0 ? { quantity: product.quantity } : {}),
      ...(product.variant ? { variant: String(product.variant).slice(0, 160) } : {}),
      ...(product.list ? { list: String(product.list).slice(0, 160) } : {}),
    }));
}

export function trackEcommerce(
  action: "impressions" | "click" | "detail" | "add" | "remove",
  products: EcommerceProduct[],
) {
  if (typeof window === "undefined") return;
  const target = window as MetrikaWindow;
  target.dataLayer = target.dataLayer ?? [];
  const clean = cleanProducts(products);
  if (!clean.length) return;
  const actionValue = action === "impressions" ? clean : { products: clean };
  const payload = { ecommerce: { currencyCode: "RUB", [action]: actionValue } };
  debug(`ecommerce:${action}`, payload);
  target.dataLayer.push(payload);
}

export function trackPurchase(orderId: string, products: EcommerceProduct[]) {
  if (typeof window === "undefined" || !orderId.trim()) return;
  const clean = cleanProducts(products);
  if (!clean.length) return;
  const target = window as MetrikaWindow;
  target.dataLayer = target.dataLayer ?? [];
  const payload = {
    ecommerce: {
      currencyCode: "RUB",
      purchase: { actionField: { id: orderId.slice(0, 160) }, products: clean },
    },
  };
  debug("ecommerce:purchase", payload);
  target.dataLayer.push(payload);
}
