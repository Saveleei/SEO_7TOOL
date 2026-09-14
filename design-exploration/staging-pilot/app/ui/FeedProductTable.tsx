"use client";

import Image from "next/image";
import Link from "next/link";
import { Fragment, useState, type CSSProperties } from "react";
import { pluralizeCardVariants } from "../data/categoryCardArchetypes.mjs";
import type { FeedProductCardModel, FeedProductVariantModel } from "../data/feedCatalog";
import { AddRequestButton } from "./RequestCart";
import { FeedAvailability } from "./FeedAvailability";

export function FeedProductTable({ products, columns }: { products: FeedProductCardModel[]; columns: string[] }) {
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const tableIdentity = products[0]?.cardArchetype.tableIdentity ?? "Товарная серия";

  function toggleProduct(id: string) {
    setExpandedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return <>
    <div className="feed-product-table-wrap">
      <table className="feed-product-table">
        <thead><tr><th>{tableIdentity}</th>{columns.map((column) => <th key={column}>{column}</th>)}<th>Цена</th><th><span className="visually-hidden">Действия</span></th></tr></thead>
        <tbody>{products.map((product) => {
          const expanded = expandedIds.includes(product.id);
          const directVariant = product.selectedVariantCount === 1 ? product.variants[0] : undefined;
          return <Fragment key={product.id}>
            <tr className={`${expanded ? "feed-product-row feed-product-row--expanded" : "feed-product-row"} feed-product-row--${product.cardArchetype.id}`}>
              <td><div className={product.image ? "feed-table-product" : "feed-table-product feed-table-product--no-image"}>{product.image && <Link href={`/product/${product.slug}`} tabIndex={-1} aria-hidden="true"><Image src={product.image} alt="" width={86} height={74} unoptimized /></Link>}<div><em>{product.cardArchetype.badge}</em><span>{product.brand}{product.sku ? ` · серия ${product.sku}` : ""}</span><Link href={`/product/${product.slug}`}>{product.title}</Link><small>{variantLabel(product.selectedVariantCount, product.cardArchetype.variantForms)}{product.selectedVariantCount !== product.variantCount ? ` из ${product.variantCount}` : ""}</small>{product.matchReasons.length > 0 && <div className="feed-table-match">Подходит: {product.matchReasons.join(" · ")}</div>}</div></div></td>
              {columns.map((column) => <td key={column}><span className="feed-table-cell-label">{column}</span>{product.specs.find((spec) => spec.label === column)?.value ?? "—"}</td>)}
              <td className="feed-table-price"><b>{product.price}</b><small>{product.price === "Цена по запросу" || product.variantCount > 1 ? product.cardArchetype.priceRequestNote : "с НДС · подтвердим в КП"}</small><FeedAvailability shippingPromise={product.shippingPromise} count={product.availableVariantCount} /></td>
              <td><div className="feed-table-actions">{directVariant ? <AddRequestButton item={{ id:`variant:${directVariant.id}`, title:directVariant.title || product.title, article:variantArticle(directVariant.sku), price:directVariant.price, image:directVariant.image, href:directVariant.href, shippingLabel:directVariant.shippingPromise.label, shippingDetail:directVariant.shippingPromise.detail }}>{product.cardArchetype.singleAction}</AddRequestButton> : <button className="feed-variant-toggle" type="button" aria-expanded={expanded} aria-controls={`variants-${product.id}`} onClick={() => toggleProduct(product.id)}>{expanded ? "Скрыть варианты" : `${product.cardArchetype.multipleAction} · ${product.selectedVariantCount}`}</button>}<a className="feed-all-characteristics" href={`/product/${product.slug}`} aria-label={`${product.cardArchetype.detailAction}: ${product.title}`}>{product.cardArchetype.detailAction}</a></div></td>
            </tr>
            {!directVariant && expanded && <tr className="feed-variant-expansion"><td colSpan={columns.length + 3} id={`variants-${product.id}`}>
              <div className="feed-variant-expansion-head"><div><b>{product.cardArchetype.multipleAction}</b><span>Добавьте в КП только одну точную позицию</span></div>{product.variantCount > product.variants.length && <Link href={`/product/${product.slug}`}>Все {pluralizeCardVariants(product.variantCount, product.cardArchetype.variantForms)} →</Link>}</div>
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
  const directVariant = product.selectedVariantCount === 1 ? product.variants[0] : undefined;
  if (directVariant) return <article className={`feed-mobile-series feed-mobile-series--direct feed-mobile-series--${product.cardArchetype.id}`}>
    <div className={product.image ? "feed-mobile-series-head" : "feed-mobile-series-head feed-mobile-series-head--no-image"}>{product.image && <Image src={product.image} alt="" width={92} height={78} unoptimized />}<div><em>{product.cardArchetype.badge}</em><span>{product.brand}{product.sku ? ` · ${product.sku}` : ""}</span><Link href={`/product/${product.slug}`}>{product.title}</Link><small>{variantLabel(1, product.cardArchetype.variantForms)}</small></div></div>
    <dl>{columns.map((column) => <div key={column}><dt>{column}</dt><dd>{product.specs.find((spec) => spec.label === column)?.value ?? "—"}</dd></div>)}</dl>
    <div className="feed-mobile-series-commercial"><div><b>{product.price}</b><FeedAvailability shippingPromise={product.shippingPromise} /></div><AddRequestButton item={{ id:`variant:${directVariant.id}`, title:directVariant.title || product.title, article:variantArticle(directVariant.sku), price:directVariant.price, image:directVariant.image, href:directVariant.href, shippingLabel:directVariant.shippingPromise.label, shippingDetail:directVariant.shippingPromise.detail }}>{product.cardArchetype.singleAction}</AddRequestButton></div>
    <Link className="feed-mobile-all-variants" href={`/product/${product.slug}`}>{product.cardArchetype.detailAction} →</Link>
  </article>;

  return <details className="feed-mobile-series">
    <summary>
      <div className={product.image ? "feed-mobile-series-head" : "feed-mobile-series-head feed-mobile-series-head--no-image"}>{product.image && <Image src={product.image} alt="" width={92} height={78} unoptimized />}<div><em>{product.cardArchetype.badge}</em><span>{product.brand}{product.sku ? ` · ${product.sku}` : ""}</span><b>{product.title}</b><small>{variantLabel(product.selectedVariantCount, product.cardArchetype.variantForms)}{product.selectedVariantCount !== product.variantCount ? ` из ${product.variantCount}` : ""}</small></div></div>
      <dl>{columns.map((column) => <div key={column}><dt>{column}</dt><dd>{product.specs.find((spec) => spec.label === column)?.value ?? "—"}</dd></div>)}</dl>
      <div className="feed-mobile-series-commercial"><div><b>{product.price}</b><FeedAvailability shippingPromise={product.shippingPromise} /></div><i>{product.cardArchetype.multipleAction} · {product.selectedVariantCount}</i></div>
    </summary>
    <div className="feed-mobile-variants"><div className="feed-variant-expansion-head"><div><b>{product.cardArchetype.multipleAction}</b><span>Добавьте нужную позицию в запрос КП</span></div></div>{product.variants.map((variant) => <article className={variant.matchesSelection ? "feed-mobile-variant feed-mobile-variant--match" : "feed-mobile-variant"} key={variant.id}>
      <div><span>{variant.matchesSelection ? "Соответствует фильтрам" : capitalize(product.cardArchetype.variantForms[0])}</span><a className="feed-variant-sku-link" href={`/product/${product.slug}?variant=${encodeURIComponent(variant.id)}#variants`}>{variant.sku || "Без артикула в фиде"}</a></div>
      <dl>{columns.map((column) => <div key={column}><dt>{column}</dt><dd>{variant.specs.find((spec) => spec.label === column)?.value ?? "—"}</dd></div>)}</dl>
      <div className="feed-mobile-variant-action"><div><b>{variant.price}</b><FeedAvailability shippingPromise={variant.shippingPromise} exact /></div><AddRequestButton item={{ id:`variant:${variant.id}`, title:variant.title || product.title, article:variantArticle(variant.sku), price:variant.price, image:variant.image, href:variant.href, shippingLabel:variant.shippingPromise.label, shippingDetail:variant.shippingPromise.detail }}>{product.cardArchetype.singleAction}</AddRequestButton></div>
    </article>)}{product.variantCount > product.variants.length && <Link className="feed-mobile-all-variants" href={`/product/${product.slug}`}>Все {pluralizeCardVariants(product.variantCount, product.cardArchetype.variantForms)} →</Link>}</div>
  </details>;
}

function InlineVariant({ product, variant, columns }: { product: FeedProductCardModel; variant: FeedProductVariantModel; columns: string[] }) {
  return <article className={variant.matchesSelection ? "feed-inline-variant feed-inline-variant--match" : "feed-inline-variant"} style={{ "--variant-spec-count":Math.max(1, columns.length) } as CSSProperties}>
    <div className="feed-inline-variant-id"><span>{variant.matchesSelection ? "Соответствует фильтрам" : capitalize(product.cardArchetype.variantForms[0])}</span><a className="feed-variant-sku-link" href={`/product/${product.slug}?variant=${encodeURIComponent(variant.id)}#variants`}>{variant.sku || "Без артикула в фиде"}</a></div>
    {columns.map((column) => <div key={column}><span>{column}</span><b>{variant.specs.find((spec) => spec.label === column)?.value ?? "—"}</b></div>)}
    <div className="feed-inline-variant-price"><b>{variant.price}</b><span>с НДС · данные поставщика</span><FeedAvailability shippingPromise={variant.shippingPromise} exact /></div>
    <AddRequestButton item={{ id:`variant:${variant.id}`, title:variant.title || product.title, article:variantArticle(variant.sku), price:variant.price, image:variant.image, href:variant.href, shippingLabel:variant.shippingPromise.label, shippingDetail:variant.shippingPromise.detail }}>{product.cardArchetype.singleAction}</AddRequestButton>
  </article>;
}

function variantLabel(count: number, forms: [string, string, string]): string {
  return count === 1 ? pluralizeCardVariants(count, forms) : `${pluralizeCardVariants(count, forms)} · раскройте для выбора`;
}

function variantArticle(sku: string): string {
  return sku ? `Артикул ${sku}` : "Артикул не указан в фиде";
}

function capitalize(value: string): string {
  return value.charAt(0).toLocaleUpperCase("ru-RU") + value.slice(1);
}
