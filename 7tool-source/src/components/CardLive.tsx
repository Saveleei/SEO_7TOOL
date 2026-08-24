"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Product } from "@/lib/data";
import { useLiveProduct } from "@/lib/live";
import { getProductAvailability, isValidPrice } from "@/lib/catalog";
import { AddToCartButton } from "./AddToCartButton";
import { OneClickModal } from "./OneClickModal";
import { ecommerceProduct } from "@/lib/advertising";
import { trackEcommerce } from "@/lib/analytics";

const fmt = new Intl.NumberFormat("ru-RU");

// Волатильная часть карточки товара (бейдж скидки, наличие, цена) — клиентская,
// чтобы подменять значения из /api/live. Картинка/бренд/заголовок остаются в SSR.
// Бейдж позиционируется absolute относительно <article> карточки, поэтому корректен
// независимо от места в DOM.
export function CardLive({ p: raw, href }: { p: Product; href: string }) {
  const [quoteOpen, setQuoteOpen] = useState(false);
  const p = useLiveProduct(raw);
  const computedAvailability = getProductAvailability(p);
  const availability = {
    ...computedAvailability,
    status: p.listingAvailabilityStatus ?? computedAvailability.status,
    label: p.listingAvailabilityLabel ?? computedAvailability.label,
    priority: p.listingAvailabilityPriority ?? computedAvailability.priority,
    hasValidPrice: p.listingHasValidPrice ?? computedAvailability.hasValidPrice,
    minPrice: p.priceFrom ?? computedAvailability.minPrice,
    maxPrice: p.priceTo ?? computedAvailability.maxPrice,
  };
  const repVariant = availability.availableVariants.find((v) => isValidPrice(v.price))
    ?? availability.orderableVariants.find((v) => isValidPrice(v.price))
    ?? p.variants[0];
  const showOld = repVariant?.oldPrice != null && repVariant.price != null && repVariant.oldPrice > repVariant.price;
  const isRange = availability.maxPrice != null && availability.minPrice != null && availability.maxPrice > availability.minPrice;
  const statusClass = availability.status === "in_stock" || availability.status === "partial"
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : availability.status === "order"
      ? "bg-amber-50 text-amber-700 ring-amber-200"
      : "bg-steel-100 text-steel-600 ring-steel-200";

  const impressionTracked = useRef(false);
  useEffect(() => {
    if (!impressionTracked.current && repVariant) {
      impressionTracked.current = true;
      trackEcommerce("impressions", [ecommerceProduct(p, repVariant, "catalog")]);
    }
  }, [p, repVariant]);

  return (
    <>
      {p.discountPct ? (
        <span className="absolute left-3 top-3 z-10 rounded-sm bg-amber-400 px-1.5 py-0.5 text-[10px] font-extrabold tracking-wider text-steel-900 shadow-amber">
          −{p.discountPct}%
        </span>
      ) : null}

      <div className="text-[12px]">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-bold ring-1 ${statusClass}`}>
          <span className={`h-2 w-2 rounded-full ${availability.status === "in_stock" || availability.status === "partial" ? "bg-emerald-500" : "bg-amber-400"}`} />
          {availability.label}
        </span>
      </div>

      <div className="mt-auto flex items-end justify-between gap-2 pt-2 sm:gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5 sm:gap-2">
            {isRange && <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-steel-500">от</span>}
            {availability.minPrice != null ? (
              <span className="font-display text-[18px] font-bold leading-none tracking-tight text-steel-900 sm:text-[22px]">
                {fmt.format(availability.minPrice)}<span className="ml-0.5 text-[13px] text-steel-500 sm:text-[14px]">₽</span>
              </span>
            ) : (
              <span className="font-display text-[15px] font-bold leading-none text-steel-700 sm:text-[18px]">
                по запросу
              </span>
            )}
          </div>
          {showOld && repVariant?.oldPrice && (
            <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] sm:text-[12px]">
              <span className="text-steel-400 line-through">{fmt.format(repVariant.oldPrice)} ₽</span>
              <span className="hidden rounded-sm bg-amber-100 px-1 text-[10.5px] font-bold uppercase text-amber-800 sm:inline">
                выгодно
              </span>
            </div>
          )}
          <div className="mt-1 text-[10.5px] font-semibold text-steel-500">Цена с НДС</div>
        </div>
        <div className="flex shrink-0 gap-1.5">
          {repVariant && availability.status !== "unavailable" && (
            <AddToCartButton variantId={repVariant.id} ecommerceItem={ecommerceProduct(p, repVariant, "catalog")} className="!h-11 !w-11 sm:!h-9 sm:!w-9" disabled={!repVariant.available} />
          )}
          <Link href={href} onClick={() => repVariant && trackEcommerce("click", [ecommerceProduct(p, repVariant, "catalog")])} aria-label="Открыть товар" className="grid h-11 w-11 place-items-center rounded-md bg-amber-400 text-steel-900 shadow-amber transition hover:-translate-y-0.5 hover:bg-amber-300 sm:h-9 sm:w-9">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
          </Link>
        </div>
      </div>
      <button type="button" onClick={() => setQuoteOpen(true)} className="mt-2 inline-flex min-h-11 items-center justify-center rounded-md border border-steel-200 px-3 py-2 text-[11.5px] font-bold text-steel-700 transition hover:border-amber-300 hover:bg-amber-50 sm:min-h-0">
        Получить КП
      </button>
      {repVariant && (
        <OneClickModal
          open={quoteOpen}
          onClose={() => setQuoteOpen(false)}
          product={p}
          variant={repVariant}
          intent="quote"
        />
      )}
    </>
  );
}
