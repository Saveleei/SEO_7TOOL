"use client";

import Image from "next/image";
import Link from "next/link";
import { type ReactNode, useState } from "react";
import { pluralizeCardVariants } from "../data/categoryCardArchetypes.mjs";
import type { FeedProductCardModel, FeedProductVariantModel } from "../data/feedCatalog";
import { QuickOrderDialog } from "./QuickOrderDialog";
import { AddRequestButton } from "./RequestCart";
import { FeedAvailability } from "./FeedAvailability";
import { FeedProductCard } from "./FeedProductCard";
import { preloadVariantPickerItems, VariantPickerDialog, type VariantPickerItem } from "./VariantPickerDialog";
import { comparisonSelectionFromCard, useComparison } from "./Comparison";

export function FeedProductTable({ products, columns, after, mobileLayout = "list" }: { products: FeedProductCardModel[]; columns: string[]; after?: ReactNode; mobileLayout?: "list" | "grid" }) {
  const [pickerProductId, setPickerProductId] = useState("");
  const { hasProduct, toggle } = useComparison();
  const tableIdentity = products[0]?.cardArchetype.tableIdentity ?? "Товарная серия";
  const pickerProduct = products.find((product) => product.id === pickerProductId);
  const splitIndex = after ? Math.min(mobileLayout === "grid" ? 4 : 3, products.length) : products.length;
  const firstProducts = products.slice(0, splitIndex);
  const remainingProducts = products.slice(splitIndex);

  function renderRows(items: FeedProductCardModel[]) {
    return items.map((product) => {
      const directVariant = product.selectedVariantCount === 1 ? product.variants[0] : undefined;
      return <tr className={`feed-product-row feed-product-row--${product.cardArchetype.id}`} key={product.id}>
          <td><div className={product.image ? "feed-table-product" : "feed-table-product feed-table-product--no-image"}>{product.image && <Link href={`/p/${product.slug}`} tabIndex={-1} aria-hidden="true"><Image src={product.image} alt="" width={86} height={74} unoptimized /></Link>}<div><em>{product.cardArchetype.badge}</em><span>{product.brand}{product.sku ? ` · серия ${product.sku}` : ""}</span><Link href={`/p/${product.slug}`}>{product.title}</Link><small>{variantLabel(product.selectedVariantCount, product.cardArchetype.variantForms)}{product.selectedVariantCount !== product.variantCount ? ` из ${product.variantCount}` : ""}</small>{product.matchReasons.length > 0 && <div className="feed-table-match">Подходит: {product.matchReasons.join(" · ")}</div>}</div></div></td>
          {columns.map((column) => <td key={column}><span className="feed-table-cell-label">{column}</span>{product.specs.find((spec) => spec.label === column)?.value ?? "—"}</td>)}
          <td className="feed-table-price"><b>{product.price}</b><small>{product.variantCount > 1 ? "с НДС · зависит от исполнения" : "с НДС · подтвердим в КП"}</small><FeedAvailability shippingPromise={product.shippingPromise} count={product.availableVariantCount} /></td>
          <td><div className="feed-table-actions"><label className="feed-compare-check"><input type="checkbox" aria-label={`Сравнить ${product.title}`} checked={hasProduct(product.id)} onChange={() => toggle(comparisonSelectionFromCard(product), "category_table")} /> Сравнить</label>{directVariant ? <><AddRequestButton item={{ id:`variant:${directVariant.id}`, title:directVariant.title || product.title, article:variantArticle(directVariant.sku), price:directVariant.price, image:directVariant.image, href:directVariant.href, shippingLabel:directVariant.shippingPromise.label, shippingDetail:directVariant.shippingPromise.detail }}>Добавить в КП</AddRequestButton><QuickOrderDialog item={{ id:`variant:${directVariant.id}`, title:directVariant.title || product.title, article:variantArticle(directVariant.sku), price:directVariant.price, image:directVariant.image, href:directVariant.href, shippingLabel:directVariant.shippingPromise.label, shippingDetail:directVariant.shippingPromise.detail }} available={directVariant.shippingPromise.available} productId={product.id} variantId={directVariant.id} category={product.categorySlug} placement="category_table" pageType="category" /></> : <button className="feed-variant-toggle" type="button" aria-haspopup="dialog" onPointerEnter={() => warmProductVariants(product)} onPointerDown={() => warmProductVariants(product)} onFocus={() => warmProductVariants(product)} onClick={() => setPickerProductId(product.id)}>{product.cardArchetype.multipleAction} · {product.selectedVariantCount}</button>}<a className="feed-all-characteristics" href={`/p/${product.slug}`} aria-label={`${product.cardArchetype.detailAction}: ${product.title}`}>{product.cardArchetype.detailAction}</a></div></td>
        </tr>;
    });
  }

  function renderTable(items: FeedProductCardModel[], continuation = false) {
    if (items.length === 0) return null;
    return <div className={`feed-product-table-wrap${continuation ? " feed-product-table-wrap--continuation" : ""}`}>
      <table className="feed-product-table">
        <thead><tr><th>{tableIdentity}</th>{columns.map((column) => <th key={column}>{column}</th>)}<th>Цена</th><th><span className="visually-hidden">Действия</span></th></tr></thead>
        <tbody>{renderRows(items)}</tbody>
      </table>
      {!continuation && remainingProducts.length === 0 && <p className="feed-table-note">Цена указана по данным поставщика. Наличие, срок и совместимость подтверждаем для выбранного исполнения в КП.</p>}
      {continuation && <p className="feed-table-note">Цена указана по данным поставщика. Наличие, срок и совместимость подтверждаем для выбранного исполнения в КП.</p>}
    </div>;
  }

  const renderMobile = (items: FeedProductCardModel[]) => mobileLayout === "grid"
    ? <div className="feed-product-grid feed-product-grid--grid feed-product-grid--mobile-default">{items.map((product) => <FeedProductCard product={product} selected={hasProduct(product.id)} onCompare={() => toggle(comparisonSelectionFromCard(product), "category_mobile_grid")} key={product.id} />)}</div>
    : items.map((product) => <MobileSeries product={product} columns={columns} selected={hasProduct(product.id)} onCompare={() => toggle(comparisonSelectionFromCard(product), "category_mobile")} onWarmVariants={() => warmProductVariants(product)} onOpenVariants={() => setPickerProductId(product.id)} key={product.id} />);

  return <>
    {renderTable(firstProducts)}
    <div className={`feed-product-table-mobile feed-product-table-mobile--${mobileLayout}`}>{renderMobile(firstProducts)}</div>
    {after && <div className="category-feed-assistant">{after}</div>}
    {renderTable(remainingProducts, true)}
    {remainingProducts.length > 0 && <div className={`feed-product-table-mobile feed-product-table-mobile--${mobileLayout} feed-product-table-mobile--continuation`}>{renderMobile(remainingProducts)}</div>}
    {pickerProduct && <VariantPickerDialog open onClose={() => setPickerProductId("")} productId={pickerProduct.id} productTitle={pickerProduct.title} category={pickerProduct.categorySlug} pageType="category" placement="category_table_size_picker" items={toPickerItems(pickerProduct, columns)} totalVariantCount={pickerProduct.variantCount} fullProductHref={`/p/${pickerProduct.slug}`} variantsEndpoint={variantEndpoint(pickerProduct)} selectorLabel={isSizeLedProduct(pickerProduct, columns) ? "Размер" : "Исполнение"} />}
  </>;
}

