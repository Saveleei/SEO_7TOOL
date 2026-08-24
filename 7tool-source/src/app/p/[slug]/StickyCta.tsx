"use client";

import { useEffect, useState } from "react";
import type { Product, Variant } from "@/lib/catalog";
import { fmtPrice } from "@/lib/catalog";
import { ProductImage } from "@/components/ProductImage";
import { AddToCartButton } from "@/components/AddToCartButton";
import { ecommerceProduct } from "@/lib/advertising";

export function StickyCta({
  product,
  variant,
  onOneClick,
}: {
  product: Product;
  variant: Variant;
  onOneClick: () => void;
}) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      setShow(window.scrollY > 540);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-30 transition-all duration-300 lg:hidden ${
        show ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
      }`}
      role="region"
      aria-label="Быстрая покупка"
    >
      <div className="border-t border-steel-200 bg-white/95 px-3 py-2.5 shadow-elev backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="overflow-hidden rounded-md border border-steel-200">
            <ProductImage p={product} className="h-12 w-12" sizes="48px" />
          </div>
          <div className="min-w-0 flex-1">
            {variant.price != null ? (
              <div className="font-display text-[16px] font-extrabold leading-none text-steel-900">
                {fmtPrice(variant.price)}
              </div>
            ) : (
              <div className="font-display text-[14px] font-extrabold text-steel-900">по запросу</div>
            )}
            <div className="mt-0.5 truncate text-[11.5px] text-steel-500">арт. {variant.sku}</div>
          </div>
          {variant.price != null ? (
            <>
              <button
                onClick={onOneClick}
                className="rounded-md border border-steel-200 bg-white px-3 py-2 text-[12px] font-bold text-steel-700 transition hover:border-amber-400 hover:bg-amber-50 hover:text-amber-800"
              >
                1 клик
              </button>
              <AddToCartButton variantId={variant.id} ecommerceItem={ecommerceProduct(product, variant, "product_sticky")} variant="primary">
                <span className="text-[12px]">В корзину</span>
              </AddToCartButton>
            </>
          ) : (
            <button
              onClick={onOneClick}
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-amber-400 px-4 py-2 text-[12.5px] font-bold text-steel-900 shadow-amber transition hover:-translate-y-0.5 hover:bg-amber-300"
            >
              Запросить цену
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
