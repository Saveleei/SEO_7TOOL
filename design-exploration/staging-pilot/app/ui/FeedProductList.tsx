"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { FeedProductCardModel } from "../data/feedCatalog";
import { FeedProductCard } from "./FeedProductCard";

export function FeedProductList({ products, directSingleVariant = false }: { products: FeedProductCardModel[]; directSingleVariant?: boolean }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const selected = useMemo(() => products.filter((product) => selectedIds.includes(product.id)), [products, selectedIds]);

  function toggleProduct(id: string) {
    setCompareOpen(false);
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 4 ? [...current, id] : current);
  }

  function openComparison() {
    setCompareOpen(true);
    window.setTimeout(() => document.querySelector("#feed-comparison")?.scrollIntoView({ behavior:"smooth", block:"start" }), 0);
  }

  const specLabels = Array.from(new Set(selected.flatMap((product) => product.specs.map((spec) => spec.label))));

  return <>
    <div className="feed-product-grid">{products.map((product) => <FeedProductCard product={product} directSingleVariant={directSingleVariant} selected={selectedIds.includes(product.id)} onCompare={() => toggleProduct(product.id)} key={product.id} />)}</div>

    {compareOpen && selected.length >= 2 && <section className="feed-inline-comparison" id="feed-comparison" aria-label="Сравнение выбранных товаров">
      <header><div><span>Сравнение без ухода из категории</span><h2>{selected.length} товара рядом</h2></div><button type="button" onClick={() => setCompareOpen(false)}>Свернуть</button></header>
      <div className="feed-compare-scroll"><table><thead><tr><th>Параметр</th>{selected.map((product) => <th key={product.id}>{product.brand}<small>{product.title}</small></th>)}</tr></thead><tbody>
        <tr><th>Цена</th>{selected.map((product) => <td key={product.id}><b>{product.price}</b><small>подтвердим в КП</small></td>)}</tr>
        <tr><th>Исполнения</th>{selected.map((product) => <td key={product.id}>{product.variantCount}</td>)}</tr>
        {specLabels.map((label) => <tr key={label}><th>{label}</th>{selected.map((product) => <td key={product.id}>{product.specs.find((spec) => spec.label === label)?.value ?? "—"}</td>)}</tr>)}
        <tr><th>Действие</th>{selected.map((product) => <td key={product.id}><Link href={`/product/${product.slug}`}>Выбрать исполнение</Link></td>)}</tr>
      </tbody></table></div>
      <p>Сравнение помогает отобрать кандидатов. Совместимость, наличие и срок инженер подтверждает для конкретного исполнения.</p>
    </section>}

    {selected.length > 0 && <div className="feed-compare-tray" role="status"><div><b>Выбрано для сравнения: {selected.length}</b><span>{selected.map((product) => product.brand).join(" · ")}{selected.length === 4 ? " · максимум 4" : ""}</span></div><button type="button" disabled={selected.length < 2} onClick={openComparison}>{selected.length < 2 ? "Выберите ещё товар" : `Сравнить ${selected.length}`}</button><button type="button" onClick={() => { setSelectedIds([]); setCompareOpen(false); }} aria-label="Очистить сравнение">×</button></div>}
  </>;
}
