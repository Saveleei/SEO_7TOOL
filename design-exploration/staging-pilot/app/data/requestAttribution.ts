"use client";

export const REQUEST_ATTRIBUTION_KEY = "7tool.attribution.v2";
const LEGACY_ATTRIBUTION_KEY = "7tool.first-touch.v1";
const CLIENT_KEY = "7tool.internal-client-id.v1";
const SESSION_KEY = "7tool.session-id.v1";

const CAMPAIGN_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "yclid"] as const;

export type RequestCampaignTouch = {
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

export type RequestAttribution = {
  firstTouch: RequestCampaignTouch;
  lastNonDirect?: RequestCampaignTouch;
  yclid?: string;
  landingPage: string;
  referrer?: string;
  firstVisitAt: string;
  internalClientId: string;
  ymClientId?: string;
  sessionId?: string;
};

export type RequestSource = {
  pagePath: string;
  pageUrl: string;
  landingPage: string;
  referrer: string;
  firstVisitAt: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
  yclid: string;
  ymClientId: string;
  internalClientId: string;
  sessionId: string;
  firstTouch: RequestCampaignTouch;
  lastNonDirect?: RequestCampaignTouch;
};

function asString(value: unknown, maximum = 500): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maximum) : undefined;
}

function safePage(value?: string): string {
  if (typeof window === "undefined") return "/";
  try {
    const source = new URL(value || window.location.href, window.location.origin);
    if (source.origin !== window.location.origin) return "/";
    const safe = new URL(source.pathname, window.location.origin);
    for (const key of CAMPAIGN_KEYS) {
      const item = asString(source.searchParams.get(key));
      if (item) safe.searchParams.set(key, item);
    }
    const variant = asString(source.searchParams.get("variant"), 160);
    if (variant) safe.searchParams.set("variant", variant);
    return `${safe.pathname}${safe.search}`;
  } catch {
    return window.location.pathname || "/";
  }
}

function safeReferrer(value: unknown): string | undefined {
  const raw = asString(value);
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (!/^(?:https?:)$/u.test(url.protocol)) return undefined;
    return `${url.origin}${url.pathname}`.slice(0, 500);
  } catch {
    return undefined;
  }
}

function currentTouch(): RequestCampaignTouch {
  const search = new URLSearchParams(window.location.search);
  const value = (key: string, maximum = 500) => asString(search.get(key), maximum);
  return {
    utm_source:value("utm_source"),
    utm_medium:value("utm_medium"),
    utm_campaign:value("utm_campaign"),
    utm_content:value("utm_content"),
    utm_term:value("utm_term"),
    yclid:value("yclid", 200),
    landingPage:safePage(window.location.href),
    referrer:safeReferrer(document.referrer),
    capturedAt:new Date().toISOString(),
  };
}

function hasCampaign(touch: RequestCampaignTouch): boolean {
  return Boolean(touch.yclid || touch.utm_source || touch.utm_medium || touch.utm_campaign || touch.utm_content || touch.utm_term);
}

function browserId(storage: Storage, key: string): string {
  let value = asString(storage.getItem(key), 120);
  if (!value) {
    value = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    storage.setItem(key, value);
  }
  return value;
}

function sanitizeTouch(value: unknown): RequestCampaignTouch | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const capturedAt = asString(raw.capturedAt, 80);
  if (!capturedAt) return undefined;
  return {
    utm_source:asString(raw.utm_source),
    utm_medium:asString(raw.utm_medium),
    utm_campaign:asString(raw.utm_campaign),
    utm_content:asString(raw.utm_content),
    utm_term:asString(raw.utm_term),
    yclid:asString(raw.yclid, 200),
    landingPage:safePage(asString(raw.landingPage)),
    referrer:safeReferrer(raw.referrer),
    capturedAt,
  };
}

