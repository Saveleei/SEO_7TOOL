"use client";

import { useEffect } from "react";

type CatalogView = "list" | "grid";
type Props = {
  mode: "desktop" | "mobile";
  activeView: CatalogView;
  explicitView?: CatalogView;
  listHref: string;
  gridHref: string;
};

const STORAGE_PREFIX = "7tool:catalog-view:v1";

function readStoredView(storageKey: string): CatalogView | null {
  try {
    const value = window.localStorage.getItem(storageKey);
    return value === "list" || value === "grid" ? value : null;
  } catch {
    return null;
  }
}

function storeView(storageKey: string, view: CatalogView) {
  try {
    window.localStorage.setItem(storageKey, view);
  } catch {
    // Browsing remains functional when storage is unavailable.
  }
}

export function CatalogViewSwitch({ mode, activeView, explicitView, listHref, gridHref }: Props) {
  useEffect(() => {
    const mobileDevice = window.matchMedia("(max-width: 760px)").matches;
    if ((mode === "mobile") !== mobileDevice) return;
    const storageKey = `${STORAGE_PREFIX}:${mode}`;
    if (explicitView) {
      storeView(storageKey, explicitView);
      return;
    }
    const storedView = readStoredView(storageKey);
    if (!storedView) return;
    if (storedView === activeView) return;
    window.location.replace(storedView === "list" ? listHref : gridHref);
  }, [activeView, explicitView, gridHref, listHref, mode]);

  function remember(view: CatalogView) {
    storeView(`${STORAGE_PREFIX}:${mode}`, view);
  }

  return <nav className={`feed-view-switch feed-view-switch--${mode}`} aria-label="Вид товаров">
    <a className={activeView === "list" ? "active" : undefined} aria-current={activeView === "list" ? "page" : undefined} data-conversion-action="listing_view_list" href={listHref} onClick={() => remember("list")}><i aria-hidden="true">☷</i><span>{mode === "desktop" ? "Таблицей" : "Списком"}</span></a>
    <a className={activeView === "grid" ? "active" : undefined} aria-current={activeView === "grid" ? "page" : undefined} data-conversion-action="listing_view_grid" href={gridHref} onClick={() => remember("grid")}><i aria-hidden="true">▦</i><span>Плиткой</span></a>
  </nav>;
}
