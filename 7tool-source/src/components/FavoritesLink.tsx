"use client";

import Link from "next/link";
import { useFavorites } from "@/lib/favorites";

export function FavoritesLink() {
  const { count } = useFavorites();
  return (
    <Link
      href="/favorites"
      aria-label={`Избранное${count ? `, ${count}` : ""}`}
      className="relative grid h-11 w-11 place-items-center rounded-md border border-steel-200 bg-white text-steel-700 shadow-soft transition hover:-translate-y-0.5 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700 sm:h-10 sm:w-10"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill={count > 0 ? "#f59e0b" : "none"} stroke="currentColor" strokeWidth="2">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
      {count > 0 && (
        <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-amber-500 px-1 text-[10px] font-extrabold leading-none text-steel-900 shadow-amber">
          {count}
        </span>
      )}
    </Link>
  );
}
