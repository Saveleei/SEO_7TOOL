"use client";

import Image from "next/image";
import { useState } from "react";
import { pluralizeCardVariants } from "../data/categoryCardArchetypes.mjs";
import type { FeedProductCardModel, FeedProductVariantModel } from "../data/feedCatalog";
import { QuickOrderDialog } from "./QuickOrderDialog";
import { AddRequestButton } from "./RequestCart";
import { FeedAvailability } from "./FeedAvailability";
import { preloadVariantPickerItems, VariantPickerDialog, type VariantPickerItem } from "./VariantPickerDialog";

type Props = {
  product: FeedProductCardModel;
  selected: boolean;
  onCompare: () => void;
};

export function FeedProductCard({ product, selected, onCompare }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const directVariant = product.selectedVariantCount === 1 ? product.variants[0] : undefined;
  const archetype = product.cardArchetype;
  const projectConfiguration = archetype.id === "project-system";
  const visibleVariantLabel = pluralizeCardVariants(product.selectedVariantCount, archetype.variantForms);
  const variantsEndpoint = variantEndpoint(product);
  const warmVariants = () => preloadVariantPickerItems(variantsEndpoint);
  return <article className={`feed-product-card feed-product-card--${archetype.id} ${selected ? "feed-product-card--selected" : ""}`}>
    <a className="feed-product-media" href={`/p/${product.slug}`} aria-label={`Открыть ${product.title}`}>
      {product.image ? <Image src={product.image} alt={product.title} width={430} height={340} unoptimized /> : <span>Изображение уточняется</span>}
      {product.image && <small>Фото из каталога поставщика</small>}
    </a>

    <div className="feed-product-copy">
      <div className="feed-product-identity">
        <em className="feed-product-kind">{archetype.badge}</em>
        {product.taskLabel && <em className="feed-product-task-label">{product.taskLabel}</em>}
        <span>{product.brand}{product.sku ? ` · ${product.sku}` : ""}</span>
        <h3><a href={`/p/${product.slug}`}>{product.title}</a></h3>
        <p>{product.selectedVariantCount !== product.variantCount ? `${visibleVariantLabel} подходит из ${product.variantCount}` : product.variantCount > 1 ? `${visibleVariantLabel} в одной товарной группе` : visibleVariantLabel}</p>
        {product.matchReasons.length > 0 && <div className="feed-product-match" aria-label="Почему товар подходит"><b>Подходит по выбранным параметрам</b>{product.matchReasons.map((reason) => <span key={reason}>{reason}</span>)}</div>}
      </div>

      {product.specs.length >= 2 ? <dl className="feed-product-specs" aria-label="Основные характеристики">{product.specs.map((spec) => <div key={spec.label}><dt>{spec.label}</dt><dd>{spec.value}</dd></div>)}</dl> : <div className={`feed-product-specs feed-product-specs--fallback ${projectConfiguration ? "feed-product-specs--project" : ""}`}><span>{projectConfiguration ? "Комплектация определяется по задаче" : product.specs.length === 1 ? "Один параметр подтверждён в фиде" : "Данных в фиде недостаточно"}</span>{product.specs[0] && <p className="feed-product-spec-confirmed"><b>{product.specs[0].label}</b><strong>{product.specs[0].value}</strong></p>}<b>{projectConfiguration ? "Для расчёта проекта нужны" : "Для точного подбора уточним"}</b><ul>{product.decisionPrompts.map((prompt) => <li key={prompt}>{prompt}</li>)}</ul></div>}

      <div className="feed-product-commercial">
        <label className="feed-compare-check"><input type="checkbox" aria-label={`Сравнить ${product.title}`} checked={selected} onChange={onCompare} /> Сравнить</label>
        <div className="feed-product-price"><b>{product.price}</b><small>{product.variantCount > 1 ? "с НДС · зависит от исполнения" : "с НДС · подтвердим в КП"}</small></div>
        <FeedAvailability shippingPromise={product.shippingPromise} />
        <div className="feed-product-actions">
          {directVariant ? <AddRequestButton item={{ id:`variant:${directVariant.id}`, title:directVariant.title || product.title, article:variantArticle(directVariant.sku), price:directVariant.price, image:directVariant.image, href:directVariant.href, shippingLabel:directVariant.shippingPromise.label, shippingDetail:directVariant.shippingPromise.detail }}>Добавить в КП</AddRequestButton> : <button type="button" aria-haspopup="dialog" data-variant-count={product.selectedVariantCount} onPointerEnter={warmVariants} onPointerDown={warmVariants} onFocus={warmVariants} onClick={() => setPickerOpen(true)}>{archetype.multipleAction} · {product.selectedVariantCount}</button>}
          {directVariant && <QuickOrderDialog item={{ id:`variant:${directVariant.id}`, title:directVariant.title || product.title, article:variantArticle(directVariant.sku), price:directVariant.price, image:directVariant.image, href:directVariant.href, shippingLabel:directVariant.shippingPromise.label, shippingDetail:directVariant.shippingPromise.detail }} available={directVariant.shippingPromise.available} productId={product.id} variantId={directVariant.id} category={product.categorySlug} placement="category_card" pageType="category" />}
          <a className="feed-all-characteristics" href={`/p/${product.slug}`} aria-label={`${archetype.detailAction}: ${product.title}`}>{archetype.detailAction}</a>
        </div>
        <div className="feed-product-assurance"><b>Проверим до оплаты</b><span>Точное исполнение · комплектность и документы · остаток и дата отгрузки</span></div>
      </div>
    </div>
    {!directVariant && <VariantPickerDialog open={pickerOpen} onClose={() => setPickerOpen(false)} productId={product.id} productTitle={product.title} category={product.categorySlug} pageType="category" placement="category_card_size_picker" items={toPickerItems(product)} totalVariantCount={product.variantCount} fullProductHref={`/p/${product.slug}`} variantsEndpoint={variantsEndpoint} selectorLabel={isSizeLedProduct(product) ? "Размер" : "Исполнение"} />}
  </article>;
}

