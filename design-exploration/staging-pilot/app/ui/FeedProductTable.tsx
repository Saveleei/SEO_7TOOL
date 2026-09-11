"use client";

import Image from "next/image";
import Link from "next/link";
import type { FeedProductCardModel } from "../data/feedCatalog";
import { FeedProductList } from "./FeedProductList";
import { AddRequestButton } from "./RequestCart";

export function FeedProductTable({ products, columns }: { products: FeedProductCardModel[]; columns: string[] }) {
  return <>
    <div className="feed-product-table-wrap">
      <table className="feed-product-table">
        <thead><tr><th>Товар</th>{columns.map((column) => <th key={column}>{column}</th>)}<th>Цена</th><th><span className="visually-hidden">Действия</span></th></tr></thead>
        <tbody>{products.map((product) => <tr key={product.id}>
          <td><div className="feed-table-product">{product.image && <Link href={`/product/${product.slug}`} tabIndex={-1} aria-hidden="true"><Image src={product.image} alt="" width={74} height={62} unoptimized /></Link>}<div><span>{product.brand}{product.sku ? ` · ${product.sku}` : ""}</span><Link href={`/product/${product.slug}`}>{product.title}</Link><small>{variantLabel(product.variantCount)}</small></div></div></td>
          {columns.map((column) => <td key={column}>{product.specs.find((spec) => spec.label === column)?.value ?? "—"}</td>)}
          <td><b>{product.price}</b><small>с НДС · подтвердим в КП</small></td>
          <td><div className="feed-table-actions"><AddRequestButton item={{ id:product.id, title:product.title, article:product.sku ? `Артикул ${product.sku}` : "Товарная группа", price:product.price }}>В запрос КП</AddRequestButton><Link href={`/product/${product.slug}`}>Подробнее</Link></div></td>
        </tr>)}</tbody>
      </table>
      <p className="feed-table-note">Наличие, срок и совместимость подтверждаем для конкретного исполнения в КП.</p>
    </div>
    <div className="feed-product-table-mobile"><FeedProductList products={products} /></div>
  </>;
}

function variantLabel(count: number): string {
  if (count === 1) return "Одно исполнение";
  const modulo100 = count % 100;
  const modulo10 = count % 10;
  const word = modulo100 >= 11 && modulo100 <= 14 ? "исполнений" : modulo10 >= 2 && modulo10 <= 4 ? "исполнения" : "исполнений";
  return `${count} ${word}`;
}
