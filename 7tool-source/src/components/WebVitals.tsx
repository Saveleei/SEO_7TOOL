"use client";

import { useReportWebVitals } from "next/web-vitals";

const CORE_WEB_VITALS = new Set(["LCP", "INP", "CLS"]);

export function WebVitals() {
  useReportWebVitals((metric) => {
    if (!CORE_WEB_VITALS.has(metric.name)) return;
    const payload = JSON.stringify({
      metricId: metric.id,
      name: metric.name,
      value: metric.value,
      navigationType: metric.navigationType,
      pagePath: window.location.pathname,
    });
    const body = new Blob([payload], { type: "application/json" });
    if (navigator.sendBeacon?.("/api/analytics/web-vitals", body)) return;
    void fetch("/api/analytics/web-vitals", {
      method: "POST",
      body: payload,
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      keepalive: true,
    });
  });
  return null;
}
