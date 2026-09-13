"use client";

import { useEffect } from "react";
import { resolveDocumentNavigation } from "../data/documentNavigation.mjs";

export function DocumentNavigationFallback() {
  useEffect(() => {
    function navigateWithBrowser(event: MouseEvent) {
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!anchor) return;

      const destination = resolveDocumentNavigation({
        href:anchor.getAttribute("href"),
        currentUrl:window.location.href,
        button:event.button,
        metaKey:event.metaKey,
        ctrlKey:event.ctrlKey,
        shiftKey:event.shiftKey,
        altKey:event.altKey,
        target:anchor.getAttribute("target") ?? "",
        download:anchor.hasAttribute("download"),
      });
      if (!destination) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      window.location.assign(destination);
    }

    document.addEventListener("click", navigateWithBrowser, true);
    return () => document.removeEventListener("click", navigateWithBrowser, true);
  }, []);

  return null;
}