function variantArticle(sku: string): string {
  return sku ? `Артикул ${sku}` : "Артикул не указан в фиде";
}

function variantChoiceLabel(variant: FeedProductVariantModel): string {
  if (variant.choiceLabel) return variant.choiceLabel;
  const diameter = variant.specs.find((spec) => /диаметр/iu.test(spec.label));
  const length = variant.specs.find((spec) => /(рабочая длина|глубина)/iu.test(spec.label));
  if (diameter && length) {
    const normalizedDiameter = diameter.value.replace(/^Ø\s*/u, "").replace(/\s*мм$/iu, "").trim();
    return `Ø${normalizedDiameter} × ${length.value}`;
  }
  return variant.specs.slice(0, 2).map((spec) => spec.value).filter(Boolean).join(" · ") || variant.title || variant.sku || "Исполнение";
}

function toPickerItems(product: FeedProductCardModel): VariantPickerItem[] {
  return product.variants.map((variant) => ({ id:variant.id, sku:variant.sku, title:variant.title || product.title, label:variantChoiceLabel(variant), context:variant.choiceContext || variant.specs.slice(0, 2).map((spec) => `${spec.label}: ${spec.value}`).join(" · "), price:variant.price, image:variant.image, href:variant.href, shippingPromise:variant.shippingPromise }));
}

function isSizeLedProduct(product: FeedProductCardModel): boolean {
  return product.variants.some((variant) => variant.selectorLabel === "Размер" || /[Ø⌀]\s*\d+.*[×xх]\s*\d+/iu.test(variantChoiceLabel(variant)) || variant.specs.some((spec) => /диаметр|длина|размер/iu.test(spec.label)));
}

function variantEndpoint(product: FeedProductCardModel): string {
  return `/api/catalog-product-variants?product=${encodeURIComponent(product.slug)}&v=${encodeURIComponent(product.catalogRevision)}`;
}
