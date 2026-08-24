"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart";

export function CartLink() {
  const { count } = useCart();
  return (
    <Link
      href="/cart"
      aria-label={`Корзина${count ? `, ${count} позиций` : ""}`}
      className="relative grid h-11 w-11 place-items-center rounded-md border-2 border-amber-200 bg-white text-amber-800 shadow-soft transition hover:-translate-y-0.5 hover:border-amber-400 hover:bg-amber-50 hover:shadow-amber sm:h-10 sm:w-10"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 4h2l2.5 12h12l2-9H6" />
        <circle cx="9" cy="20" r="1.5" />
        <circle cx="18" cy="20" r="1.5" />
      </svg>
      {count > 0 && (
        <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-amber-500 px-1 text-[10px] font-extrabold leading-none text-steel-900 shadow-amber">
          {count}
        </span>
      )}
    </Link>
  );
}
