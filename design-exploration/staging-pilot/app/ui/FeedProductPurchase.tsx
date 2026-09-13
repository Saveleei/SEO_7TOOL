"use client";

import { useMemo, useState } from "react";
import { ContactRequestDialog } from "./ContactRequestDialog";
import { PRODUCT_COMPARISON_EVENT } from "./ProductComparisonDialog";
import { useRequestCart } from "./RequestCart";

type PurchaseVariant = {
  id: string;
  sku: string;
  title: string;
  price: string;
  available: boolean;
  keySpecs: Array<{ label: string; value: string }>;
  choiceLabel: string;
  choiceContext: string;
  selectorLabel: "Размер" | "Параметры исполнения";
  image?: string;
  href: string;
};

const INITIAL_VARIANTS = 12;
const VARIANT_PAGE_SIZE = 24;

export function FeedProductPurchase({ productId, productTitle, variants, totalVariantCount = variants.length, variantsEndpoint, selectedVariantId, hasComparableAlternatives = false }: { productId: string; productTitle: string; variants: PurchaseVariant[]; totalVariantCount?: number; variantsEndpoint?: string; selectedVariantId?: string; hasComparableAlternatives?: boolean }) {
  const [availableVariants, setAvailableVariants] = useState(variants);
  const [quantity, setQuantity] = useState(1);
  const [variantsOpen, setVariantsOpen] = useState(false);
  const [variantQuery, setVariantQuery] = useState("");
  const [visibleVariantCount, setVisibleVariantCount] = useState(INITIAL_VARIANTS + VARIANT_PAGE_SIZE);
  const [variantsLoading, setVariantsLoading] = useState(false);
  const [variantsError, setVariantsError] = useState("");
  const { items, addItem, open } = useRequestCart();
  const selected = useMemo(() => availableVariants.find((variant) => variant.id === selectedVariantId) ?? availableVariants[0], [availableVariants, selectedVariantId]);
  const matchingVariants = useMemo(() => {
    const query = normalizeSearch(variantQuery);
    if (!query) return availableVariants;
    return availableVariants.filter((variant) => normalizeSearch([variant.choiceLabel, variant.choiceContext, variant.sku].join(" ")).includes(query));
  }, [availableVariants, variantQuery]);
  const visibleVariants = useMemo(() => {
    const limit = variantsOpen || variantQuery ? visibleVariantCount : INITIAL_VARIANTS;
    const initial = matchingVariants.slice(0, limit);
    if (!selected || !matchingVariants.some((variant) => variant.id === selected.id) || initial.some((variant) => variant.id === selected.id)) return initial;
    return [selected, ...initial].slice(0, limit);
  }, [matchingVariants, selected, variantQuery, variantsOpen, visibleVariantCount]);
  const added = selected ? items.some((item) => item.id === `variant:${selected.id}`) : false;
  const collapsedVariantCount = Math.min(INITIAL_VARIANTS, totalVariantCount);
  const hiddenVariantCount = Math.max(0, totalVariantCount - collapsedVariantCount);

  function track(event: string, placement: string, trackedVariantId = selected?.id) {
    if (!trackedVariantId) return;
    window.dispatchEvent(new CustomEvent("7tool:prototype-event", { detail:{ event, placement, page_type:"product", product_id:productId, variant_id:trackedVariantId } }));
  }

  function addSelected() {
    if (!selected) return;
    addItem({ id:`variant:${selected.id}`, title:selected.title || productTitle, article:selected.sku ? `Артикул ${selected.sku}` : "Артикул не указан в фиде", price:selected.price, quantity, image:selected.image, href:selected.href });
    track("add_to_quote", "product_buybox");
  }

  async function toggleAllVariants() {
    if (variantsOpen) {
      track("close_variant_list", "product_buybox");
      setVariantsOpen(false);
      setVariantQuery("");
      return;
    }
    track("open_variant_list", "product_buybox");
    setVariantsOpen(true);
    if (!variantsEndpoint || availableVariants.length >= totalVariantCount || variantsLoading) return;
    setVariantsLoading(true);
    setVariantsError("");
    try {
      const response = await fetch(variantsEndpoint, { headers:{ Accept:"application/json" } });
      const payload = await response.json() as { ok?: boolean; variants?: unknown };
      const loaded = Array.isArray(payload.variants) ? payload.variants.filter(isPurchaseVariant) : [];
      if (!response.ok || !payload.ok || loaded.length < totalVariantCount) throw new Error("variant_list_unavailable");
      setAvailableVariants(loaded);
    } catch {
      setVariantsError("Не удалось загрузить все размеры. Повторите попытку или передайте размер менеджеру.");
    } finally {
      setVariantsLoading(false);
    }
  }

  if (!selected) return null;

  return <div className="feed-conversion-buybox" id="purchase">
      {totalVariantCount > 1 && <div className="feed-conversion-variants"><div className="feed-variant-selector-head"><div><span>Выберите {selected.selectorLabel.toLocaleLowerCase("ru-RU")}</span><small>{variantsOpen ? `Доступен полный список: ${totalVariantCount} ${variantWord(totalVariantCount, selected.selectorLabel)}` : `Сейчас показано ${collapsedVariantCount} из ${totalVariantCount}`}</small></div>{totalVariantCount > INITIAL_VARIANTS && <button type="button" aria-expanded={variantsOpen} aria-controls="feed-product-variant-options" onClick={() => void toggleAllVariants()} disabled={variantsLoading}>{variantsLoading ? "Загружаем…" : variantsOpen ? "Свернуть" : `Все ${totalVariantCount} ${variantWord(totalVariantCount, selected.selectorLabel)}`}</button>}</div>
        {totalVariantCount > INITIAL_VARIANTS && variantsOpen && <label className="feed-variant-search"><span>Найти по размеру или артикулу</span><input type="search" value={variantQuery} disabled={variantsLoading} onChange={(event) => { setVariantQuery(event.target.value); setVisibleVariantCount(INITIAL_VARIANTS + VARIANT_PAGE_SIZE); }} placeholder="Например: 35 × 30" /></label>}
        <div className="feed-variant-options" id="feed-product-variant-options">{visibleVariants.map((variant) => <a className={variant.id === selected.id ? "active" : undefined} href={variant.href} aria-current={variant.id === selected.id ? "true" : undefined} aria-label={`Открыть ${variant.choiceLabel}${variant.sku ? `, артикул ${variant.sku}` : ""}, ${variant.price}`} onClick={() => track("select_variant", "product_buybox", variant.id)} key={variant.id}><b>{variant.choiceLabel}</b>{variant.choiceContext && <span>{variant.choiceContext}</span>}<small>{variant.price}</small></a>)}</div>
        {totalVariantCount > INITIAL_VARIANTS && !variantsOpen && <button className="feed-variant-reveal" type="button" aria-expanded="false" aria-controls="feed-product-variant-options" onClick={() => void toggleAllVariants()}><span><b>Есть ещё {hiddenVariantCount} {variantWord(hiddenVariantCount, selected.selectorLabel)}</b><small>Откройте полный ряд и найдите нужный параметр без перехода в каталог.</small></span><strong>Выбрать из всех {totalVariantCount} →</strong></button>}
        {variantsError && <p className="feed-variant-load-error" role="status">{variantsError}</p>}
        {matchingVariants.length === 0 && <div className="feed-variant-empty"><b>Такого размера в этой группе нет</b><span>Измените запрос или передайте параметры менеджеру.</span></div>}
        {(variantsOpen || variantQuery) && visibleVariants.length < matchingVariants.length && <button className="feed-variant-more" type="button" onClick={() => setVisibleVariantCount((count) => count + VARIANT_PAGE_SIZE)}>Показать ещё {Math.min(VARIANT_PAGE_SIZE, matchingVariants.length - visibleVariants.length)}</button>}
        <div className="feed-selected-variant"><span>Выбрано</span><b>{selected.choiceLabel}</b><small>{selected.choiceContext ? `${selected.choiceContext} · ` : ""}{selected.sku ? `артикул ${selected.sku}` : "артикул не указан в фиде"}</small></div>
        <small className="feed-variant-help">Выбор обновляет всю карточку: фото, характеристики, цену, наличие и позицию в КП. Артикул служит для точной фиксации.</small></div>}

    <div className={selected.available ? "feed-conversion-stock feed-conversion-stock--positive" : "feed-conversion-stock"}>
      <span>{selected.available ? "В наличии по данным поставщика" : "Поставка под заказ или статус уточняется"}</span>
      <b>{selected.available ? "Остаток и дату отгрузки подтвердим перед оплатой" : "Менеджер вернёт подтверждённый срок в КП"}</b>
    </div>

    <div className="feed-conversion-price"><b>{selected.price}</b><span>{selected.sku ? `с НДС · цена относится к артикулу ${selected.sku}` : "с НДС · цена относится к выбранному исполнению"}</span></div>

    <div className="feed-conversion-purchase-actions">
      <div className="quantity-control" aria-label="Количество"><button type="button" aria-label="Уменьшить количество" onClick={() => setQuantity((value) => Math.max(1, value - 1))}>−</button><b>{quantity}</b><button type="button" aria-label="Увеличить количество" onClick={() => setQuantity((value) => value + 1)}>+</button></div>
      <button className={added ? "added" : undefined} type="button" onClick={addSelected}>{added ? "Добавлено в КП" : "Добавить в КП"}</button>
      <button className="feed-open-quote" type="button" onClick={() => { track("open_quote", "product_buybox"); open(); }}>Открыть запрос</button>
    </div>

    <div className="feed-conversion-secondary-actions">
      <ContactRequestDialog categoryTitle={`${productTitle}, артикул ${selected.sku}`} buttonLabel="Проверить применимость" />
      {hasComparableAlternatives ? <button className="feed-product-compare-trigger" type="button" aria-haspopup="dialog" onClick={() => { track("open_comparison", "product_buybox"); window.dispatchEvent(new CustomEvent(PRODUCT_COMPARISON_EVENT)); }}>Сравнить похожие модели</button> : <ContactRequestDialog categoryTitle={`${productTitle}, ${selected.choiceLabel}: подобрать аналог`} buttonLabel="Подобрать аналог" />}
    </div>

    <dl className="feed-conversion-key-specs">{selected.keySpecs.map((spec) => <div key={spec.label}><dt>{spec.label}</dt><dd>{spec.value}</dd></div>)}</dl>
    <p className="feed-conversion-proof">В КП попадёт точный артикул, количество и контекст товара. Форма прототипа ничего не отправляет наружу.</p>
  </div>;
}

function normalizeSearch(value: string): string {
  return value.toLocaleLowerCase("ru-RU").replace(/ё/gu, "е").replace(/[×хx*]/gu, "x").replace(/[^a-zа-я0-9]+/giu, " ").trim();
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

function isPurchaseVariant(value: unknown): value is PurchaseVariant {
  if (!value || typeof value !== "object") return false;
  const variant = value as Partial<PurchaseVariant>;
  return typeof variant.id === "string"
    && typeof variant.sku === "string"
    && typeof variant.title === "string"
    && typeof variant.price === "string"
    && typeof variant.available === "boolean"
    && Array.isArray(variant.keySpecs)
    && typeof variant.choiceLabel === "string"
    && typeof variant.choiceContext === "string"
    && (variant.selectorLabel === "Размер" || variant.selectorLabel === "Параметры исполнения");
}
