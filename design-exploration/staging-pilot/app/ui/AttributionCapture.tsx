"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { captureRequestAttribution, setRequestYmClientId } from "../data/requestAttribution";

type Props = { counterId: number | null };

export function AttributionCapture({ counterId }: Props) {
  const pathname = usePathname();

  useEffect(() => {
    captureRequestAttribution();
    if (!counterId) return;
    const captureClientId = () => {
      const target = window as Window & { ym?: (id: number, method: string, callback: (value: string) => void) => void };
      if (!target.ym) return;
      target.ym(counterId, "getClientID", setRequestYmClientId);
    };
    const timers = [0, 500, 1_500, 3_000, 6_000].map((delay) => window.setTimeout(captureClientId, delay));
    return () => timers.forEach(window.clearTimeout);
  }, [counterId, pathname]);

  return null;
}
