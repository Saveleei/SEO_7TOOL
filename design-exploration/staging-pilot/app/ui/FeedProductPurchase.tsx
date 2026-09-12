"use client";

import { useMemo, useState } from "react";
import { ContactRequestDialog } from "./ContactRequestDialog";
import { useRequestCart } from "./RequestCart";

type PurchaseVariant = {
  id: string;
  sku: string;
  title: string;
  price: string;
  available: boolean;
  keySpecs: Array<{ label: string; value: string }>;
};

export function FeedProductPurchase({ productId, productTitle, variants, selectedVariantId }: { productId: string; productTitle: string; variants: PurchaseVariant[]; selectedVariantId?: string }) {
  const initialId = variants.some((variant) => variant.id === selectedVariantId) ? selectedVariantId : variants[0]?.id;
  const [variantId, setVariantId] = useState(initialId);
  const [quantity, setQuantity] = useState(1);
  const { items, addItem, open } = useRequestCart();
  const selected = useMemo(() => variants.find((variant) => variant.id === variantId) ?? variants[0], [variantId, variants]);
  const added = selected ? items.some((item) => item.id === `variant:${selected.id}`) : false;

  function track(event: string, placement: string, trackedVariantId = selected?.id) {
    if (!trackedVariantId) return;
    window.dispatchEvent(new CustomEvent("7tool:prototype-event", { detail:{ event, placement, page_type:"product", product_id:productId, variant_id:trackedVariantId } }));
  }

  function addSelected() {
    if (!selected) return;
    addItem({ id:`variant:${selected.id}`, title:selected.title || productTitle, article:`Артикул ${selected.sku}`, price:selected.price, quantity });
    track("add_to_quote", "product_buybox");
  }

  if (!selected) return null;

  return <div className="feed-conversion-buybox" id="purchase">
      {variants.length > 1 && <div className="feed-conversion-variants"><span>Исполнение</span><div>{variants.map((variant) => <button className={variant.id === selected.id ? "active" : undefined} type="button" aria-pressed={variant.id === selected.id} onClick={() => { setVariantId(variant.id); track("select_variant", "product_buybox", variant.id); }} key={variant.id}><b>{variant.sku}</b><small>{variant.price}</small></button>)}</div><small>Цена и характеристики меняются вместе с исполнением.</small></div>}

    <div className={selected.available ? "feed-conversion-stock feed-conversion-stock--positive" : "feed-conversion-stock"}>
      <span>{selected.available ? "В наличии по данным поставщика" : "Поставка под заказ или статус уточняется"}</span>
      <b>{selected.available ? "Остаток и дату отгрузки подтвердим перед оплатой" : "Менеджер вернёт подтверждённый срок в КП"}</b>
    </div>

    <div className="feed-conversion-price"><b>{selected.price}</b><span>с НДС · цена относится к артикулу {selected.sku}</span></div>

    <div className="feed-conversion-purchase-actions">
      <div className="quantity-control" aria-label="Количество"><button type="button" aria-label="Уменьшить количество" onClick={() => setQuantity((value) => Math.max(1, value - 1))}>−</button><b>{quantity}</b><button type="button" aria-label="Увеличить количество" onClick={() => setQuantity((value) => value + 1)}>+</button></div>
      <button className={added ? "added" : undefined} type="button" onClick={addSelected}>{added ? "Добавлено в КП" : "Добавить в КП"}</button>
      <button className="feed-open-quote" type="button" onClick={() => { track("open_quote", "product_buybox"); open(); }}>Открыть запрос</button>
    </div>

    <div className="feed-conversion-secondary-actions">
      <ContactRequestDialog categoryTitle={`${productTitle}, артикул ${selected.sku}`} buttonLabel="Проверить применимость" />
      <a href="#alternatives" onClick={() => track("view_alternatives", "product_buybox")}>Сравнить похожие модели</a>
    </div>

    <dl className="feed-conversion-key-specs">{selected.keySpecs.map((spec) => <div key={spec.label}><dt>{spec.label}</dt><dd>{spec.value}</dd></div>)}</dl>
    <p className="feed-conversion-proof">В КП попадёт точный артикул, количество и контекст товара. Форма прототипа ничего не отправляет наружу.</p>
  </div>;
}