function normalizeStored(raw: Record<string, unknown>): RequestAttribution | undefined {
  const nestedFirstTouch = sanitizeTouch(raw.firstTouch);
  const firstVisitAt = asString(raw.firstVisitAt, 80);
  const internalClientId = asString(raw.internalClientId, 120) || asString(raw.clientId, 120);
  if (nestedFirstTouch && internalClientId) {
    const lastNonDirect = sanitizeTouch(raw.lastNonDirect);
    return {
      firstTouch:nestedFirstTouch,
      ...(lastNonDirect ? { lastNonDirect } : {}),
      yclid:asString(raw.yclid, 200),
      landingPage:safePage(asString(raw.landingPage) || nestedFirstTouch.landingPage),
      referrer:safeReferrer(raw.referrer) || nestedFirstTouch.referrer,
      firstVisitAt:firstVisitAt || nestedFirstTouch.capturedAt,
      internalClientId,
      ymClientId:asString(raw.ymClientId, 40),
    };
  }
  if (!firstVisitAt || !internalClientId) return undefined;
  const firstTouch: RequestCampaignTouch = {
    utm_source:asString(raw.utm_source),
    utm_medium:asString(raw.utm_medium),
    utm_campaign:asString(raw.utm_campaign),
    utm_content:asString(raw.utm_content),
    utm_term:asString(raw.utm_term),
    yclid:asString(raw.yclid, 200),
    landingPage:safePage(asString(raw.landingPage)),
    referrer:safeReferrer(raw.referrer),
    capturedAt:firstVisitAt,
  };
  return {
    firstTouch,
    ...(hasCampaign(firstTouch) ? { lastNonDirect:firstTouch } : {}),
    yclid:firstTouch.yclid,
    landingPage:firstTouch.landingPage,
    referrer:firstTouch.referrer,
    firstVisitAt,
    internalClientId,
    ymClientId:asString(raw.ymClientId, 40),
  };
}

function readStored(): RequestAttribution | undefined {
  if (typeof window === "undefined") return undefined;
  for (const key of [REQUEST_ATTRIBUTION_KEY, LEGACY_ATTRIBUTION_KEY]) {
    try {
      const value = window.localStorage.getItem(key);
      if (!value) continue;
      const normalized = normalizeStored(JSON.parse(value) as Record<string, unknown>);
      if (normalized) return normalized;
    } catch {
      // Attribution must never block navigation or a lead form.
    }
  }
  return undefined;
}

export function captureRequestAttribution(): RequestAttribution | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const touch = currentTouch();
    const previous = readStored();
    const firstTouch = previous?.firstTouch ?? touch;
    const lastNonDirect = hasCampaign(touch) ? touch : previous?.lastNonDirect;
    const attribution: RequestAttribution = {
      firstTouch,
      ...(lastNonDirect ? { lastNonDirect } : {}),
      yclid:lastNonDirect?.yclid || previous?.yclid,
      landingPage:firstTouch.landingPage,
      referrer:firstTouch.referrer,
      firstVisitAt:previous?.firstVisitAt || firstTouch.capturedAt,
      internalClientId:previous?.internalClientId || browserId(window.localStorage, CLIENT_KEY),
      ymClientId:previous?.ymClientId,
      sessionId:browserId(window.sessionStorage, SESSION_KEY),
    };
    window.localStorage.setItem(REQUEST_ATTRIBUTION_KEY, JSON.stringify(attribution));
    window.localStorage.removeItem(LEGACY_ATTRIBUTION_KEY);
    return attribution;
  } catch {
    return undefined;
  }
}

export function setRequestYmClientId(value: string): void {
  if (!/^\d{3,40}$/u.test(value) || typeof window === "undefined") return;
  try {
    const attribution = captureRequestAttribution();
    if (attribution) window.localStorage.setItem(REQUEST_ATTRIBUTION_KEY, JSON.stringify({ ...attribution, ymClientId:value }));
  } catch {
    // Storage is optional; lead submission remains available.
  }
}

export function buildRequestSource(): RequestSource {
  const fallbackTouch = currentTouch();
  const attribution = captureRequestAttribution() ?? {
    firstTouch:fallbackTouch,
    ...(hasCampaign(fallbackTouch) ? { lastNonDirect:fallbackTouch } : {}),
    yclid:fallbackTouch.yclid,
    landingPage:fallbackTouch.landingPage,
    referrer:fallbackTouch.referrer,
    firstVisitAt:fallbackTouch.capturedAt,
    internalClientId:"",
    sessionId:"",
  };
  const activeTouch = attribution.lastNonDirect ?? attribution.firstTouch;
  return {
    pagePath:window.location.pathname || "/",
    pageUrl:safePage(window.location.href),
    landingPage:attribution.landingPage,
    referrer:attribution.referrer ?? "",
    firstVisitAt:attribution.firstVisitAt,
    utmSource:activeTouch.utm_source ?? "",
    utmMedium:activeTouch.utm_medium ?? "",
    utmCampaign:activeTouch.utm_campaign ?? "",
    utmContent:activeTouch.utm_content ?? "",
    utmTerm:activeTouch.utm_term ?? "",
    yclid:activeTouch.yclid || attribution.yclid || "",
    ymClientId:attribution.ymClientId ?? "",
    internalClientId:attribution.internalClientId,
    sessionId:attribution.sessionId ?? "",
    firstTouch:attribution.firstTouch,
    ...(attribution.lastNonDirect ? { lastNonDirect:attribution.lastNonDirect } : {}),
  };
}
