"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Product } from "@/lib/catalog";
import { useFavorites } from "@/lib/favorites";
import { ProductCard } from "@/components/ProductCard";

export function FavoritesView() {
  const { ids, count } = useFavorites();
  const idsKey = ids.join(",");
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    if (!idsKey) {
      setItems([]);
      setLoading(false);
      return () => controller.abort();
    }
    setLoading(true);
    fetch(`/api/favorites?ids=${encodeURIComponent(idsKey)}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
      .then((data: { items?: Product[] }) => setItems(data.items ?? []))
      .catch(() => {
        if (!controller.signal.aborted) setItems([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [idsKey]);

  return (
    <section className="bg-white py-10">
      <div className="mx-auto max-w-[1280px] px-6">
        <div className="mb-5 text-[13px] font-semibold text-steel-500">
          Сохранено: <span className="text-steel-900">{count}</span>
        </div>
        {loading && items.length === 0 ? (
          <div className="py-14 text-center text-[14px] text-steel-500">Загружаем избранное…</div>
        ) : items.length === 0 ? (
          <div className="mx-auto max-w-[560px] rounded-[var(--radius-card)] border border-dashed border-steel-200 bg-steel-50/40 px-8 py-14 text-center">
            <h2 className="font-display text-[20px] font-extrabold text-steel-900">В избранном пока пусто</h2>
            <p className="mt-2 text-[14px] text-steel-600">Нажмите на сердечко в карточке товара — позиция появится здесь.</p>
            <Link href="/c/koronchatye-sverla" className="mt-6 inline-flex rounded-md bg-amber-400 px-5 py-3 text-[13.5px] font-bold text-steel-900 shadow-amber">
              Открыть каталог
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((product) => <ProductCard key={product.id} p={product} />)}
          </div>
        )}
      </div>
    </section>
  );
}
