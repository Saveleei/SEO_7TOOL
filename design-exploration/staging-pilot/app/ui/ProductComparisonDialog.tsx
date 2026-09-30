"use client";

import Image from "next/image";
import Link from "next/link";
import { KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRequestCart } from "./RequestCart";

export const PRODUCT_COMPARISON_EVENT = "7tool:open-product-comparison";

const FOCUSABLE_SELECTOR = "a[href],button:not([disabled]),[tabindex]:not([tabindex='-1'])";

export type ProductComparisonOption = {
  id: string;
  productId: string;
  title: string;
  brand: string;
  choiceLabel: string;
  choiceContext: string;
  article: string;
  price: string;
  available: boolean;
  shippingLabel: string;
  shippingDetail: string;
  image?: string;
  href: string;
  reason: string;
  current?: boolean;
};

export type ProductComparisonRow = {
  label: string;
  values: string[];
};

export function ProductComparisonDialog({ currentProductId, currentVariantId, options, rows, heading = "Похожие модели по выбранному исполнению", description = "Текущий товар остаётся первым. Аналоги отобраны по совпадающим рабочим параметрам; пустые значения не дополнены предположениями.", keepAction = "Оставить текущее исполнение" }: { currentProductId: string; currentVariantId: string; options: ProductComparisonOption[]; rows: ProductComparisonRow[]; heading?: string; description?: string; keepAction?: string }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const { items, addItem } = useRequestCart();
  const trackComparison = useCallback((event: string, detail: Record<string, string | number>) => {
    window.dispatchEvent(new CustomEvent("7tool:prototype-event", { detail:{ event, placement:"product_comparison_dialog", page_type:"product", product_id:currentProductId, variant_id:currentVariantId, ...detail } }));
  }, [currentProductId, currentVariantId]);

  useEffect(() => {
    function openComparison() {
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setOpen(true);
    }
    window.addEventListener(PRODUCT_COMPARISON_EVENT, openComparison);
    return () => window.removeEventListener(PRODUCT_COMPARISON_EVENT, openComparison);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    trackComparison("comparison_view", { candidate_count:Math.max(0, options.length - 1) });
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
      returnFocusRef.current?.focus();
    };
  }, [open, options.length, trackComparison]);

  function trapFocus(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const focusable = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []).filter((element) => element.offsetParent !== null);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  function addAlternative(option: ProductComparisonOption) {
    addItem({ id:`variant:${option.id}`, title:option.title, article:option.article, price:option.price, image:option.image, href:option.href, shippingLabel:option.shippingLabel, shippingDetail:option.shippingDetail });
    trackComparison("comparison_add_to_quote", { target_product_id:option.productId, target_variant_id:option.id });
  }

  if (!open || options.length < 2) return null;

  return <div className="product-comparison-layer" role="dialog" aria-modal="true" aria-labelledby="product-comparison-title" aria-describedby="product-comparison-description" onKeyDown={trapFocus}>
    <button className="product-comparison-backdrop" type="button" aria-label="Закрыть сравнение" onClick={() => setOpen(false)} />
    <section ref={panelRef} className="product-comparison-panel">
      <header><div><span>Сравнение без возврата в категорию</span><h2 id="product-comparison-title">{heading}</h2><p id="product-comparison-description">{description}</p></div><button ref={closeRef} type="button" aria-label="Закрыть сравнение" onClick={() => setOpen(false)}>×</button></header>

      <div className="product-comparison-scroll" tabIndex={0} aria-label="Таблица сравнения; на узком экране прокручивается по горизонтали">
        <table>
          <thead><tr><th scope="col">Критерий</th>{options.map((option) => <th className={option.current ? "is-current" : undefined} scope="col" key={option.id}><div className="product-comparison-product">{option.image ? <Image src={option.image} alt="" width={104} height={78} unoptimized /> : <span className="product-comparison-image-fallback">Фото уточняется</span>}<small>{option.current ? "Ваш выбор" : option.reason}</small><b>{option.title}</b><strong>{option.choiceLabel}</strong>{option.choiceContext && <em>{option.choiceContext}</em>}<span>{option.article}</span></div></th>)}</tr></thead>
          <tbody>
            {rows.map((row) => <tr key={row.label}><th scope="row">{row.label}</th>{row.values.map((value, index) => <td className={options[index]?.current ? "is-current" : undefined} key={`${row.label}-${options[index]?.id}`}>{value || <span className="product-comparison-unknown">Нет данных в фиде</span>}</td>)}</tr>)}
            <tr className="product-comparison-commercial-row"><th scope="row">Цена и отгрузка</th>{options.map((option) => <td className={option.current ? "is-current" : undefined} key={`commercial-${option.id}`}><div className="product-comparison-commercial"><b>{option.price}</b><span className={option.available ? "is-available" : undefined}>{option.shippingLabel}</span><small>{option.shippingDetail}</small></div></td>)}</tr>
            <tr className="product-comparison-actions-row"><th scope="row">Действие</th>{options.map((option) => {
              const added = items.some((item) => item.id === `variant:${option.id}`);
              return <td className={option.current ? "is-current" : undefined} key={`action-${option.id}`}>{option.current ? <button type="button" className="product-comparison-keep" onClick={() => setOpen(false)}>{keepAction}</button> : <><button type="button" className={added ? "is-added" : undefined} onClick={() => addAlternative(option)}>{added ? "Добавлено в КП" : "Добавить в КП"}</button><Link href={option.href} onClick={() => trackComparison("comparison_open_product", { target_product_id:option.productId, target_variant_id:option.id })}>Открыть карточку</Link></>}</td>;
            })}</tr>
          </tbody>
        </table>
      </div>

      <footer><p><b>Важно:</b> совпадение параметров не заменяет проверку применимости, комплектации и режима работы инженером.</p><button type="button" onClick={() => setOpen(false)}>Закрыть сравнение</button></footer>
    </section>
  </div>;
}
