"use client";

import { useEffect } from "react";
import { buildContactClickDetail } from "../data/contactAnalytics.mjs";

export function ContactAnalytics() {
  useEffect(() => {
    function trackContactClick(event: MouseEvent) {
      const element = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!element) return;
      const contextElement = element.closest<HTMLElement>("[data-contact-placement]");
      const detail = buildContactClickDetail({
        href:element.getAttribute("href"),
        pathname:window.location.pathname,
        search:window.location.search,
        context:{
          placement:element.dataset.contactPlacement || contextElement?.dataset.contactPlacement,
          product_id:element.dataset.productId || contextElement?.dataset.productId,
          variant_id:element.dataset.variantId || contextElement?.dataset.variantId,
          category:element.dataset.category || contextElement?.dataset.category,
        },
      });
      if (detail) window.dispatchEvent(new CustomEvent("7tool:prototype-event", { detail }));
    }

    document.addEventListener("click", trackContactClick);
    return () => document.removeEventListener("click", trackContactClick);
  }, []);

  return null;
}
