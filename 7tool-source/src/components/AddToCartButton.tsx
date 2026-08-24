"use client";

import { useState } from "react";
import { useCart } from "@/lib/cart";
import { trackEcommerce, trackEvent, type EcommerceProduct } from "@/lib/analytics";

export function AddToCartButton({
  variantId,
  className = "",
  variant = "icon",
  qty = 1,
  disabled = false,
  children,
  ecommerceItem,
}: {
  variantId: string;
  className?: string;
  variant?: "icon" | "primary" | "ghost";
  qty?: number;
  disabled?: boolean;
  children?: React.ReactNode;
  ecommerceItem?: EcommerceProduct;
}) {
  const { add } = useCart();
  const [pulse, setPulse] = useState(false);

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    add(variantId, qty);
    trackEvent("add_to_cart", { variant_id: variantId, placement: variant });
    if (ecommerceItem) trackEcommerce("add", [{ ...ecommerceItem, quantity: qty }]);
    setPulse(true);
    window.setTimeout(() => setPulse(false), 700);
  };

  if (variant === "icon") {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        aria-label="В корзину"
        className={`grid h-11 w-11 place-items-center rounded-md bg-amber-400 text-steel-900 shadow-amber transition hover:-translate-y-0.5 hover:bg-amber-300 hover:shadow-elev disabled:cursor-not-allowed disabled:opacity-50 ${
          pulse ? "scale-95" : ""
        } ${className}`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 4h2l2.5 12h12l2-9H6" />
          <circle cx="9" cy="20" r="1.5" />
          <circle cx="18" cy="20" r="1.5" />
        </svg>
      </button>
    );
  }
  if (variant === "primary") {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={`inline-flex items-center justify-center gap-2 rounded-md bg-amber-400 px-5 py-3 text-[14px] font-semibold text-steel-900 shadow-amber transition hover:-translate-y-0.5 hover:bg-amber-300 hover:shadow-elev disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M3 4h2l2.5 12h12l2-9H6" />
          <circle cx="9" cy="20" r="1.5" />
          <circle cx="18" cy="20" r="1.5" />
        </svg>
        {children ?? "В корзину"}
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-md border border-steel-200 bg-white px-4 py-2.5 text-[13px] font-medium text-steel-700 shadow-soft transition hover:border-cobalt-300 hover:text-cobalt-700 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children ?? "Добавить"}
    </button>
  );
}
