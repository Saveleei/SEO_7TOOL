"use client";

import type { LeadType } from "./leads";
import { readAttribution } from "@/components/AttributionCapture";

export type LeadInput = {
  type: LeadType;
  submissionId?: string;
  name?: string;
  phone?: string;
  email?: string;
  company?: string;
  inn?: string;
  message?: string;
  productId?: string;
  variantId?: string;
  productTitle?: string;
  productUrl?: string;
  articleId?: string;
  keywordClusterId?: string;
  category?: string;
  intent?: string;
  ctaKey?: string;
  extra?: Record<string, unknown>;
};

export type LeadFiles = {
  specification?: File | null;
  requisites?: File | null;
};

function safePageUrl(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const source = new URL(window.location.href);
  const safe = new URL(source.pathname, source.origin);
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "yclid"]) {
    const value = source.searchParams.get(key);
    if (value) safe.searchParams.set(key, value.slice(0, 500));
  }
  return safe.toString();
}

function stableSubmissionId(p: LeadInput): { id: string; storageKey?: string } {
  if (p.submissionId) return { id: p.submissionId };
  const generated = () => typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  if (typeof window === "undefined") return { id: generated() };
  const storageKey = `7tool.submission.${p.type}.${p.variantId || p.productId || "general"}.${window.location.pathname}`;
  try {
    const existing = window.sessionStorage.getItem(storageKey);
    if (existing) return { id: existing, storageKey };
    const id = generated();
    window.sessionStorage.setItem(storageKey, id);
    return { id, storageKey };
  } catch {
    return { id: generated() };
  }
}

export async function sendLead(
  p: LeadInput,
  files: LeadFiles = {},
): Promise<{ ok: boolean; id?: number; requestId?: string; duplicate?: boolean; error?: string }> {
  const submission = stableSubmissionId(p);
  try {
    const pageUrl = safePageUrl();
    const payload = {
      ...p,
      submissionId: submission.id,
      pageUrl,
      consent: true,
      website: "",
      extra: { ...(p.extra ?? {}), attribution: readAttribution() },
    };
    const multipart = Boolean(files.specification || files.requisites);
    const body = multipart ? new FormData() : JSON.stringify(payload);
    if (body instanceof FormData) {
      body.set("payload", JSON.stringify(payload));
      if (files.specification) body.set("specification", files.specification);
      if (files.requisites) body.set("requisites", files.requisites);
    }
    const r = await fetch("/api/lead", {
      method: "POST",
      headers: multipart ? undefined : { "Content-Type": "application/json" },
      body,
    });
    const data = (await r.json().catch(() => ({}))) as { ok?: boolean; id?: number; requestId?: string; duplicate?: boolean; error?: string };
    if (!r.ok || !data.ok) return { ok: false, error: data.error ?? `HTTP ${r.status}` };
    if (submission.storageKey) {
      try { window.sessionStorage.removeItem(submission.storageKey); } catch { /* storage is optional */ }
    }
    return { ok: true, id: data.id, requestId: data.requestId, duplicate: data.duplicate };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
