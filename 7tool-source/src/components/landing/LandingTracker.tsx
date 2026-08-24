"use client";

import { useEffect } from "react";
import { trackEventOnce } from "@/lib/analytics";

export function LandingTracker({ category, intent }: { category: string; intent: string }) {
  useEffect(() => {
    trackEventOnce(`lp-view:${window.location.pathname}`, "lp_view", { page_type: "landing", category, intent });
  }, [category, intent]);
  return null;
}