function MobileSeries({ product, columns, selected, onCompare, onWarmVariants, onOpenVariants }: { product: FeedProductCardModel; columns: string[]; selected: boolean; onCompare: () => void; onWarmVariants: () => void; onOpenVariants: () => void }) {
  const directVariant = product.selectedVariantCount === 1 ? product.variants[0] : undefined;
  const compareControl = <label className="feed-mobile-compare"><input type="checkbox" aria-label={`Сравнить ${product.title}`} checked={selected} onChange={onCompare} /> {selected ? "В сравнении" : "Сравнить"}</label>;
  if (directVariant) return <article className={`feed-mobile-series feed-mobile-series--direct feed-mobile-series--${product.cardArchetype.id}`}>
    <div className={product.image ? "feed-mobile-series-head" : "feed-mobile-series-head feed-mobile-series-head--no-image"}>{product.image && <Image src={product.image} alt="" width={92} height={78} unoptimized />}<div><em>{product.cardArchetype.badge}</em><span>{product.brand}{product.sku ? ` · ${product.sku}` : ""}</span><Link href={`/p/${product.slug}`}>{product.title}</Link><small>{variantLabel(1, product.cardArchetype.variantForms)}</small></div></div>
    {compareControl}
    <dl>{columns.map((column) => <div key={column}><dt>{column}</dt><dd>{product.specs.find((spec) => spec.label === column)?.value ?? "—"}</dd></div>)}</dl>
    <div className="feed-mobile-series-commercial"><div><b>{product.price}</b><FeedAvailability shippingPromise={product.shippingPromise} /></div><div className="feed-mobile-order-actions"><AddRequestButton item={{ id:`variant:${directVariant.id}`, title:directVariant.title || product.title, article:variantArticle(directVariant.sku), price:directVariant.price, image:directVariant.image, href:directVariant.href, shippingLabel:directVariant.shippingPromise.label, shippingDetail:directVariant.shippingPromise.detail }}>Добавить в КП</AddRequestButton><QuickOrderDialog item={{ id:`variant:${directVariant.id}`, title:directVariant.title || product.title, article:variantArticle(directVariant.sku), price:directVariant.price, image:directVariant.image, href:directVariant.href, shippingLabel:directVariant.shippingPromise.label, shippingDetail:directVariant.shippingPromise.detail }} available={directVariant.shippingPromise.available} productId={product.id} variantId={directVariant.id} category={product.categorySlug} placement="category_mobile" pageType="category" /></div></div>
    <Link className="feed-mobile-all-variants" href={`/p/${product.slug}`}>{product.cardArchetype.detailAction} →</Link>
  </article>;

  return <article className="feed-mobile-series feed-mobile-series--picker">
      <div className={product.image ? "feed-mobile-series-head" : "feed-mobile-series-head feed-mobile-series-head--no-image"}>{product.image && <Image src={product.image} alt="" width={92} height={78} unoptimized />}<div><em>{product.cardArchetype.badge}</em><span>{product.brand}{product.sku ? ` · ${product.sku}` : ""}</span><b>{product.title}</b><small>{variantLabel(product.selectedVariantCount, product.cardArchetype.variantForms)}{product.selectedVariantCount !== product.variantCount ? ` из ${product.variantCount}` : ""}</small></div></div>
      {compareControl}
      <dl>{columns.map((column) => <div key={column}><dt>{column}</dt><dd>{product.specs.find((spec) => spec.label === column)?.value ?? "—"}</dd></div>)}</dl>
      <div className="feed-mobile-series-commercial"><div><b>{product.price}</b><FeedAvailability shippingPromise={product.shippingPromise} /></div><button type="button" aria-haspopup="dialog" onPointerEnter={onWarmVariants} onPointerDown={onWarmVariants} onFocus={onWarmVariants} onClick={onOpenVariants}>{product.cardArchetype.multipleAction} · {product.selectedVariantCount}</button></div>
      <Link className="feed-mobile-all-variants" href={`/p/${product.slug}`}>{product.cardArchetype.detailAction} →</Link>
  </article>;
}

