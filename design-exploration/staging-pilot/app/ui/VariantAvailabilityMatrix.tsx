"use client";

import type { FeedProductVariantModel } from "../data/feedCatalog";

type Props = {
  variants: FeedProductVariantModel[];
  totalVariantCount: number;
  availableVariantCount: number;
  onOpen: () => void;
  onWarm?: () => void;
  limit?: number;
  compact?: boolean;
};

export function VariantAvailabilityMatrix({ variants, totalVariantCount, availableVariantCount, onOpen, onWarm, limit = 6, compact = false }: Props) {
  if (totalVariantCount <= 1) return null;
  const visible = variants.slice(0, Math.max(1, limit));
  const sizeLed = visible[0]?.selectorLabel === "Размер";
  const selectorLabel = sizeLed ? "размеров" : "исполнений";

  return <section className={`variant-availability-matrix variant-availability-matrix--${sizeLed ? "sizes" : "executions"}${compact ? " variant-availability-matrix--compact" : ""}`} aria-label={`Матрица доступности: ${totalVariantCount} ${selectorLabel}`}>
    <header>
      <div><b>Матрица доступности</b><span>{availableVariantCount} из {totalVariantCount} с подтверждённым остатком</span></div>
      <div className="variant-availability-legend" aria-label="Обозначения наличия"><span><i className="is-available" />В наличии</span><span><i className="is-unconfirmed" />Уточним</span></div>
    </header>
    <div className="variant-availability-grid">
      {visible.map((variant) => <a className={variant.shippingPromise.available ? "is-available" : "is-unconfirmed"} href={variant.href} key={variant.id} aria-label={`${variant.choiceLabel}, ${variant.shippingPromise.available ? "в наличии" : "наличие уточним"}`}>
        <strong>{variant.choiceLabel}</strong>
        {variant.choiceContext && <small>{variant.choiceContext}</small>}
        <span><i aria-hidden="true" />{variant.shippingPromise.available ? "В наличии" : "Уточним"}</span>
      </a>)}
      <button type="button" aria-haspopup="dialog" onPointerEnter={onWarm} onPointerDown={onWarm} onFocus={onWarm} onClick={onOpen}><strong>Все {totalVariantCount}</strong><span>Открыть полный выбор →</span></button>
    </div>
  </section>;
}
