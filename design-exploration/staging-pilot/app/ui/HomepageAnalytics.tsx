"use client";

import { useEffect } from "react";

const ALLOWED_ACTIONS = new Set(["open_catalog", "choose_task", "upload_specification"]);

export function HomepageAnalytics() {
  useEffect(() => {
    function trackHomepageAction(event: MouseEvent) {
      const element = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-home-action]") : null;
      const action = element?.dataset.homeAction || "";
      if (!ALLOWED_ACTIONS.has(action)) return;
      window.dispatchEvent(new CustomEvent("7tool:prototype-event", {
        detail:{ event:"homepage_action", page_type:"homepage", placement:"hero", action },
      }));
    }

    document.addEventListener("click", trackHomepageAction);
    return () => document.removeEventListener("click", trackHomepageAction);
  }, []);

  return null;
}
