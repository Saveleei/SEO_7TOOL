"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackEvent, trackEventOnce } from "@/lib/analytics";
import { YANDEX_METRIKA_ID } from "@/lib/metrika-config";

export const ATTRIBUTION_KEY = "7tool.attribution.v2";
const LEGACY_ATTRIBUTION_KEY = "7tool.first-touch.v1";
const CLIENT_KEY = "7tool.internal-client-id.v1";
const SESSION_KEY = "7tool.session-id.v1";

export type CampaignTouch = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  yclid?: string;
  landingPage: string;
  referrer?: string;
  capturedAt: string;
};

export type LeadAttribution = {
  firstTouch: CampaignTouch;
  lastNonDirect?: CampaignTouch;
  yclid?: string;
  landingPage: string;
  referrer?: string;
  firstVisitAt: string;
  internalClientId: string;
  ymClientId?: string;
  sessionId?: string;
};

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 500) : undefined;
}

const CAMPAIGN_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "yclid"] as const;

function safePage(value: string | undefined): string {
  try {
    const source = new URL(value || window.location.href, window.location.origin);
    const safe = new URL(source.pathname, window.location.origin);
    for (const key of CAMPAIGN_KEYS) {
      const item = source.searchParams.get(key);
      if (item) safe.searchParams.set(key, item.slice(0, 500));
    }
    return `${safe.pathname}${safe.search}`;
  } catch {
    return window.location.pathname;
  }
}

function safeReferrer(value: unknown): string | undefined {
  const raw = asString(value);
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (!/^(?:https?:)$/.test(url.protocol)) return undefined;
    return `${url.origin}${url.pathname}`.slice(0, 500);
  } catch {
    return undefined;
  }
}

function currentTouch(): CampaignTouch {
  const search = new URLSearchParams(window.location.search);
  const value = (key: string) => asString(search.get(key));
  return {
    utm_source: value("utm_source"),
    utm_medium: value("utm_medium"),
    utm_campaign: value("utm_campaign"),
    utm_content: value("utm_content"),
    utm_term: value("utm_term"),
    yclid: value("yclid"),
    landingPage: safePage(window.location.href),
    referrer: safeReferrer(document.referrer),
    capturedAt: new Date().toISOString(),
  };
}

function hasCampaign(touch: CampaignTouch): boolean {
  return Boolean(touch.yclid || touch.utm_source || touch.utm_medium || touch.utm_campaign || touch.utm_content || touch.utm_term);
}

function internalClientId(): string {
  let value = window.localStorage.getItem(CLIENT_KEY) || undefined;
  if (!value) {
    value = typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(CLIENT_KEY, value);
  }
  return value;
}

function sessionId(): string {
  let value = window.sessionStorage.getItem(SESSION_KEY) || undefined;
  if (!value) {
    value = typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.sessionStorage.setItem(SESSION_KEY, value);
  }
  return value;
}

function normalizeLegacy(raw: Record<string, unknown>): LeadAttribution | undefined {
  const landingPage = safePage(asString(raw.landingPage));
  const firstVisitAt = asString(raw.firstVisitAt);
  const internal = asString(raw.internalClientId) || asString(raw.clientId);
  if (!firstVisitAt || !internal) return undefined;
  const firstTouch: CampaignTouch = {
    utm_source: asString(raw.utm_source),
    utm_medium: asString(raw.utm_medium),
    utm_campaign: asString(raw.utm_campaign),
    utm_content: asString(raw.utm_content),
    utm_term: asString(raw.utm_term),
    yclid: asString(raw.yclid),
    landingPage,
    referrer: safeReferrer(raw.referrer),
    capturedAt: firstVisitAt,
  };
  return {
    firstTouch,
    ...(hasCampaign(firstTouch) ? { lastNonDirect: firstTouch } : {}),
    yclid: firstTouch.yclid,
    landingPage,
    referrer: firstTouch.referrer,
    firstVisitAt,
    internalClientId: internal,
    ymClientId: asString(raw.ymClientId),
  };
}

function sanitizeTouch(value: unknown): CampaignTouch | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const capturedAt = asString(raw.capturedAt);
  if (!capturedAt) return undefined;
  return {
    utm_source: asString(raw.utm_source),
    utm_medium: asString(raw.utm_medium),
    utm_campaign: asString(raw.utm_campaign),
    utm_content: asString(raw.utm_content),
    utm_term: asString(raw.utm_term),
    yclid: asString(raw.yclid),
    landingPage: safePage(asString(raw.landingPage)),
    referrer: safeReferrer(raw.referrer),
    capturedAt,
  };
}

