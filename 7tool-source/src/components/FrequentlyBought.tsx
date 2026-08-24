"use client";

import { useState } from "react";
import Link from "next/link";
import type { Product, Variant } from "@/lib/data";
import { fmtPrice, products } from "@/lib/data";
import { ProductImage } from "./ProductImage";
import { useCart } from "@/lib/cart";

export function FrequentlyBought({ product, variant }: { product: Product; variant: Variant }) {
  // Резолвим accessory: коды в YML (codes/ids) — попробуем найти продукт по коду или id
  let extras: Product[] = [];
  if (product.accessories?.length) {
    const codes = new Set(product.accessories);
    extras = products.filter((p) =>
      codes.has(p.id) || p.variants.some((v) => codes.has(v.id) || codes.has(v.sku))
    );
  }
  // Fallback: 2 топовых других продукта в той же категории
  if (extras.length === 0) {
    extras = products
      .filter((p) => p.category === product.category && p.id !== product.id && p.priceFrom != null)
      .slice(0, 2);
  }
  extras = extras.slice(0, 3);

  const baseV = variant;
  const items = [
    { product, variant: baseV, locked: true },
    ...extras.map((p) => ({
      product: p,
      variant: p.variants.find((v) => v.price != null) ?? p.variants[0],
      locked: false,
    })),
  ];

  const [picked, setPicked] = useState<Record<string, boolean>>(
    Object.fromEntries(items.map((it) => [it.variant.id, true])),
  );
  const { add } = useCart();

  if (items.length < 2) return null;

  const checkedItems = items.filter((it) => picked[it.variant.id]);
  const total = checkedItems.reduce((sum, it) => sum + (it.variant.price ?? 0), 0);
  const hasUnpriced = checkedItems.some((it) => it.variant.price == null);

  const addAll = () => {
    for (const it of checkedItems) {
      if (!it.locked) add(it.variant.id, 1);
    }
    add(baseV.id, 1);
  };

  return (
    <section className="mt-12 rounded-[18px] border border-steel-200 bg-gradient-to-br from-steel-50/60 via-white to-amber-50/40 p-6 shadow-card">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700">
        <span className="h-px w-6 bg-amber-400" />
        Часто покупают вместе
      </div>
      <h2 className="mt-2 font-display text-[22px] font-extrabold text-steel-900">
        Возьмите комплектом и сэкономьте на доставке
      </h2>

      <div className="mt-6 grid items-stretch gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="flex flex-wrap items-stretch gap-3">
          {items.map((it, i) => (
            <div key={it.variant.id} className="flex items-center gap-2">
              <article className={`relative w-[200px] overflow-hidden rounded-[14px] border bg-white p-3 shadow-soft transition ${picked[it.variant.id] ? "border-amber-300 shadow-amber" : "border-steel-200 opacity-70"}`}>
                <label className="absolute right-2 top-2 z-10 inline-flex cursor-pointer items-center gap-1 rounded-md bg-white/95 px-2 py-1 text-[11px] font-bold text-steel-700 ring-1 ring-steel-200">
                  <input
                    type="checkbox"
                    checked={!!picked[it.variant.id]}
                    onChange={(e) => setPicked((prev) => ({ ...prev, [it.variant.id]: e.target.checked }))}
                    disabled={it.locked}
                    className="h-3.5 w-3.5 rounded border-steel-300 text-amber-500"
                  />
                  {it.locked ? "этот товар" : "взять"}
                </label>
                <Link href={`/p/${it.product.slug}`} className="block">
                  <div className="overflow-hidden rounded-md border border-steel-100">
                    <ProductImage p={it.product} className="aspect-square" sizes="180px" />
                  </div>
                  <div className="mt-2 text-[10.5px] font-bold uppercase tracking-wider text-amber-700">
                    {it.product.brand}
                  </div>
                  <div className="line-clamp-2 min-h-[36px] text-[12.5px] font-semibold text-steel-900">
                    {it.product.title}
                  </div>
                  <div className="mt-1 font-display text-[14px] font-extrabold text-steel-900">
                    {it.variant.price != null ? fmtPrice(it.variant.price) : "по запросу"}
                  </div>
                </Link>
              </article>
              {i < items.length - 1 && (
                <span className="hidden text-[24px] font-extrabold text-amber-500 sm:block" aria-hidden>
                  +
                </span>
              )}
            </div>
          ))}
        </div>

        <aside className="rounded-[14px] border border-amber-300 bg-white p-5 shadow-card lg:w-[280px]">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700">
            Итого комплектом
          </div>
          {total > 0 ? (
            <div className="mt-1 font-display text-[28px] font-extrabold leading-none text-steel-900">
              {fmtPrice(total)}
            </div>
          ) : (
            <div className="mt-1 font-display text-[20px] font-extrabold text-steel-900">по запросу</div>
          )}
          {hasUnpriced && total > 0 && (
            <div className="mt-1 text-[11.5px] text-amber-700">+ позиции по запросу — рассчитаем в КП</div>
          )}
          <div className="mt-1 text-[12px] text-steel-500">
            Выбрано: <span className="font-bold text-steel-900">{checkedItems.length}</span> из {items.length}
          </div>
          <button
            onClick={addAll}
            disabled={checkedItems.length < 2}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-amber-400 px-4 py-3 text-[13.5px] font-bold text-steel-900 shadow-amber transition hover:-translate-y-0.5 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Добавить комплект в корзину
          </button>
        </aside>
      </div>
    </section>
  );
}