function variantLabel(count: number, forms: [string, string, string]): string {
  return count === 1 ? pluralizeCardVariants(count, forms) : `${pluralizeCardVariants(count, forms)} · выберите точное исполнение`;
}

function variantArticle(sku: string): string {
  return sku ? `Артикул ${sku}` : "Артикул не указан в фиде";
}

function variantChoiceLabel(variant: FeedProductVariantModel, columns: string[]): string {
  if (variant.choiceLabel) return variant.choiceLabel;
  const diameter = variant.specs.find((spec) => /диаметр/iu.test(spec.label));
  const length = variant.specs.find((spec) => /(рабочая длина|глубина)/iu.test(spec.label));
  if (diameter && length) {
    const normalizedDiameter = diameter.value.replace(/^Ø\s*/u, "").replace(/\s*мм$/iu, "").trim();
    return `Ø${normalizedDiameter} × ${length.value}`;
  }
  const decisiveValues = columns.map((column) => variant.specs.find((spec) => spec.label === column)?.value).filter((value): value is string => Boolean(value && value !== "—")).slice(0, 2);
  return decisiveValues.length > 0 ? decisiveValues.join(" · ") : variant.title || variant.sku || "Исполнение";
}

function toPickerItems(product: FeedProductCardModel, columns: string[]): VariantPickerItem[] {
  return product.variants.map((variant) => ({ id:variant.id, sku:variant.sku, title:variant.title || product.title, label:variantChoiceLabel(variant, columns), context:variant.choiceContext || variant.specs.slice(0, 2).map((spec) => `${spec.label}: ${spec.value}`).join(" · "), price:variant.price, image:variant.image, href:variant.href, shippingPromise:variant.shippingPromise }));
}

function isSizeLedProduct(product: FeedProductCardModel, columns: string[]): boolean {
  return columns.some((column) => /диаметр|длина|размер/iu.test(column)) || product.variants.some((variant) => variant.selectorLabel === "Размер" || /[Ø⌀]\s*\d+.*[×xх]\s*\d+/iu.test(variantChoiceLabel(variant, columns)));
}

function warmProductVariants(product: FeedProductCardModel): void {
  preloadVariantPickerItems(variantEndpoint(product));
}

function variantEndpoint(product: FeedProductCardModel): string {
  return `/api/catalog-product-variants?product=${encodeURIComponent(product.slug)}&v=${encodeURIComponent(product.catalogRevision)}`;
}
