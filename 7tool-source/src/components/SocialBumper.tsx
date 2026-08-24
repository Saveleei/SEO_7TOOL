"use client";

import { useEffect, useState } from "react";

// Детерминированный псевдо-рандом по строке (seed)
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function SocialBumper({
  productId,
  stock,
  hasPrice,
}: {
  productId: string;
  stock: number;
  hasPrice: boolean;
}) {
  const seed = hashSeed(productId);
  // Архивный social proof должен быть доступен на каждой карточке товара.
  const showSocial = true;
  const purchases = 1 + (seed % 5); // 1..5 «купили за месяц»
  const initialViewers = 1 + ((seed >> 3) % 4); // 1..4 смотрят
  const [viewers, setViewers] = useState(initialViewers);

  useEffect(() => {
    if (!showSocial) return;
    let v = initialViewers;
    const t = window.setInterval(() => {
      const delta = Math.random() < 0.5 ? -1 : 1;
      v = Math.max(1, Math.min(5, v + delta));
      setViewers(v);
    }, 18000);
    return () => window.clearInterval(t);
  }, [initialViewers, showSocial]);

  const showUrgency = hasPrice && stock > 0 && stock <= 3;
  if (!showUrgency && !showSocial) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {showUrgency && (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-[12px] font-bold text-amber-800">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h7v8l11-13h-8z"/></svg>
          последние позиции — успейте
        </span>
      )}
      {showSocial && (
        <>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-steel-200 bg-white px-2.5 py-1 text-[12px] text-steel-700">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            смотрят сейчас · <span className="font-bold text-steel-900">{viewers}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-steel-200 bg-white px-2.5 py-1 text-[12px] text-steel-700">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M20 6L9 17l-5-5"/></svg>
            за месяц купили <span className="font-bold text-steel-900">{purchases}</span>
          </span>
        </>
      )}
    </div>
  );
}
