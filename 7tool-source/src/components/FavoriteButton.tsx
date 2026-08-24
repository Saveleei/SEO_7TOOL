"use client";

import { useFavorites } from "@/lib/favorites";

export function FavoriteButton({ productId, className = "" }: { productId: string; className?: string }) {
  const { has, toggle } = useFavorites();
  const active = has(productId);
  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(productId); }}
      aria-pressed={active}
      aria-label={active ? "Убрать из избранного" : "В избранное"}
      className={`tip grid h-11 w-11 place-items-center rounded-md border bg-white/95 shadow-soft backdrop-blur transition sm:h-9 sm:w-9 ${
        active
          ? "border-amber-400 text-amber-600 hover:bg-amber-50"
          : "border-steel-200 text-steel-500 hover:border-amber-300 hover:text-amber-600"
      } ${className}`}
      data-tip={active ? "В избранном" : "В избранное"}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    </button>
  );
}
