"use client";

import { useReportWebVitals } from "next/web-vitals";
import { sanitizeConversionEvent } from "../data/conversionAnalytics.mjs";

type AnalyticsWindow = Window & { dataLayer?: Array<Record<string, unknown>> };

export function WebVitalsAnalytics() {
  useReportWebVitals((metric) => {
    const event = sanitizeConversionEvent({
      event:"web_vital",
      metric_name:metric.name,
      metric_value:metric.value,
      metric_delta:metric.delta,
      metric_rating:metric.rating,
      navigation_type:metric.navigationType,
    }) as Record<string, unknown> | null;
    if (!event) return;
    const analyticsWindow = window as AnalyticsWindow;
    analyticsWindow.dataLayer ??= [];
    analyticsWindow.dataLayer.push(event);
  });
  return null;
}
