"use client";

import Image from "next/image";
import Link from "next/link";
import { Fragment, useState, type CSSProperties } from "react";
import type { FeedProductCardModel, FeedProductVariantModel } from "../data/feedCatalog";
import { AddRequestButton } from "./RequestCart";
import { FeedAvailability } from "./FeedAvailability";

export function FeedProductTable({ products, columns }: { products: FeedProductCardModel[]; columns: string[] }) {
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  function toggleProduct(id: string) {
    setExpandedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return <>
    <div className="feed-product-table-wrap">
      <table className="feed-product-table">
        <thead><tr><th>Товарная серия</th>{columns.map((column) => <th key={column}>{column}</th>)}<th>Цена</th><th><span className="visually-hidden">Действия</span></th></tr></thead>
        <tbody>{products.map((product) => {
          const expanded = expandedIds.includes(product.id);
          return <Fragment key={product.id}>
            <tr className={expanded ? "feed-product-row feed-product-row--expanded" : "feed-product-row"}>
              <td><div className="feed-table-product">{product.image && <Link href={`/product/${product.slug}`} tabIndex={-1} aria-hidden="true"><Image src={product.image} alt="" width={86} height={74} unoptimized /></Link>}<div><span>{product.brand}{product.sku ? ` · серия ${product.sku}` : ""}</span><Link href={`/product/${product.slug}`}>{product.title}</Link><small>{variantLabel(product.selectedVariantCount)}{product.selectedVariantCount !== product.variantCount ? ` из ${product.variantCount}` : ""}</small></div></div></td>
              {columns.map((column) => <td key={column}><span className="feed-table-cell-label">{column}</span>{product.specs.find((spec) => spec.label === column)?.value ?? "—"}</td>)}
              <td className="feed-table-price"><b>{product.price}</b><small>{product.variantCount > 1 ? "зависит от исполнения" : "с НДС · подтвердим в КП"}</small><FeedAvailability available={product.availableVariantCount > 0} count={product.availableVariantCount} /></td>
              <td><div className="feed-table-actions"><button className="feed-variant-toggle" type="button" aria-expanded={expanded} aria-controls={`variants-${product.id}`} onClick={() => toggleProduct(product.id)}>{expanded ? "Скрыть исполнения" : product.selectedVariantCount > 1 ? `Выбрать исполнение · ${product.selectedVariantCount}` : "Выбрать исполнение"}</button><a className="feed-all-characteristics" href={`/product/${product.slug}`} aria-label={`Все характеристики: ${product.title}`}>Все характеристики</a></div></td>
            </tr>
            {expanded && <tr className="feed-variant-expansion"><td colSpan={columns.length + 3} id={`variants-${product.id}`}>
              <div className="feed-variant-expansion-head"><div><b>Точные исполнения</b><span>Выберите размер и добавьте конкретную позицию в запрос КП</span></div>{product.variantCount > product.variants.length && <Link href={`/product/${product.slug}`}>Все {product.variantCount} исполнений →</Link>}</div>
              <div className="feed-inline-variants">{product.variants.map((variant) => <InlineVariant product={product} variant={variant} columns={columns} key={variant.id} />)}</div>
            </td></tr>}
          </Fragment>;
        })}</tbody>
      </table>
      <p className="feed-table-note">Цена указана по тестовым данным поставщика. Наличие, срок и совместимость подтверждаем для выбранного исполнения в КП.</p>
    </div>
    <div className="feed-product-table-mobile">{products.map((product) => <MobileSeries product={product} columns={columns} key={product.id} />)}</div>
  </>;
}

function MobileSeries({ product, columns }: { product: FeedProductCardModel; columns: string[] }) {
  return <details className="feed-mobile-series">
    <summary>
      <div className="feed-mobile-series-head">{product.image && <Image src={product.image} alt="" width={92} height={78} unoptimized />}<div><span>{product.brand}{product.sku ? ` · ${product.sku}` : ""}</span><b>{product.title}</b><small>{variantLabel(product.selectedVariantCount)}{product.selectedVariantCount !== product.variantCount ? ` из ${product.variantCount}` : ""}</small></div></div>
      <dl>{columns.map((column) => <div key={column}><dt>{column}</dt><dd>{product.specs.find((spec) => spec.label === column)?.value ?? "—"}</dd></div>)}</dl>
      <div className="feed-mobile-series-commercial"><div><b>{product.price}</b><FeedAvailability available={product.availableVariantCount > 0} /></div><i>{product.selectedVariantCount > 1 ? `Выбрать · ${product.selectedVariantCount}` : "Выбрать"}</i></div>
    </summary>
    <div className="feed-mobile-variants"><div className="feed-variant-expansion-head"><div><b>Точные исполнения</b><span>Добавьте нужный размер в запрос КП</span></div></div>{product.variants.map((variant) => <article className={variant.matchesSelection ? "feed-mobile-variant feed-mobile-variant--match" : "feed-mobile-variant"} key={variant.id}>
      <div><span>{variant.matchesSelection ? "Соответствует фильтрам" : "Исполнение"}</span><a className="feed-variant-sku-link" href={`/product/${product.slug}?variant=${encodeURIComponent(variant.id)}#variants`}>{variant.sku}</a></div>
      <dl>{columns.map((column) => <div key={column}><dt>{column}</dt><dd>{variant.specs.find((spec) => spec.label === column)?.value ?? "—"}</dd></div>)}</dl>
      <div className="feed-mobile-variant-action"><div><b>{variant.price}</b><FeedAvailability available={variant.available} exact /></div><AddRequestButton item={{ id:`variant:${variant.id}`, title:variant.title || product.title, article:`Артикул ${variant.sku}`, price:variant.price }}>Добавить в запрос</AddRequestButton></div>
    </article>)}{product.variantCount > product.variants.length && <Link className="feed-mobile-all-variants" href={`/product/${product.slug}`}>Все {product.variantCount} исполнений →</Link>}</div>
  </details>;
}

function InlineVariant({ product, variant, columns }: { product: FeedProductCardModel; variant: FeedProductVariantModel; columns: string[] }) {
  return <article className={variant.matchesSelection ? "feed-inline-variant feed-inline-variant--match" : "feed-inline-variant"} style={{ "--variant-spec-count":Math.max(1, columns.length) } as CSSProperties}>
    <div className="feed-inline-variant-id"><span>{variant.matchesSelection ? "Соответствует фильтрам" : "Исполнение"}</span><a className="feed-variant-sku-link" href={`/product/${product.slug}?variant=${encodeURIComponent(variant.id)}#variants`}>{variant.sku}</a></div>
    {columns.map((column) => <div key={column}><span>{column}</span><b>{variant.specs.find((spec) => spec.label === column)?.value ?? "—"}</b></div>)}
    <div className="feed-inline-variant-price"><b>{variant.price}</b><span>с НДС · данные поставщика</span><FeedAvailability available={variant.available} exact /></div>
    <AddRequestButton item={{ id:`variant:${variant.id}`, title:variant.title || product.title, article:`Артикул ${variant.sku}`, price:variant.price }}>Добавить в запрос</AddRequestButton>
  </article>;
}

function variantLabel(count: number): string {
  if (count === 1) return "Одно исполнение";
  const modulo100 = count % 100;
  const modulo10 = count % 10;
  const word = modulo100 >= 11 && modulo100 <= 14 ? "исполнений" : modulo10 >= 2 && modulo10 <= 4 ? "исполнения" : "исполнений";
  return `${count} ${word} · раскройте для выбора`;
}
