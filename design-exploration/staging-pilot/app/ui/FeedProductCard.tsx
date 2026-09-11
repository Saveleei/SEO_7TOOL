"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { FeedProductCardModel } from "../data/feedCatalog";
import { AddRequestButton } from "./RequestCart";

type Props = {
  product: FeedProductCardModel;
  selected: boolean;
  onCompare: () => void;
};

export function FeedProductCard({ product, selected, onCompare }: Props) {
  const [variantsOpen, setVariantsOpen] = useState(false);
  return <article className={`feed-product-card ${selected ? "feed-product-card--selected" : ""}`}>
    <Link className="feed-product-media" href={`/product/${product.slug}`} aria-label={`Открыть ${product.title}`}>
      {product.image ? <Image src={product.image} alt={product.title} width={430} height={340} unoptimized /> : <span>Изображение уточняется</span>}
      <small>Из товарного фида</small>
    </Link>

    <div className="feed-product-copy">
      <div className="feed-product-identity">
        <span>{product.brand}{product.sku ? ` · ${product.sku}` : ""}</span>
        <h3><Link href={`/product/${product.slug}`}>{product.title}</Link></h3>
        <p>{product.variantCount > 1 ? `${product.variantCount} ${pluralizeVariants(product.variantCount)} в одной товарной группе` : "Одно исполнение"}</p>
      </div>

      <dl className="feed-product-specs">{product.specs.map((spec) => <div key={spec.label}><dt>{spec.label}</dt><dd>{spec.value}</dd></div>)}</dl>

      <div className="feed-product-commercial">
        <label className="feed-compare-check"><input type="checkbox" aria-label={`Сравнить ${product.title}`} checked={selected} onChange={onCompare} /> Сравнить</label>
        <div className="feed-product-price"><b>{product.price}</b><small>с НДС · подтвердим в КП</small></div>
        <p>{product.availableVariantCount > 0 ? "Есть исполнения в наличии по данным фида. Подтвердим остаток и срок в КП." : "Наличие и срок поставки уточняем для выбранного исполнения."}</p>
        <div className="feed-product-actions">
          <button type="button" aria-expanded={variantsOpen} aria-controls={`card-variants-${product.id}`} onClick={() => setVariantsOpen((open) => !open)}>{variantsOpen ? "Скрыть исполнения" : product.selectedVariantCount > 1 ? `Выбрать из ${product.selectedVariantCount}` : "Выбрать исполнение"}</button>
          <Link href={`/product/${product.slug}`}>Все характеристики</Link>
        </div>
      </div>
    </div>
    {variantsOpen && <section className="feed-card-variants" id={`card-variants-${product.id}`} aria-label={`Исполнения ${product.title}`}>
      <header><div><b>Выберите точное исполнение</b><span>В КП попадёт только одна выбранная позиция, а не вся товарная серия.</span></div>{product.variantCount > product.variants.length && <Link href={`/product/${product.slug}`}>Все {product.variantCount} →</Link>}</header>
      <div>{product.variants.map((variant) => <article className={variant.matchesSelection ? "feed-card-variant feed-card-variant--match" : "feed-card-variant"} key={variant.id}>
        <div><span>{variant.matchesSelection ? "Соответствует фильтрам" : "Исполнение"}</span><b>{variant.sku}</b><small>{variant.specs.slice(0, 3).map((spec) => `${spec.label}: ${spec.value}`).join(" · ")}</small></div>
        <div><b>{variant.price}</b><span>{variant.available ? "В наличии по фиду · подтвердим" : "Наличие и срок уточняем"}</span></div>
        <AddRequestButton item={{ id:`variant:${variant.id}`, title:variant.title || product.title, article:`Артикул ${variant.sku}`, price:variant.price }}>Добавить в КП</AddRequestButton>
      </article>)}</div>
    </section>}
  </article>;
}

function pluralizeVariants(count: number): string {
  const modulo100 = count % 100;
  const modulo10 = count % 10;
  if (modulo100 >= 11 && modulo100 <= 14) return "исполнений";
  if (modulo10 === 1) return "исполнение";
  if (modulo10 >= 2 && modulo10 <= 4) return "исполнения";
  return "исполнений";
}
