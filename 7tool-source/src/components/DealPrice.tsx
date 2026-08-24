"use client";

import type { Product } from "@/lib/catalog";
import { fmtPrice } from "@/lib/catalog";
import { useLiveProduct } from "@/lib/live";

// Цена/наличие товара-героя на главной — live из /api/live.
export function DealPrice({ p: raw }: { p: Product }) {
  const p = useLiveProduct(raw);
  const repVariant = p.variants.find((v) => v.price != null) ?? p.variants[0];
  const old = repVariant?.oldPrice;
  const price = repVariant?.price;
  const isRange = p.priceTo != null && p.priceFrom != null && p.priceTo > p.priceFrom;

  return (
    <>
      <div className="mt-1 flex flex-wrap items-end gap-x-3 gap-y-1">
        {old && price && old > price && (
          <span className="text-[14px] text-steel-400 line-through">{fmtPrice(old)}</span>
        )}
        <span className="font-display text-[28px] font-black leading-none text-steel-900">
          {isRange ? "от " : ""}{price != null ? fmtPrice(price) : "по запросу"}
        </span>
      </div>

      <div className="text-[12.5px] text-steel-600">
        {p.stock > 0 ? "В наличии · отгрузка со склада" : "Под заказ · согласуем срок"}
      </div>
    </>
  );
}
