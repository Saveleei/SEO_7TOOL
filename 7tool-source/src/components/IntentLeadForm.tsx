"use client";

import { useState } from "react";
import { trackConfirmedLead } from "@/lib/analytics";
import { sendLead } from "@/lib/lead-client";
import { leadProfileByKey, type LeadProfileKey } from "@/lib/lead-generation";
import { formatPhone } from "@/lib/phone";

type IntentLeadContext = {
  articleId?: string;
  keywordClusterId?: string;
  category?: string;
  intent?: string;
  product?: { id: string; title: string; url: string };
};

export function IntentLeadForm({ profileKey, context = {} }: { profileKey: LeadProfileKey; context?: IntentLeadContext }) {
  const profile = leadProfileByKey(profileKey);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const answerText = profile.questions
      .map((question) => `${question.label}: ${answers[question.name]?.trim() || "Не указано"}`)
      .join("\n");
    const result = await sendLead({
      type: profile.leadType,
      name,
      phone,
      email,
      message: answerText,
      productId: context.product?.id,
      productTitle: context.product?.title,
      productUrl: context.product?.url,
      articleId: context.articleId,
      keywordClusterId: context.keywordClusterId,
      category: context.category,
      intent: context.intent,
      ctaKey: profile.ctaKey,
      extra: { leadProfile: profile.key, answers },
    });
    setBusy(false);
    if (!result.ok) {
      setError("Не удалось отправить запрос. Проверьте телефон или попробуйте ещё раз.");
      return;
    }
    trackConfirmedLead(result.requestId, "submit_intent_lead", {
      form_id: `intent_lead_${profile.ctaKey}`,
      page_type: context.articleId ? "article" : "tool",
      category: context.category,
      intent: context.intent,
      product_id: context.product?.id,
      cta_key: profile.ctaKey,
    });
    setDone(true);
  }

  if (done) {
    return (
      <section id="intent-lead-form" className="scroll-mt-28 rounded-[14px] border border-emerald-200 bg-emerald-50 p-6" aria-live="polite">
        <h2 className="font-display text-[22px] font-extrabold text-steel-900">Запрос принят</h2>
        <p className="mt-2 text-[14px] leading-6 text-steel-700">{profile.success}</p>
      </section>
    );
  }

  return (
    <section id="intent-lead-form" className="scroll-mt-28 overflow-hidden rounded-[14px] border border-amber-300 bg-white shadow-card">
      <div className="border-b border-steel-100 bg-gradient-to-r from-amber-50 via-white to-cobalt-50/50 px-5 py-5 sm:px-6">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-700">{profile.eyebrow}</div>
        <h2 className="mt-2 font-display text-[24px] font-extrabold leading-tight tracking-tight text-steel-900">{profile.title}</h2>
        <p className="mt-2 max-w-[720px] text-[13.5px] leading-6 text-steel-600">{profile.description}</p>
      </div>
      <form onSubmit={submit} className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
        {profile.questions.map((question) => (
          <label key={question.name} className="text-[12px] font-bold text-steel-700">
            {question.label}
            <input
              value={answers[question.name] ?? ""}
              onChange={(event) => setAnswers((current) => ({ ...current, [question.name]: event.target.value }))}
              placeholder={question.placeholder}
              className="mt-1.5 min-h-11 w-full rounded-md border border-steel-200 px-3 py-2 text-[14px] font-normal text-steel-900 placeholder:text-steel-400 focus:border-amber-400 focus:outline-none"
            />
          </label>
        ))}
        <label className="text-[12px] font-bold text-steel-700">
          Имя
          <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" className="mt-1.5 min-h-11 w-full rounded-md border border-steel-200 px-3 py-2 text-[14px] font-normal focus:border-amber-400 focus:outline-none" />
        </label>
        <label className="text-[12px] font-bold text-steel-700">
          Телефон <span className="text-amber-700">*</span>
          <input required type="tel" value={phone} onChange={(event) => setPhone(formatPhone(event.target.value))} autoComplete="tel" placeholder="+7 (___) ___-__-__" className="mt-1.5 min-h-11 w-full rounded-md border border-steel-200 px-3 py-2 text-[14px] font-normal focus:border-amber-400 focus:outline-none" />
        </label>
        <label className="text-[12px] font-bold text-steel-700 sm:col-span-2">
          E-mail <span className="font-normal text-steel-500">(необязательно)</span>
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" className="mt-1.5 min-h-11 w-full rounded-md border border-steel-200 px-3 py-2 text-[14px] font-normal focus:border-amber-400 focus:outline-none" />
        </label>
        {error && <p role="alert" aria-live="assertive" className="text-[13px] text-red-700 sm:col-span-2">{error}</p>}
        <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row sm:items-center">
          <button disabled={busy} className="min-h-12 rounded-md bg-amber-400 px-5 text-[14px] font-extrabold text-steel-900 shadow-amber transition hover:bg-amber-300 disabled:opacity-60">
            {busy ? "Отправляем…" : profile.cta}
          </button>
          <p className="text-[11.5px] leading-snug text-steel-500">Нажимая кнопку, вы соглашаетесь с обработкой персональных данных.</p>
        </div>
      </form>
    </section>
  );
}
