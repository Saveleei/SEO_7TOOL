"use client";

import { FormEvent, useRef, useState } from "react";
import { buildRequestSource } from "../data/requestAttribution";

type RequestResult = { ok?: boolean; requestNumber?: string; message?: string };

export function TestRequestForm({ compact = false, context = "Опишите оборудование, параметры или вставьте позиции из спецификации.", buttonLabel, primaryContact = "email" }: { compact?: boolean; context?: string; buttonLabel?: string; primaryContact?: "email" | "phone" }) {
  const [submitting, setSubmitting] = useState(false);
  const [requestNumber, setRequestNumber] = useState("");
  const [formError, setFormError] = useState("");
  const idempotencyKeyRef = useRef("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const formData = new FormData(event.currentTarget);
    if (!idempotencyKeyRef.current) idempotencyKeyRef.current = crypto.randomUUID();
    const pageTitle = document.querySelector("h1")?.textContent?.trim() || "оборудование";
    formData.set("request_type", "selection");
    formData.set("city", "");
    formData.set("comment", String(formData.get("comment") || context));
    formData.set("idempotency_key", idempotencyKeyRef.current);
    formData.set("alternatives", "on");
    formData.set("check_availability", "on");
    formData.set("check_set", "on");
    formData.set("check_docs", "on");
    formData.set("items", JSON.stringify([{ id:"selection:category", title:`Инженерный подбор: ${pageTitle}`, article:"Без артикула — подбор по параметрам", quantity:1, href:`${window.location.pathname}${window.location.search}` }]));
    formData.set("source", JSON.stringify(buildRequestSource()));
    setSubmitting(true);
    setFormError("");
    trackSelectionRequest("submit_selection_request");
    try {
      const response = await fetch("/api/quote-requests", { method:"POST", body:formData, headers:{ "X-Requested-With":"7tool-selection-request" } });
      const result = await response.json() as RequestResult;
      if (!response.ok || !result.ok || !result.requestNumber) throw new Error(result.message || "Не удалось сохранить задачу.");
      setRequestNumber(result.requestNumber);
      trackSelectionRequest("selection_request_success");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Не удалось сохранить задачу. Попробуйте ещё раз.");
      trackSelectionRequest("selection_request_error");
    } finally {
      setSubmitting(false);
    }
  }

  if (requestNumber) return <div className={compact ? "request-form request-form-compact" : "request-form"} role="status">
    <div className="test-form-mark">Задача сохранена</div>
    <b>Заявка № {requestNumber}</b>
    <p>Менеджер увидит параметры и свяжется по указанному телефону.</p>
    <button type="button" onClick={() => { setRequestNumber(""); idempotencyKeyRef.current = ""; }}>Отправить ещё одну задачу</button>
  </div>;

  return (
    <form className={compact ? "request-form request-form-compact" : "request-form"} onSubmit={submit}>
      <input className="request-cart-honeypot" name="website" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <div className="test-form-mark">Короткая форма · ответ по телефону</div>
      {primaryContact === "email" && <label>Рабочая почта<input name="email" type="email" autoComplete="email" placeholder="name@company.ru" /></label>}
      <label>Телефон для связи<input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+7 999 000-00-00" required /></label>
      <label>Имя или компания<input name="company" type="text" autoComplete="organization" maxLength={160} placeholder="Необязательно" /></label>
      <label>Что требуется<textarea name="comment" rows={compact ? 3 : 4} defaultValue={context} maxLength={2000} /></label>
      <label className="request-form-check"><input name="consent" type="checkbox" defaultChecked required /> <span>Я согласен с <a href="/soglasie-na-obrabotku" target="_blank">обработкой персональных данных</a></span></label>
      {formError && <p className="form-error" role="alert">{formError}</p>}
      <button type="submit" disabled={submitting}>{submitting ? "Сохраняем задачу…" : buttonLabel ?? (compact ? "Передать задачу инженеру" : "Отправить задачу")}</button>
      <small>После отправки заявка получит номер. Менеджер свяжется в рабочее время.</small>
    </form>
  );
}

function trackSelectionRequest(event: string) {
  window.dispatchEvent(new CustomEvent("7tool:prototype-event", { detail:{ event, page_type:"category", placement:"category_selection_form", request_type:"selection" } }));
}
