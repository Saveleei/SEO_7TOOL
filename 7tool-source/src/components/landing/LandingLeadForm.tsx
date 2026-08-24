"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SelectionField } from "@/lib/category-content";
import { readAttribution } from "@/components/AttributionCapture";
import { trackConfirmedLead, trackEvent } from "@/lib/analytics";
import { company } from "@/lib/site-config";
import { clearLandingSelection, readLandingSelection } from "@/lib/landing-selection";
import { LANDING_QUICK_TASK_EVENT, type LandingQuickTaskDetail } from "@/components/landing/LandingQuickTasks";
import { sendLead } from "@/lib/lead-client";

type Props = {
  category: string;
  intent: string;
  title: string;
  questions: SelectionField[];
  compact?: boolean;
  product?: { id: string; title: string; url: string };
  responsePromise?: string;
};

export function LandingLeadForm({ category, intent, title, questions, compact = false, product, responsePromise }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [channel, setChannel] = useState<"phone" | "email">("phone");
  const [details, setDetails] = useState(false);
  const [started, setStarted] = useState(false);
  const [selectorStarted, setSelectorStarted] = useState(false);
  const [selectorComplete, setSelectorComplete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; requestId?: string; error?: string }>();
  const [quickTask, setQuickTask] = useState("");
  const [selectionMode, setSelectionMode] = useState<"known" | "unknown">("known");
  const formRef = useRef<HTMLFormElement>(null);
  const formId = useMemo(() => `lp-form-${category}-${intent}-${compact ? "hero" : "full"}`, [category, intent, compact]);

  useEffect(() => {
    function applyQuickTask(event: Event) {
      const detail = (event as CustomEvent<LandingQuickTaskDetail>).detail;
      if (!detail || detail.category !== category || detail.intent !== intent) return;
      setQuickTask(detail.label);
      setStep(1);
      const form = formRef.current;
      if (!form || !detail.questionName) return;
      const control = form.elements.namedItem(detail.questionName) as HTMLInputElement | HTMLSelectElement | null;
      if (!control) return;
      control.value = detail.value;
      control.dispatchEvent(new Event("change", { bubbles: true }));
    }
    window.addEventListener(LANDING_QUICK_TASK_EVENT, applyQuickTask);
    return () => window.removeEventListener(LANDING_QUICK_TASK_EVENT, applyQuickTask);
  }, [category, intent]);

  function markStart() {
    if (started) return;
    setStarted(true);
    trackEvent("lp_form_start", { form_id: formId, page_type: "landing", category, intent, placement: compact ? "hero" : "lower" });
  }

  function markSelector(form: HTMLFormElement) {
    if (!selectorStarted) {
      setSelectorStarted(true);
      trackEvent("lp_selector_start", { form_id: formId, page_type: "landing", category, intent, placement: compact ? "hero" : "lower" });
    }
    if (!selectorComplete && questions.every((question) => {
      const control = form.elements.namedItem(question.name) as HTMLInputElement | HTMLSelectElement | null;
      return Boolean(control?.value.trim());
    })) {
      setSelectorComplete(true);
      trackEvent("lp_selector_complete", { form_id: formId, page_type: "landing", category, intent, placement: compact ? "hero" : "lower" });
    }
  }

  function continueWithoutParameters() {
    markStart();
    setSelectionMode("unknown");
    trackEvent("lp_quick_choice", { form_id: formId, page_type: "landing", category, intent, placement: "unknown_parameters" });
    setStep(2);
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLInputElement>("[name='contact']")?.focus());
  }

  function continueToContact(form: HTMLFormElement) {
    markStart();
    setSelectionMode("known");
    const controls = questions.map((question) => form.elements.namedItem(question.name) as HTMLInputElement | HTMLSelectElement | null);
    const invalid = controls.find((control) => !control?.value.trim() || !control.checkValidity());
    if (invalid) {
      invalid.reportValidity();
      return;
    }
    markSelector(form);
    setStep(2);
    requestAnimationFrame(() => form.querySelector<HTMLInputElement>("[name='contact']")?.focus());
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setResult(undefined);
    const form = event.currentTarget;
    const data = new FormData(form);
    const selectedProducts = readLandingSelection(category, intent);
    const answers = Object.fromEntries(questions.map((question) => {
      const value = String(data.get(question.name) || "").trim();
      return [question.name, value || (selectionMode === "unknown" ? "Не знаю — требуется помощь инженера" : "")];
    }));
    const payload = {
      type: "landing_quote" as const,
      name: String(data.get("name") || ""),
      phone: channel === "phone" ? String(data.get("contact") || "") : "",
      email: channel === "email" ? String(data.get("contact") || "") : String(data.get("alternateEmail") || ""),
      company: String(data.get("company") || ""),
      inn: String(data.get("inn") || ""),
      message: String(data.get("message") || ""),
      productId: product?.id,
      productTitle: product?.title,
      productUrl: product?.url,
      pageUrl: window.location.href,
      consent: data.get("consent") === "on",
      website: String(data.get("website") || ""),
      extra: {
        category,
        intent,
        landing: window.location.pathname,
        channel,
        answers,
        unknownParameters: selectionMode === "unknown",
        selectedProducts,
        quickTask,
        attribution: readAttribution(),
      },
    };
    try {
      const file = data.get("specification");
      const requisites = data.get("requisites");
      const json = await sendLead(payload, {
        specification: file instanceof File && file.size > 0 ? file : null,
        requisites: requisites instanceof File && requisites.size > 0 ? requisites : null,
      });
      if (!json.ok) throw new Error(json.error || "Не удалось отправить заявку");
      setResult({ ok: true, requestId: json.requestId });
      trackConfirmedLead(json.requestId, "lp_lead_submit", { form_id: formId, page_type: "landing", category, intent, channel, placement: compact ? "hero" : "lower", product_id: product?.id });
      clearLandingSelection(category, intent);
      form.reset();
      setQuickTask("");
      setSelectionMode("known");
      setStep(1);
    } catch (error) {
      setResult({ ok: false, error: error instanceof Error ? error.message : "Не удалось отправить заявку" });
    } finally {
      setBusy(false);
    }
  }

  async function emailIntent() {
    markStart();
    try {
      const response = await fetch("/api/email-intent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ category, intent }),
      });
      if (!response.ok) throw new Error("EMAIL_INTENT_NOT_RECORDED");
      trackEvent("lp_email_intent", { form_id: formId, page_type: "landing", category, intent, channel: "email" });
      window.location.href = `mailto:${company.email}?subject=${encodeURIComponent(`Подбор 7TOOL: ${title}`)}&body=${encodeURIComponent("Здравствуйте! Прошу подобрать оборудование.\n\nПараметры задачи:\n")}`;
    } catch {
      window.location.href = `mailto:${company.email}?subject=${encodeURIComponent(`Подбор 7TOOL: ${title}`)}`;
    }
  }

  if (result?.ok) {
    return (
      <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950">
        <div className="font-display text-lg font-extrabold">Запрос принят</div>
        {result.requestId && <p className="mt-1 text-sm">Номер обращения: <strong>{result.requestId}</strong></p>}
        <p className="mt-2 text-sm">Менеджер проверит параметры в рабочее время. Номер можно указать при звонке или в письме.</p>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      id={formId}
      onSubmit={submit}
      onFocus={markStart}
      onChange={(event) => {
        const target = event.target;
        if ((target instanceof HTMLInputElement || target instanceof HTMLSelectElement) && questions.some((question) => question.name === target.name)) {
          markSelector(event.currentTarget);
        }
      }}
      className="rounded-2xl border border-steel-200 bg-white p-4 shadow-card sm:p-5"
    >
      <div className="font-display text-[19px] font-extrabold text-steel-900">Получить цены, остатки и сроки</div>
      <p className="mt-1 text-[12.5px] leading-snug text-steel-600">Три параметра достаточно для первичного подбора.</p>
      {quickTask && <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-bold text-amber-950">Выбрано: {quickTask}</p>}
      <input type="hidden" name="quickTask" value={quickTask} />
      {responsePromise && <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-[11.5px] font-semibold leading-snug text-emerald-900">{responsePromise}</p>}
      <div className="mt-3 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.1em] text-steel-600" aria-label="Два шага формы">
        <span className={`rounded-full px-2.5 py-1 ${step === 1 ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"}`}>{step === 2 ? "✓ " : ""}1 · Задача</span>
        <span aria-hidden="true">→</span>
        <span className={`rounded-full px-2.5 py-1 ${step === 2 ? "bg-amber-100 text-amber-900" : "bg-steel-100"}`}>2 · Контакт</span>
      </div>
      <div className={step === 1 ? "mt-4 grid gap-3" : "hidden"}>
        {questions.map((question) => (
          <label key={question.name} className="grid gap-1 text-[12px] font-bold text-steel-700">
            {question.label} <span className="sr-only">(обязательное поле)</span><span aria-hidden="true" className="text-amber-700">*</span>
            {question.options ? (
              <select name={question.name} required={selectionMode === "known"} className="min-h-11 rounded-lg border border-steel-200 bg-white px-3 text-sm font-normal text-steel-900">
                <option value="">Выберите</option>
                {question.options.map((option) => <option key={option}>{option}</option>)}
              </select>
            ) : (
              <input name={question.name} required={selectionMode === "known"} placeholder={question.placeholder} className="min-h-11 rounded-lg border border-steel-200 px-3 text-sm font-normal text-steel-900" />
            )}
          </label>
        ))}
        <button type="button" onClick={(event) => continueToContact(event.currentTarget.form!)} className="mt-1 min-h-12 w-full rounded-lg bg-amber-400 px-4 text-sm font-extrabold text-steel-900 shadow-amber hover:bg-amber-300">
          Перейти к получению подбора
        </button>
        <button type="button" onClick={continueWithoutParameters} className="min-h-12 w-full rounded-lg border border-amber-300 bg-amber-50 px-4 text-sm font-extrabold text-amber-950 hover:bg-amber-100">
          Не знаю параметры — нужна помощь инженера
        </button>
        <p className="text-center text-[10.5px] leading-snug text-steel-500">На следующем шаге останется указать только телефон или email.</p>
      </div>
      <div className={step === 2 ? "block" : "hidden"}>
      <button type="button" onClick={() => setStep(1)} className="mt-3 text-[11.5px] font-bold text-amber-800 underline decoration-amber-300 underline-offset-4">← Изменить параметры задачи</button>
      <fieldset className="mt-3">
        <legend className="text-[12px] font-bold text-steel-700">Куда отправить результат</legend>
        <div className="mt-1 grid grid-cols-2 gap-2">
          {(["phone", "email"] as const).map((value) => (
            <label key={value} className={`flex min-h-11 items-center justify-center rounded-lg border text-sm font-bold ${channel === value ? "border-amber-400 bg-amber-50 text-amber-900" : "border-steel-200 text-steel-600"}`}>
              <input type="radio" className="sr-only" checked={channel === value} onChange={() => setChannel(value)} />
              {value === "phone" ? "Телефон" : "Email"}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="mt-3 grid gap-1 text-[12px] font-bold text-steel-700">
        {channel === "phone" ? "Телефон" : "Email"} <span className="sr-only">(обязательное поле)</span><span aria-hidden="true" className="text-amber-700">*</span>
        <input name="contact" type={channel === "phone" ? "tel" : "email"} required autoComplete={channel === "phone" ? "tel" : "email"} placeholder={channel === "phone" ? "+7 ___ ___-__-__" : "name@company.ru"} className="min-h-12 rounded-lg border border-steel-300 px-3 text-base font-normal text-steel-900" />
      </label>
      {!compact && (
        <div className="mt-3">
          <button type="button" onClick={() => setDetails((value) => !value)} className="text-[12px] font-bold text-amber-800 underline decoration-amber-300 underline-offset-4">
            {details ? "Скрыть дополнительные данные" : "Добавить компанию, ИНН или комментарий"}
          </button>
          {details && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input name="name" placeholder="Имя" className="min-h-11 rounded-lg border border-steel-200 px-3 text-sm" />
              <input name="company" placeholder="Компания" className="min-h-11 rounded-lg border border-steel-200 px-3 text-sm" />
              <input name="inn" inputMode="numeric" placeholder="ИНН" className="min-h-11 rounded-lg border border-steel-200 px-3 text-sm" />
              {channel === "phone" && <input name="alternateEmail" type="email" placeholder="Email (необязательно)" className="min-h-11 rounded-lg border border-steel-200 px-3 text-sm" />}
              <textarea name="message" rows={3} placeholder="Комментарий к задаче" className="rounded-lg border border-steel-200 px-3 py-2 text-sm sm:col-span-2" />
            </div>
          )}
          <label className="mt-3 grid gap-1 text-[12px] font-bold text-steel-700">
            Спецификация (необязательно)
            <input name="specification" type="file" accept=".pdf,.xls,.xlsx,.csv,.doc,.docx,.jpg,.jpeg,.png" className="min-h-11 rounded-lg border border-steel-200 bg-white px-3 py-2 text-[12px] font-normal" />
            <span className="font-normal text-steel-500">PDF, Excel, CSV, Word или изображение до 10 МБ.</span>
          </label>
        </div>
      )}
      <label className="mt-3 grid gap-1 text-[12px] font-bold text-steel-700">
        Реквизиты компании файлом (необязательно)
        <input name="requisites" type="file" accept=".pdf,.xls,.xlsx,.csv,.doc,.docx,.jpg,.jpeg,.png" className="min-h-11 rounded-lg border border-steel-200 bg-white px-3 py-2 text-[12px] font-normal" />
        <span className="font-normal text-steel-500">Можно приложить карточку организации в PDF, Word, Excel, JPG или PNG до 10 МБ. Файл хранится вне публичного доступа.</span>
      </label>
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <label className="mt-3 flex items-start gap-2 text-[11px] leading-snug text-steel-600">
        <input name="consent" type="checkbox" required className="mt-0.5 h-4 w-4 accent-amber-500" />
        <span>Согласен на обработку персональных данных для ответа на запрос.</span>
      </label>
      <button disabled={busy} className="mt-4 min-h-12 w-full rounded-lg bg-amber-400 px-4 text-sm font-extrabold text-steel-900 shadow-amber hover:bg-amber-300 disabled:opacity-60">
        {busy ? "Отправляем…" : "Получить 3–5 моделей и КП"}
      </button>
      <p className="mt-2 text-center text-[10.5px] leading-snug text-steel-500">Заявка не является заказом. Контакт используется только для ответа по вашему запросу.</p>
      <button type="button" onClick={emailIntent} className="mt-2 min-h-11 w-full rounded-lg border border-steel-200 text-[12px] font-bold text-steel-700 hover:border-amber-400 hover:bg-amber-50">
        Или написать со своей почты
      </button>
      {result?.error && <p role="alert" className="mt-3 text-[12px] font-semibold text-red-700">Не отправлено: {result.error}</p>}
      </div>
    </form>
  );
}
