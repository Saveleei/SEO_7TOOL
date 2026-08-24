"use client";

// Клиентский слой live-цен/наличия. Все id, запрошенные в одном рендере страницы,
// батчатся в один fetch к /api/live, результат кэшируется в module-Map.
// До ответа (и при ошибке/SSR) компоненты показывают «запечённые» в сборку значения.
//
// На проводе ходят только хеши id (см. live-hash.ts), а наличие — булевым (inStock).
// Кэши заведены ПО ХЕШУ — ключ ответа кладём напрямую, обратное сопоставление не нужно.
import { useEffect, useMemo, useState } from "react";
import type { Product } from "./catalog";
import { hashId } from "./live-hash";

export type LiveVariant = { price?: number; oldPrice?: number; available: boolean; inStock: boolean };
export type LiveProduct = { inStock: boolean; priceFrom?: number; priceTo?: number; discountPct?: number };

const pCache = new Map<string, LiveProduct>(); // ключ = hashId(productId)
const vCache = new Map<string, LiveVariant>(); // ключ = hashId(variantId)
let pendP = new Set<string>(); // pending hash'и товаров
let pendV = new Set<string>(); // pending hash'и вариантов
let scheduled = false;
let version = 0; // растёт после каждого ответа — триггер для useMemo
const subs = new Set<() => void>();

function schedule() {
  if (scheduled) return;
  scheduled = true;
  setTimeout(flush, 0); // собрать все id текущего рендера в один запрос
}

async function flush() {
  scheduled = false;
  const p = [...pendP];
  const v = [...pendV];
  pendP = new Set();
  pendV = new Set();
  if (!p.length && !v.length) return;
  const qs = new URLSearchParams();
  if (p.length) qs.set("p", p.join(","));
  if (v.length) qs.set("v", v.join(","));
  try {
    const res = await fetch(`/api/live?${qs.toString()}`);
    if (res.ok) {
      const j = (await res.json()) as { products: Record<string, LiveProduct>; variants: Record<string, LiveVariant> };
      for (const [h, val] of Object.entries(j.products)) pCache.set(h, val);
      for (const [h, val] of Object.entries(j.variants)) vCache.set(h, val);
    }
  } catch {
    // офлайн/ошибка — остаёмся на запечённых значениях
  }
  version++;
  for (const fn of subs) fn();
}

function useLiveTick() {
  const [, force] = useState(0);
  useEffect(() => {
    const cb = () => force((x) => x + 1);
    subs.add(cb);
    return () => {
      subs.delete(cb);
    };
  }, []);
}

// Возвращает копию товара с подменёнными ценой/наличием (вариантов и агрегатов).
// inStock → числовой sentinel (1/0), чтобы вся существующая логика `> 0` работала без правок.
// Идентичность результата стабильна между ответами — downstream useMemo/effect не зациклятся.
export function useLiveProduct(p: Product): Product {
  useLiveTick();
  const ph = hashId(p.id);
  useEffect(() => {
    if (!pCache.has(ph)) {
      pendP.add(ph);
      schedule();
    }
  }, [ph]);
  return useMemo(() => {
    const lp = pCache.get(ph);
    const anyV = p.variants.some((v) => vCache.has(hashId(v.id)));
    if (!lp && !anyV) return p; // ничего live ещё нет — отдаём исходный товар как есть
    const variants = p.variants.map((v) => {
      const lv = vCache.get(hashId(v.id));
      return lv
        ? { ...v, price: lv.price, oldPrice: lv.oldPrice, available: lv.available, quantity: lv.inStock ? 1 : 0 }
        : v;
    });
    return {
      ...p,
      variants,
      stock: lp ? (lp.inStock ? 1 : 0) : p.stock,
      priceFrom: lp ? lp.priceFrom : p.priceFrom,
      priceTo: lp ? lp.priceTo : p.priceTo,
      discountPct: lp ? lp.discountPct : p.discountPct,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p, ph, version]);
}

// Live-данные по списку id вариантов (для корзины, где есть только variantId).
export function useLiveVariants(ids: string[]): Record<string, LiveVariant> {
  useLiveTick();
  const key = ids.join(",");
  useEffect(() => {
    let need = false;
    for (const id of ids) {
      const h = hashId(id);
      if (!vCache.has(h)) {
        pendV.add(h);
        need = true;
      }
    }
    if (need) schedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return useMemo(() => {
    const o: Record<string, LiveVariant> = {};
    for (const id of ids) {
      const r = vCache.get(hashId(id));
      if (r) o[id] = r;
    }
    return o;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version]);
}
