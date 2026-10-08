"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { ContactRequestDialog } from "./ContactRequestDialog";
import { PRODUCT_COMPARISON_EVENT } from "./ProductComparisonDialog";
import { useRequestCart } from "./RequestCart";
import { getProductPageArchetype } from "../data/productPageArchetypes";
import type { FeedShippingPromise } from "../data/feedCatalog";
import { QuickOrderDialog } from "./QuickOrderDialog";
import { CompareToggleButton } from "./Comparison";
import { VariantPickerDialog, type VariantPickerItem } from "./VariantPickerDialog";

type PurchaseVariant = {
  id: string;
  sku: string;
  title: string;
  price: string;
  available: boolean;
  shippingPromise: FeedShippingPromise;
  keySpecs: Array<{ label: string; value: string }>;
  choiceLabel: string;
  choiceContext: string;
  selectorLabel: "Размер" | "Параметры исполнения";
  image?: string;
  selectorImage?: string;
  href: string;
};

const INITIAL_VARIANTS = 12;

export function FeedProductPurchase({ productId, productSlug, productTitle, productBrand, categorySlug, variants, totalVariantCount = variants.length, availableVariantCount, initialNextOffset, variantsEndpoint, selectedVariantId, hasComparableAlternatives = false }: { productId: string; productSlug: string; productTitle: string; productBrand: string; categorySlug: string; variants: PurchaseVariant[]; totalVariantCount?: number; availableVariantCount?: number; initialNextOffset?: number | null; variantsEndpoint?: string; selectedVariantId?: string; hasComparableAlternatives?: boolean }) {
  const [quantity, setQuantity] = useState(1);
  const [pickerOpen, setPickerOpen] = useState(false);
  const { items, addItem, open } = useRequestCart();
  const pageArchetype = getProductPageArchetype(categorySlug);
  const selected = useMemo(() => variants.find((variant) => variant.id === selectedVariantId) ?? variants[0], [selectedVariantId, variants]);
  const sizeOnlySelector = selected?.selectorLabel === "Размер";
  const visibleVariants = useMemo(() => {
    const initial = variants.slice(0, INITIAL_VARIANTS);
    if (!selected || initial.some((variant) => variant.id === selected.id)) return initial;
    return [selected, ...initial].slice(0, INITIAL_VARIANTS);
  }, [selected, variants]);
  const pickerItems = useMemo<VariantPickerItem[]>(() => variants.map((variant) => ({
    id:variant.id,
    sku:variant.sku,
    title:variant.title,
    label:variant.choiceLabel,
    context:variant.choiceContext,
    price:variant.price,
    image:variant.image,
    href:variant.href,
    shippingPromise:variant.shippingPromise,
  })), [variants]);
  const added = selected ? items.some((item) => item.id === `variant:${selected.id}`) : false;
  const collapsedVariantCount = Math.min(INITIAL_VARIANTS, totalVariantCount);
  const hiddenVariantCount = Math.max(0, totalVariantCount - collapsedVariantCount);

  function track(event: string, placement: string, trackedVariantId = selected?.id) {
    if (!trackedVariantId) return;
    window.dispatchEvent(new CustomEvent("7tool:prototype-event", { detail:{ event, placement, page_type:"product", product_id:productId, variant_id:trackedVariantId } }));
  }

  function addSelected(openQuote = false) {
    if (!selected) return;
    if (!added) addItem({ id:`variant:${selected.id}`, title:selected.title || productTitle, article:selected.sku ? `Артикул ${selected.sku}` : "Артикул не указан в фиде", price:selected.price, quantity, image:selected.image, href:selected.href, shippingLabel:selected.shippingPromise.label, shippingDetail:selected.shippingPromise.detail }, { placement:"product_buybox", page_type:"product", product_id:productId, variant_id:selected.id, category:categorySlug });
    else if (!openQuote) addItem({ id:`variant:${selected.id}`, title:selected.title || productTitle, article:selected.sku ? `Артикул ${selected.sku}` : "Артикул не указан в фиде", price:selected.price, quantity, image:selected.image, href:selected.href, shippingLabel:selected.shippingPromise.label, shippingDetail:selected.shippingPromise.detail }, { placement:"product_buybox", page_type:"product", product_id:productId, variant_id:selected.id, category:categorySlug });
    if (openQuote) open();
  }

  function openVariantPicker() {
    track("open_variant_list", "product_buybox");
    setPickerOpen(true);
  }

  if (!selected) return null;

  return <div className="feed-conversion-buybox" id="purchase">
      {totalVariantCount > 1 && <div className="feed-conversion-variants"><div className="feed-variant-selector-head"><div><span>Выберите {selected.selectorLabel.toLocaleLowerCase("ru-RU")}</span><small>Сейчас показано {collapsedVariantCount} из {totalVariantCount}</small></div><button type="button" aria-haspopup="dialog" onClick={openVariantPicker}>{totalVariantCount > INITIAL_VARIANTS ? `Все ${totalVariantCount} ${variantWord(totalVariantCount, selected.selectorLabel)}` : "Открыть удобный выбор"}</button></div>
        {sizeOnlySelector && <div className="feed-variant-availability-legend" aria-label="Обозначения наличия"><span><i className="is-available" />В наличии</span><span><i className="is-unconfirmed" />Наличие и срок уточним</span></div>}
        <div className={["feed-variant-options", sizeOnlySelector ? "feed-variant-options--sizes" : ""].filter(Boolean).join(" ")} id="feed-product-variant-options">{visibleVariants.map((variant) => { const confirmedAvailable = variant.available && variant.shippingPromise.available; const availabilityLabel = confirmedAvailable ? "В наличии" : "Наличие и срок уточним"; return <a className={[variant.id === selected.id ? "active" : "", confirmedAvailable ? "is-available" : "is-unconfirmed", !sizeOnlySelector && variant.selectorImage ? "has-media" : ""].filter(Boolean).join(" ")} href={variant.href} aria-current={variant.id === selected.id ? "true" : undefined} aria-label={`Открыть ${variant.choiceLabel}${variant.sku ? `, артикул ${variant.sku}` : ""}, ${variant.price}. ${availabilityLabel}`} onClick={() => track("select_variant", "product_buybox", variant.id)} key={variant.id}>{!sizeOnlySelector && variant.selectorImage && <Image className="feed-variant-option-image" src={variant.selectorImage} alt="" width={52} height={52} unoptimized />}<span className="feed-variant-option-copy"><b>{variant.choiceLabel}</b>{!sizeOnlySelector && variant.choiceContext && <span>{variant.choiceContext}</span>}{!sizeOnlySelector && <small>{variant.price}</small>}</span>{sizeOnlySelector && <span className="feed-variant-option-status"><i aria-hidden="true" />{confirmedAvailable ? "В наличии" : "Уточним"}</span>}</a>; })}</div>
        {totalVariantCount > INITIAL_VARIANTS && <button className="feed-variant-reveal" type="button" aria-haspopup="dialog" onClick={openVariantPicker}><span><b>Есть ещё {hiddenVariantCount} {variantWord(hiddenVariantCount, selected.selectorLabel)}</b><small>Полный поиск работает по размеру, артикулу и наличию без загрузки всей матрицы в страницу.</small></span><strong>Выбрать из всех {totalVariantCount} →</strong></button>}
        <div className="feed-selected-variant"><span>Выбрано</span><b>{selected.choiceLabel}</b><small>{selected.choiceContext ? `${selected.choiceContext} · ` : ""}{selected.sku ? `артикул ${selected.sku}` : "артикул не указан в фиде"}</small></div>
        <small className="feed-variant-help">Выбор обновляет всю карточку: фото, характеристики, цену, наличие и позицию в КП. Миниатюра показана только у исполнения с отличающимся фото поставщика.</small></div>}

    {totalVariantCount > 1 && <VariantPickerDialog open={pickerOpen} onClose={() => setPickerOpen(false)} productId={productId} productTitle={productTitle} category={categorySlug} pageType="product" placement="product_buybox_variant_picker" items={pickerItems} initialVariantId={selected.id} totalVariantCount={totalVariantCount} initialAvailableVariantCount={availableVariantCount} initialNextOffset={initialNextOffset} fullProductHref={`/p/${productSlug}`} variantsEndpoint={variantsEndpoint} selectorLabel={sizeOnlySelector ? "Размер" : "Исполнение"} />}

    <div className={selected.shippingPromise.available ? "feed-conversion-stock feed-conversion-stock--positive" : "feed-conversion-stock"}>
      <span>{selected.shippingPromise.label}</span>
      <b>{selected.shippingPromise.detail}</b>
    </div>

    <div className="feed-conversion-price"><b>{selected.price}</b><span>{selected.sku ? `с НДС · цена относится к артикулу ${selected.sku}` : "с НДС · цена относится к выбранному исполнению"}</span></div>

    <div className="feed-conversion-purchase-actions">
      <div className="quantity-control" aria-label="Количество"><button type="button" aria-label="Уменьшить количество" onClick={() => setQuantity((value) => Math.max(1, value - 1))}>−</button><b>{quantity}</b><button type="button" aria-label="Увеличить количество" onClick={() => setQuantity((value) => value + 1)}>+</button></div>
      <button className="feed-quote-primary" type="button" onClick={() => addSelected(true)}>{added ? "Открыть КП" : "Получить КП"}</button>
      <QuickOrderDialog className="feed-quote-quick" item={{ id:`variant:${selected.id}`, title:selected.title || productTitle, article:selected.sku ? `Артикул ${selected.sku}` : "Артикул не указан в фиде", price:selected.price, quantity, image:selected.image, href:selected.href, shippingLabel:selected.shippingPromise.label, shippingDetail:selected.shippingPromise.detail }} available={selected.shippingPromise.available} productId={productId} variantId={selected.id} category={categorySlug} placement="product_buybox" pageType="product" quantity={quantity} />
      {items.length > 0 && <button className="feed-open-quote" type="button" onClick={() => { track("open_quote", "product_buybox"); open(); }}>Открыть КП · {items.length}</button>}
    </div>

    <div className="feed-conversion-secondary-actions">
      <ContactRequestDialog categoryTitle={[productTitle, selected.choiceLabel, selected.sku ? `артикул ${selected.sku}` : ""].filter(Boolean).join(", ")} buttonLabel={pageArchetype.fitAction} />
      <CompareToggleButton className="feed-save-comparison" placement="product_buybox" item={{ productId, slug:productSlug, title:productTitle, brand:productBrand, category:categorySlug, variantId:selected.id, variantLabel:selected.choiceLabel, image:selected.image, href:selected.href }} />
      {hasComparableAlternatives ? <button className="feed-product-compare-trigger" type="button" aria-haspopup="dialog" onClick={() => { track("open_comparison", "product_buybox"); window.dispatchEvent(new CustomEvent(PRODUCT_COMPARISON_EVENT)); }}>{pageArchetype.compareAction}</button> : <ContactRequestDialog categoryTitle={`${productTitle}, ${selected.choiceLabel}: подобрать аналог`} buttonLabel="Подобрать аналог" />}
    </div>

    <dl className="feed-conversion-key-specs">{selected.keySpecs.map((spec) => <div key={spec.label}><dt>{spec.label}</dt><dd>{spec.value}</dd></div>)}</dl>
    <p className="feed-conversion-proof">{pageArchetype.quoteProof} После отправки запрос получит номер и сохранится для менеджера.</p>
  </div>;
}

function variantWord(count: number, selectorLabel: PurchaseVariant["selectorLabel"]): string {
  const forms = selectorLabel === "Размер" ? ["размер", "размера", "размеров"] : ["исполнение", "исполнения", "исполнений"];
  const mod100 = count % 100;
  const mod10 = count % 10;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}
