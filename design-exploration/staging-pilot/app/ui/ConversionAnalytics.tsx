"use client";

import { useEffect } from "react";
import { sanitizeConversionEvent } from "../data/conversionAnalytics.mjs";

type DataLayerWindow = Window & { dataLayer?: Array<Record<string, unknown>> };

export function useConversionAnalytics() {
  useEffect(() => {
    function record(detail: unknown) {
      const safeEvent = sanitizeConversionEvent(detail) as Record<string, unknown> | null;
      if (!safeEvent) return;
      const analyticsWindow = window as DataLayerWindow;
      analyticsWindow.dataLayer ??= [];
      analyticsWindow.dataLayer.push(safeEvent);
    }

    function receive(event: Event) {
      if (event instanceof CustomEvent) record(event.detail);
    }

    function trackProductOpen(event: MouseEvent) {
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href^="/product/"]') : null;
      if (!link || event.button !== 0) return;
      const url = new URL(link.href, window.location.origin);
      const productId = url.pathname.split("/").filter(Boolean).at(-1) ?? "";
      const categoryMatch = window.location.pathname.match(/^\/catalog\/category\/([^/]+)/u);
      record({
        event:"open_product",
        placement:resolveProductPlacement(link),
        page_type:categoryMatch ? "category" : "other",
        product_id:productId,
        variant_id:url.searchParams.get("variant") ?? undefined,
        category:categoryMatch?.[1],
      });
    }

    window.addEventListener("7tool:prototype-event", receive);
    document.addEventListener("click", trackProductOpen);
    record(resolvePageView(window.location));
    return () => {
      window.removeEventListener("7tool:prototype-event", receive);
      document.removeEventListener("click", trackProductOpen);
    };
  }, []);
}

export function ConversionAnalytics() {
  useConversionAnalytics();
  return null;
}

function resolvePageView(location: Location): Record<string, unknown> | null {
  const category = location.pathname.match(/^\/catalog\/category\/([^/]+)/u)?.[1];
  if (category) {
    const activeFilterCount = Array.from(new URLSearchParams(location.search).keys()).filter((key) => key.startsWith("f_") || key.startsWith("min_") || key.startsWith("max_") || key === "availability" || key === "family").length;
    return { event:"view_category", placement:"page", page_type:"category", category, active_filter_count:activeFilterCount };
  }
  const productId = location.pathname.match(/^\/product\/([^/]+)/u)?.[1];
  if (productId) return { event:"view_product", placement:"page", page_type:"product", product_id:productId, variant_id:new URLSearchParams(location.search).get("variant") ?? undefined };
  return null;
}

function resolveProductPlacement(link: HTMLAnchorElement): string {
  if (link.closest(".feed-product-table")) return "category_table";
  if (link.closest(".feed-product-table-mobile")) return "category_mobile";
  if (link.closest(".feed-card-variants")) return "category_card_variant";
  if (link.closest(".feed-product-card")) return "category_card";
  if (link.closest(".feed-recommendations")) return "product_recommendation";
  return "product_link";
}
