"use client";

import type { MouseEvent, ReactNode } from "react";

export function PromotedFilterLink({
  href,
  className,
  current,
  children,
}: {
  href: string;
  className?: string;
  current?: boolean;
  children: ReactNode;
}) {
  function navigate(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    window.location.assign(href);
  }

  return <a className={className} aria-current={current ? "true" : undefined} href={href} onClick={navigate}>{children}</a>;
}

export function OpenFullFiltersLink({ toggleId }: { toggleId: string }) {
  function openFilters(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    const panel = document.getElementById("feed-filter-panel");
    const toggle = document.getElementById(toggleId);
    if (toggle instanceof HTMLInputElement) toggle.checked = true;
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#feed-filter-panel`);
    panel?.scrollIntoView({ behavior:"smooth", block:"start" });
    window.requestAnimationFrame(() => panel?.querySelector<HTMLInputElement>('input[type="search"]')?.focus({ preventScroll:true }));
  }

  return <a className="feed-promoted-more" href="#feed-filter-panel" onClick={openFilters}>Все параметры →</a>;
}
