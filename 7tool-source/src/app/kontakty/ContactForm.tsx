"use client";

import { useState } from "react";
import { formatPhone } from "@/lib/phone";
import { sendLead } from "@/lib/lead-client";
import { trackConfirmedLead } from "@/lib/analytics";

export function ContactForm() {
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    topic: "consult" as "consult" | "quote" | "service",
    name: "",
    company: "",
    phone: "",
    email: "",
    message: "",
  });

  const TOPIC_LABEL = { consult: "Консультация", quote: "Запрос КП", service: "Сервис" };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const r = await sendLead({
      type: "contact_form",
      name: form.name,
      company: form.company,
      phone: form.phone,
      email: form.email,
      message: `Тема: ${TOPIC_LABEL[form.topic]}${form.message ? "\n\n" + form.message : ""}`,
    });
    setBusy(false);
    if (!r.ok) { setErr(r.error || "Не удалось отправить"); return; }
    trackConfirmedLead(r.requestId, "submit_contact", { form_id: "contact_form", page_type: "contact", intent: form.topic });
    setSubmitted(true);
  }

  const topics: { id: typeof form.topic; label: string; hint: string }[] = [
    { id: "consult", label: "Консультация", hint: "Подбор инструмента под задачу" },
    { id: "quote", label: "Запрос КП", hint: "Цена и сроки на список позиций" },
    { id: "service", label: "Сервис", hint: "Шеф-монтаж, пусконаладка, ремонт" },
  ];

  if (submitted) {
    return (
      <div className="rounded-[var(--radius-card)] border border-cobalt-100 bg-gradient-to-br from-cobalt-50/60 via-white to-amber-50/40 p-8 text-center shadow-card">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-700">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M5 12l4 4 10-10" />
          </svg>
        </div>
        <h3 className="mt-5 font-display text-[20px] font-semibold text-steel-900">
          Заявка принята
        </h3>
        <p className="mt-2 text-[14px] leading-relaxed text-steel-600">
          Менеджер изучит запрос и свяжется с вами в рабочее время.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-[var(--radius-card)] border border-steel-100 bg-white p-6 shadow-card lg:sticky lg:top-28"
    >
      <h2 className="font-display text-[20px] font-semibold text-steel-900">
        Оставьте заявку
      </h2>
      <p className="mt-1 text-[13.5px] text-steel-600">
        Ответим в рабочее время. Без бесконечного автоответчика.
      </p>

      <div className="mt-5 grid grid-cols-3 gap-2">
        {topics.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setForm({ ...form, topic: t.id })}
            className={`rounded-md border px-3 py-3 text-left transition ${
              form.topic === t.id
                ? "border-cobalt-500 bg-cobalt-50 shadow-cobalt"
                : "border-steel-200 bg-white hover:border-cobalt-300"
            }`}
          >
            <div className={`text-[13px] font-semibold ${form.topic === t.id ? "text-cobalt-700" : "text-steel-900"}`}>
              {t.label}
            </div>
            <div className="mt-0.5 text-[11.5px] leading-snug text-steel-500">{t.hint}</div>
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-3">
        <Field label="Имя" required value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Иван Петров" />
        <Field label="Компания" value={form.company} onChange={(v) => setForm({ ...form, company: v })} placeholder='ООО "Завод-Тест"' />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Телефон" type="tel" required value={form.phone} onChange={(v) => setForm({ ...form, phone: formatPhone(v) })} placeholder="+7 (___) ___-__-__" />
          <Field label="E-mail" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} placeholder="snab@company.ru" />
        </div>
        <label className="flex flex-col gap-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-steel-500">
          Сообщение
          <textarea
            rows={4}
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            placeholder="Что обрабатываете, серийность, сроки"
            className="rounded-md border border-steel-200 bg-white px-3 py-2 text-[14px] font-normal normal-case tracking-normal text-steel-900 placeholder:text-steel-400 focus:border-cobalt-400 focus:outline-none"
          />
        </label>
      </div>

      {err && <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">{err}</div>}
      <button
        type="submit"
        disabled={busy}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-amber-400 px-5 py-3 text-[14px] font-semibold text-steel-900 shadow-amber transition hover:-translate-y-0.5 hover:bg-amber-300 disabled:opacity-60"
      >
        {busy ? "Отправляем…" : "Отправить заявку"}
      </button>
      <p className="mt-3 text-center text-[11.5px] leading-snug text-steel-500">
        Нажимая «Отправить», соглашаетесь с обработкой персональных данных.
      </p>
    </form>
  );
}

function Field({
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  required,
}: {
  label: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-steel-500">
      <span>{label}{required && <span className="text-amber-600"> *</span>}</span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-md border border-steel-200 bg-white px-3 py-2 text-[14px] font-normal normal-case tracking-normal text-steel-900 placeholder:text-steel-400 focus:border-cobalt-400 focus:outline-none"
      />
    </label>
  );
}
