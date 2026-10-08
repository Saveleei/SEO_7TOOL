"use client";

import { FormEvent, KeyboardEvent as ReactKeyboardEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { buildRequestSource } from "../data/requestAttribution";

const FOCUSABLE_SELECTOR = "a[href],button:not([disabled]),input:not([disabled]):not([type='hidden']),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex='-1'])";
type RequestResult = { ok?: boolean; requestNumber?: string; message?: string };

export function ContactRequestDialog({ categoryTitle, buttonLabel = "Отправить параметры →" }: { categoryTitle: string; buttonLabel?: string }) {
  const [open, setOpen] = useState(false);
  const [requestNumber, setRequestNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const idempotencyKeyRef = useRef("");
  const phoneRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const successCloseRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const triggerElement = triggerRef.current;
    document.body.style.overflow = "hidden";
    phoneRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
      triggerElement?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (open && requestNumber) successCloseRef.current?.focus();
  }, [open, requestNumber]);

  function trapFocus(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const focusable = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []).filter((element) => element.offsetParent !== null);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const formData = new FormData(event.currentTarget);
    if (!idempotencyKeyRef.current) idempotencyKeyRef.current = crypto.randomUUID();
    formData.set("request_type", "selection");
    formData.set("email", "");
    formData.set("city", "");
    formData.set("comment", String(formData.get("comment") || `Нужен подбор: ${categoryTitle}.`));
    formData.set("idempotency_key", idempotencyKeyRef.current);
    formData.set("alternatives", "on");
    formData.set("check_availability", "on");
    formData.set("check_set", "on");
    formData.set("check_docs", "on");
    formData.set("items", JSON.stringify([{ id:"selection:callback", title:`Проверка параметров: ${categoryTitle}`, article:"Без артикула — инженерный подбор", quantity:1, href:`${window.location.pathname}${window.location.search}` }]));
    formData.set("source", JSON.stringify(buildRequestSource()));
    setSubmitting(true);
    setFormError("");
    trackDialog("submit_selection_request");
    try {
      const response = await fetch("/api/quote-requests", { method:"POST", body:formData, headers:{ "X-Requested-With":"7tool-selection-request" } });
      const result = await response.json() as RequestResult;
      if (!response.ok || !result.ok || !result.requestNumber) throw new Error(result.message || "Не удалось сохранить задачу.");
      setRequestNumber(result.requestNumber);
      trackDialog("selection_request_success");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Не удалось сохранить задачу. Попробуйте ещё раз.");
      trackDialog("selection_request_error");
    } finally {
      setSubmitting(false);
    }
  }

  function openDialog() {
    setRequestNumber("");
    setFormError("");
    idempotencyKeyRef.current = "";
    setOpen(true);
  }

  return <>
    <button ref={triggerRef} className="contact-dialog-trigger" type="button" onClick={openDialog}>{buttonLabel}</button>
    {open && createPortal(<div className="contact-dialog-layer" role="dialog" aria-modal="true" aria-labelledby="contact-dialog-title" aria-describedby="contact-dialog-description" onKeyDown={trapFocus}>
      <button className="contact-dialog-backdrop" type="button" aria-label="Закрыть форму" onClick={() => setOpen(false)} />
      <section ref={panelRef} className="contact-dialog-panel">
        <header><div><span>Обратная связь</span><h2 id="contact-dialog-title">Передать задачу инженеру</h2><p id="contact-dialog-description">Опишите известные параметры. Артикул и точную модель указывать не обязательно.</p></div><button type="button" aria-label="Закрыть" onClick={() => setOpen(false)}>×</button></header>
        {requestNumber ? <div className="contact-dialog-success" role="status"><span>Задача сохранена</span><b>Заявка № {requestNumber}</b><p>Менеджер увидит параметры и свяжется по указанному телефону.</p><button ref={successCloseRef} type="button" onClick={() => setOpen(false)}>Закрыть</button></div> : <form onSubmit={submit}>
          <input className="request-cart-honeypot" name="website" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" />
          <div className="test-form-mark">Короткая форма · заявка получит номер</div>
          <label>Телефон для связи <span>*</span><input ref={phoneRef} name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+7 999 000-00-00" required /></label>
          <label>Имя или компания<input name="company" type="text" autoComplete="organization" maxLength={160} placeholder="Необязательно" /></label>
          <label className="contact-dialog-wide">Что требуется<textarea name="comment" rows={4} defaultValue={`Нужен подбор: ${categoryTitle}. `} maxLength={2000} /></label>
          <label className="contact-dialog-wide contact-dialog-check"><input name="consent" type="checkbox" defaultChecked required /> <span>Я согласен с <a href="/soglasie-na-obrabotku" target="_blank">обработкой персональных данных</a></span></label>
          {formError && <div className="contact-dialog-wide workbench-contact-error" role="alert">{formError}</div>}
          <div className="contact-dialog-actions"><button type="submit" disabled={submitting}>{submitting ? "Сохраняем задачу…" : "Отправить задачу"}</button><small>После отправки менеджер свяжется по указанному номеру в рабочее время.</small></div>
        </form>}
      </section>
    </div>, document.body)}
  </>;
}

function trackDialog(event: string) {
  window.dispatchEvent(new CustomEvent("7tool:prototype-event", { detail:{ event, page_type:resolvePageType(window.location.pathname), placement:"contact_request_dialog", request_type:"selection" } }));
}

function resolvePageType(pathname: string) {
  if (pathname.startsWith("/p/")) return "product";
  if (pathname.startsWith("/c/")) return "category";
  if (pathname.startsWith("/search")) return "search";
  return "catalog";
}
