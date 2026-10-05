"use client";

import Image from "next/image";
import { FormEvent, KeyboardEvent as ReactKeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { getQuickOrderMode } from "../data/quickOrder.mjs";
import { buildRequestSource } from "../data/requestAttribution";
import type { RequestItem } from "./RequestCart";
import { ManagerContactCard } from "./ManagerContactCard";

const FOCUSABLE_SELECTOR = "a[href],button:not([disabled]),input:not([disabled]):not([type='hidden']),textarea:not([disabled]),[tabindex]:not([tabindex='-1'])";

type Props = {
  item: RequestItem;
  available: boolean;
  productId: string;
  variantId: string;
  category: string;
  placement: string;
  pageType: "category" | "product";
  quantity?: number;
  className?: string;
};

export function QuickOrderDialog({ item, available, productId, variantId, category, placement, pageType, quantity: initialQuantity = 1, className }: Props) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [requestNumber, setRequestNumber] = useState("");
  const [formError, setFormError] = useState("");
  const [quantity, setQuantity] = useState(Math.max(1, initialQuantity));
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const idempotencyKeyRef = useRef("");
  const mode = useMemo(() => getQuickOrderMode({ available, price:item.price }), [available, item.price]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") closeDialog(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
      returnFocusRef.current?.focus();
    };
  }, [open]);

  function track(event: string) {
    window.dispatchEvent(new CustomEvent("7tool:prototype-event", { detail:{
      event,
      placement,
      page_type:pageType,
      product_id:productId,
      variant_id:variantId,
      category,
      quick_order_mode:mode.id,
    } }));
  }

  function openDialog() {
    setSent(false);
    setFormError("");
    setRequestNumber("");
    setQuantity(Math.max(1, initialQuantity));
    setOpen(true);
    track("open_quick_order");
  }

  function closeDialog() {
    setOpen(false);
    setSubmitting(false);
    setFormError("");
    idempotencyKeyRef.current = "";
  }

  function trapFocus(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []).filter((element) => element.offsetParent !== null);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setFormError("");
    track("submit_quick_order");
    if (!idempotencyKeyRef.current) idempotencyKeyRef.current = crypto.randomUUID();
    const formData = new FormData(event.currentTarget);
    formData.set("request_type", "quick_order");
    formData.set("idempotency_key", idempotencyKeyRef.current);
    formData.set("items", JSON.stringify([{ ...item, quantity }]));
    formData.set("source", JSON.stringify(buildRequestSource()));
    try {
      const response = await fetch("/api/quote-requests", { method:"POST", body:formData, headers:{ "X-Requested-With":"7tool-quick-order" } });
      const result = await response.json() as { ok?: boolean; requestNumber?: string; message?: string };
      if (!response.ok || !result.ok || !result.requestNumber) throw new Error(result.message || "Не удалось сохранить запрос.");
      setRequestNumber(result.requestNumber);
      setSent(true);
      track("quick_order_success");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Не удалось сохранить запрос. Попробуйте ещё раз.");
      track("quick_order_error");
    } finally {
      setSubmitting(false);
    }
  }

  return <>
    <button className={["quick-order-trigger", className].filter(Boolean).join(" ")} type="button" onClick={openDialog} aria-haspopup="dialog">{mode.triggerLabel}</button>
    {open && <div className="quick-order-layer" role="dialog" aria-modal="true" aria-labelledby={`quick-order-title-${variantId}`} aria-describedby={`quick-order-description-${variantId}`} onKeyDown={trapFocus}>
      <button className="quick-order-backdrop" type="button" onClick={closeDialog} aria-label="Закрыть быстрый заказ" />
      <div ref={dialogRef} className="quick-order-dialog">
        <header><div><span>{mode.id === "order" ? "Один товар · один контакт" : "Уточнение без длинной формы"}</span><h2 id={`quick-order-title-${variantId}`}>{sent ? "Запрос принят" : mode.title}</h2><p id={`quick-order-description-${variantId}`}>{sent ? `Номер ${requestNumber}. Менеджер получил выбранное исполнение и свяжется по указанному телефону.` : mode.lead}</p></div><button ref={closeRef} type="button" onClick={closeDialog} aria-label="Закрыть">×</button></header>
        {sent ? <section className="quick-order-success" role="status"><div><span aria-hidden="true">✓</span><div><b>{requestNumber}</b><p>Повторно вводить данные не нужно. Цена, остаток и срок будут подтверждены до оплаты.</p></div></div><ManagerContactCard compact placement="quick_order_success" productId={productId} /><button type="button" onClick={closeDialog}>Вернуться к товару</button></section> : <>
          <section className="quick-order-product" aria-label="Выбранный товар">
            {item.image ? <Image src={item.image} alt="" width={76} height={76} unoptimized /> : <span className="quick-order-product-placeholder" aria-hidden="true">7T</span>}
            <div><b>{item.title}</b><span>{item.article}</span><small>{item.shippingLabel || "Наличие и срок уточняем"}</small></div>
            <div><strong>{item.price || "Цена по запросу"}</strong><div className="quick-order-quantity" aria-label="Количество"><button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="Уменьшить количество">−</button><b>{quantity}</b><button type="button" onClick={() => setQuantity((value) => Math.min(999, value + 1))} aria-label="Увеличить количество">+</button></div></div>
          </section>
          <form className="quick-order-form" onSubmit={submit}>
            <input className="request-cart-honeypot" name="website" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" />
            <input name="check_availability" type="hidden" value="on" />
            <label>Телефон для связи <span>*</span><input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+7 999 000-00-00" required autoFocus /></label>
            <label>Компания <small>необязательно</small><input name="company" type="text" autoComplete="organization" placeholder="Название организации" /></label>
            <label className="quick-order-form-wide">Комментарий <small>необязательно</small><textarea name="comment" rows={3} placeholder="Когда удобно позвонить или что важно уточнить" /></label>
            <label className="quick-order-consent quick-order-form-wide"><input name="consent" type="checkbox" defaultChecked required /><span>Я согласен с <a href="/soglasie-na-obrabotku" target="_blank">обработкой персональных данных</a></span></label>
            {formError && <div className="quick-order-error quick-order-form-wide" role="alert">{formError}</div>}
            <div className="quick-order-submit quick-order-form-wide"><button type="submit" disabled={submitting}>{submitting ? "Надёжно сохраняем…" : mode.submitLabel}</button><small>Менеджер сначала подтвердит цену, наличие и срок. Оплата на этом шаге не производится.</small></div>
          </form>
        </>}
      </div>
    </div>}
  </>;
}
