"use client";

import Image from "next/image";
import Link from "next/link";
import type { FeedProductCardModel } from "../data/feedCatalog";
import { AddRequestButton } from "./RequestCart";

type Props = {
  product: FeedProductCardModel;
  selected: boolean;
  onCompare: () => void;
};

export function FeedProductCard({ product, selected, onCompare }: Props) {
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
          <AddRequestButton item={{ id:product.id, title:product.title, article:product.sku ? `Артикул ${product.sku}` : "Товарная группа", price:product.price }}>В запрос КП</AddRequestButton>
          <Link href={`/product/${product.slug}`}>Все характеристики</Link>
        </div>
      </div>
    </div>
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