function parseStored(raw: string | null): LeadAttribution | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed.firstTouch && typeof parsed.firstTouch === "object" && asString(parsed.internalClientId)) {
      const firstTouch = sanitizeTouch(parsed.firstTouch);
      if (!firstTouch) return undefined;
      const lastNonDirect = sanitizeTouch(parsed.lastNonDirect);
      return {
        firstTouch,
        ...(lastNonDirect ? { lastNonDirect } : {}),
        yclid: asString(parsed.yclid),
        landingPage: safePage(asString(parsed.landingPage) || firstTouch.landingPage),
        referrer: safeReferrer(parsed.referrer),
        firstVisitAt: asString(parsed.firstVisitAt) || firstTouch.capturedAt,
        internalClientId: asString(parsed.internalClientId)!,
        ymClientId: asString(parsed.ymClientId),
      };
    }
    return normalizeLegacy(parsed);
  } catch {
    return undefined;
  }
}

export function readAttribution(): LeadAttribution | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const stored = parseStored(window.localStorage.getItem(ATTRIBUTION_KEY))
      || parseStored(window.localStorage.getItem(LEGACY_ATTRIBUTION_KEY));
    return stored ? { ...stored, sessionId: sessionId() } : undefined;
  } catch {
    return undefined;
  }
}

function persistAttribution() {
  const touch = currentTouch();
  const previous = readAttribution();
  const firstTouch = previous?.firstTouch ?? touch;
  const lastNonDirect = hasCampaign(touch) ? touch : previous?.lastNonDirect;
  const yclid = hasCampaign(touch) ? touch.yclid : previous?.yclid;
  const next: LeadAttribution = {
    firstTouch,
    ...(lastNonDirect ? { lastNonDirect } : {}),
    ...(yclid ? { yclid } : {}),
    landingPage: firstTouch.landingPage,
    referrer: firstTouch.referrer,
    firstVisitAt: previous?.firstVisitAt || firstTouch.capturedAt,
    internalClientId: previous?.internalClientId || internalClientId(),
    ymClientId: previous?.ymClientId,
  };
  window.localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(next));
  window.localStorage.removeItem(LEGACY_ATTRIBUTION_KEY);
}

function captureMetrikaClientId() {
  const target = window as Window & { ym?: (id: number, method: string, callback: (value: string) => void) => void };
  if (!target.ym) return false;
  target.ym(YANDEX_METRIKA_ID, "getClientID", (ymClientId: string) => {
    try {
      const stored = readAttribution();
      if (stored && /^\d+$/.test(ymClientId)) {
        window.localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify({ ...stored, ymClientId }));
      }
    } catch { /* storage недоступен */ }
  });
  return true;
}

export function AttributionCapture() {
  const pathname = usePathname();
  const initialPage = useRef(true);
  useEffect(() => {
    try { persistAttribution(); } catch { /* формы должны работать без storage */ }

    const retries = [0, 500, 1_500, 3_000, 6_000].map((delay) => window.setTimeout(captureMetrikaClientId, delay));

    if (initialPage.current) {
      initialPage.current = false;
    } else {
      const target = window as Window & { ym?: (...args: unknown[]) => void };
      target.ym?.(YANDEX_METRIKA_ID, "hit", `${window.location.origin}${pathname}`, { title: document.title });
    }

    if (pathname.startsWith("/p/")) {
      trackEventOnce(`view-product:${pathname}`, "view_product", { page_type: "product" });
    } else if (pathname.startsWith("/c/")) {
      const [, , category, subcategory] = pathname.split("/");
      trackEventOnce(`view-category:${pathname}`, "view_category", { page_type: "category", category, subcategory });
    }

    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href") || "";
      if (href.startsWith("tel:")) trackEvent("click_phone", { channel: "phone", placement: "link" });
      else if (href.startsWith("mailto:")) trackEvent("click_email", { channel: "email", placement: "link" });
      else if (/^(?:https?:\/\/)?(?:t\.me|wa\.me|max\.ru)\//i.test(href)) trackEvent("click_messenger", { channel: "messenger", placement: "link" });
      else if (href.startsWith("/kontakty")) trackEvent("click_get_quote", { page_type: "contact", placement: "link" });
    };
    document.addEventListener("click", onClick);
    return () => {
      retries.forEach(window.clearTimeout);
      document.removeEventListener("click", onClick);
    };
  }, [pathname]);
  return null;
}
