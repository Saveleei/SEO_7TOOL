"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { pluralizeCardVariants } from "../data/categoryCardArchetypes.mjs";
import type { FeedProductCardModel } from "../data/feedCatalog";
import { AddRequestButton } from "./RequestCart";
import { FeedAvailability } from "./FeedAvailability";

type Props = {
  product: FeedProductCardModel;
  selected: boolean;
  onCompare: () => void;
};

export function FeedProductCard({ product, selected, onCompare }: Props) {
  const [variantsOpen, setVariantsOpen] = useState(false);
  const directVariant = product.selectedVariantCount === 1 ? product.variants[0] : undefined;
  const archetype = product.cardArchetype;
  const projectConfiguration = archetype.id === "project-system";
  const visibleVariantLabel = pluralizeCardVariants(product.selectedVariantCount, archetype.variantForms);
  return <article className={`feed-product-card feed-product-card--${archetype.id} ${selected ? "feed-product-card--selected" : ""}`}>
    <Link className="feed-product-media" href={`/product/${product.slug}`} aria-label={`Открыть ${product.title}`}>
      {product.image ? <Image src={product.image} alt={product.title} width={430} height={340} unoptimized /> : <span>Изображение уточняется</span>}
      {product.image && <small>Фото из каталога поставщика</small>}
    </Link>

    <div className="feed-product-copy">
      <div className="feed-product-identity">
        <em className="feed-product-kind">{archetype.badge}</em>
        <span>{product.brand}{product.sku ? ` · ${product.sku}` : ""}</span>
        <h3><Link href={`/product/${product.slug}`}>{product.title}</Link></h3>
        <p>{product.selectedVariantCount !== product.variantCount ? `${visibleVariantLabel} подходит из ${product.variantCount}` : product.variantCount > 1 ? `${visibleVariantLabel} в одной товарной группе` : visibleVariantLabel}</p>
        {product.matchReasons.length > 0 && <div className="feed-product-match" aria-label="Почему товар подходит"><b>Подходит по выбранным параметрам</b>{product.matchReasons.map((reason) => <span key={reason}>{reason}</span>)}</div>}
      </div>

      {product.specs.length >= 2 ? <dl className="feed-product-specs" aria-label="Основные характеристики">{product.specs.map((spec) => <div key={spec.label}><dt>{spec.label}</dt><dd>{spec.value}</dd></div>)}</dl> : <div className={`feed-product-specs feed-product-specs--fallback ${projectConfiguration ? "feed-product-specs--project" : ""}`}><span>{projectConfiguration ? "Комплектация определяется по задаче" : product.specs.length === 1 ? "Один параметр подтверждён в фиде" : "Данных в фиде недостаточно"}</span>{product.specs[0] && <p className="feed-product-spec-confirmed"><b>{product.specs[0].label}</b><strong>{product.specs[0].value}</strong></p>}<b>{projectConfiguration ? "Для расчёта проекта нужны" : "Для точного подбора уточним"}</b><ul>{product.decisionPrompts.map((prompt) => <li key={prompt}>{prompt}</li>)}</ul></div>}

      <div className="feed-product-commercial">
        <label className="feed-compare-check"><input type="checkbox" aria-label={`Сравнить ${product.title}`} checked={selected} onChange={onCompare} /> Сравнить</label>
        <div className="feed-product-price"><b>{product.price}</b><small>{product.price === "Цена по запросу" || product.variantCount > 1 ? archetype.priceRequestNote : "с НДС · подтвердим в КП"}</small></div>
        <FeedAvailability shippingPromise={product.shippingPromise} />
        <div className="feed-product-actions">
          {directVariant ? <AddRequestButton item={{ id:`variant:${directVariant.id}`, title:directVariant.title || product.title, article:variantArticle(directVariant.sku), price:directVariant.price, image:directVariant.image, href:directVariant.href, shippingLabel:directVariant.shippingPromise.label, shippingDetail:directVariant.shippingPromise.detail }}>{archetype.singleAction}</AddRequestButton> : <button type="button" aria-expanded={variantsOpen} aria-controls={`card-variants-${product.id}`} onClick={() => setVariantsOpen((open) => !open)}>{variantsOpen ? "Скрыть варианты" : `${archetype.multipleAction} · ${product.selectedVariantCount}`}</button>}
          <a className="feed-all-characteristics" href={`/product/${product.slug}`} aria-label={`${archetype.detailAction}: ${product.title}`}>{archetype.detailAction}</a>
        </div>
      </div>
    </div>
    {!directVariant && variantsOpen && <section className="feed-card-variants" id={`card-variants-${product.id}`} aria-label={`Исполнения ${product.title}`}>
      <header><div><b>{archetype.multipleAction}</b><span>В КП попадёт только одна выбранная позиция, а не вся товарная группа.</span></div>{product.variantCount > product.variants.length && <Link href={`/product/${product.slug}`}>Все {pluralizeCardVariants(product.variantCount, archetype.variantForms)} →</Link>}</header>
      <div>{product.variants.map((variant) => <article className={variant.matchesSelection ? "feed-card-variant feed-card-variant--match" : "feed-card-variant"} key={variant.id}>
        <div><span>{variant.matchesSelection ? "Соответствует фильтрам" : capitalize(archetype.variantForms[0])}</span><a className="feed-variant-sku-link" href={`/product/${product.slug}?variant=${encodeURIComponent(variant.id)}#variants`}>{variant.sku || "Без артикула в фиде"}</a><small>{variant.specs.slice(0, 3).map((spec) => `${spec.label}: ${spec.value}`).join(" · ")}</small></div>
        <div><b>{variant.price}</b><FeedAvailability shippingPromise={variant.shippingPromise} exact /></div>
        <AddRequestButton item={{ id:`variant:${variant.id}`, title:variant.title || product.title, article:variantArticle(variant.sku), price:variant.price, image:variant.image, href:variant.href, shippingLabel:variant.shippingPromise.label, shippingDetail:variant.shippingPromise.detail }}>{archetype.singleAction}</AddRequestButton>
      </article>)}</div>
    </section>}
  </article>;
}

function variantArticle(sku: string): string {
  return sku ? `Артикул ${sku}` : "Артикул не указан в фиде";
}

function capitalize(value: string): string {
  return value.charAt(0).toLocaleUpperCase("ru-RU") + value.slice(1);
}
