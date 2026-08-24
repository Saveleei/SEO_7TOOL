"use client";

import { useState } from "react";
import type { SelectionField } from "@/lib/category-content";
import { sendLead } from "@/lib/lead-client";
import { formatPhone } from "@/lib/phone";
import { trackConfirmedLead } from "@/lib/analytics";

export type SelectionProductContext = {
  id: string;
  variantId?: string;
  title: string;
  sku: string;
  url: string;
};

export function CategorySelectionForm({
  category,
  categoryTitle,
  fields,
  subcategory,
  heading,
  productContext,
  embedded = false,
}: {
  category: string;
  categoryTitle: string;
  fields: SelectionField[];
  subcategory?: string;
  heading?: string;
  productContext?: SelectionProductContext;
  embedded?: boolean;
}) {
  // Conversion guard: even if a category is expanded later, the public form
  // stays short. Three task questions plus a phone number is the visible path.
  const compactFields = fields.slice(0, 3);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [comment, setComment] = useState("");
  const [requisites, setRequisites] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const productReference = productContext
    ? `${productContext.title}${productContext.title.toLocaleLowerCase("ru").includes(productContext.sku.toLocaleLowerCase("ru")) ? "" : `, арт. ${productContext.sku}`}`
    : "";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const technical = compactFields
      .map((field) => [field.label, answers[field.name]] as const)
      .filter(([, value]) => value?.trim())
      .map(([label, value]) => `${label}: ${value}`)
      .join("\n");
    const result = await sendLead({
      type: "equipment_selection",
      name,
      phone,
      email,
      message: [technical, comment && `Комментарий: ${comment}`].filter(Boolean).join("\n"),
      productId: productContext?.id,
      variantId: productContext?.variantId,
      productTitle: productContext
        ? `${heading ?? `Подбор · ${categoryTitle}`} · ${productReference}`
        : `Подбор · ${categoryTitle}${subcategory ? ` · ${subcategory}` : ""}`,
      productUrl: productContext?.url,
      extra: {
        category,
        categoryTitle,
        subcategory,
        answers: Object.fromEntries(compactFields.map((field) => [field.name, answers[field.name] ?? ""])),
        productContext,
      },
    }, { requisites });
    setBusy(false);
    if (!result.ok) {
      setError("Не удалось отправить. Проверьте телефон или попробуйте ещё раз.");
      return;
    }
    trackConfirmedLead(result.requestId, "submit_equipment_selection", { form_id: "category_selection", page_type: productContext ? "product" : "category", category, subcategory, product_id: productContext?.id, variant_id: productContext?.variantId });
    setDone(true);
  }

  if (done) {
    return (
      <section id="selection-form" className={`scroll-mt-24 border border-emerald-200 bg-emerald-50/60 ${embedded ? "mt-12 rounded-[14px]" : "border-x-0"}`} aria-live="polite">
        <div className={`mx-auto max-w-[1280px] py-8 ${embedded ? "px-5" : "px-4 sm:px-6"}`}>
          <h2 className="font-display text-[22px] font-extrabold text-steel-900">Заявка на подбор принята</h2>
          <p className="mt-2 text-[14px] text-steel-700">Инженер изучит параметры и ответит в рабочее время.</p>
        </div>
      </section>
    );
  }

  return (
    <section id="selection-form" className={`scroll-mt-24 border border-steel-200 bg-steel-50/60 ${embedded ? "mt-12 overflow-hidden rounded-[14px]" : "border-x-0"}`}>
      <div className={`mx-auto grid max-w-[1280px] gap-6 py-8 lg:grid-cols-[320px_1fr] lg:items-start ${embedded ? "px-4 sm:px-5" : "px-4 sm:px-6"}`}>
        <div>
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700">Инженерный подбор</span>
          <h2 className="mt-2 font-display text-[23px] font-extrabold leading-tight text-steel-900">{heading ?? "Подобрать оборудование"}</h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-steel-600">
            Три коротких вопроса помогут инженеру сразу предложить подходящие варианты и цены. Можно указать только известные параметры.
          </p>
          {productContext && (
            <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] leading-snug text-steel-700">
              Заявка будет привязана к товару <span className="font-bold text-steel-900">{productReference}</span>.
            </p>
          )}
        </div>
        <form onSubmit={submit} className="grid min-w-0 gap-4 rounded-[14px] border border-steel-200 bg-white p-4 shadow-card sm:grid-cols-2 sm:p-5">
          {compactFields.map((field) => (
            <label key={field.name} className="min-w-0 text-[12px] font-bold text-steel-700">
              {field.label}
              {field.options ? (
                <select
                  value={answers[field.name] ?? ""}
                  onChange={(e) => setAnswers((current) => ({ ...current, [field.name]: e.target.value }))}
                  className="mt-1.5 w-full rounded-md border border-steel-200 bg-white px-3 py-2.5 text-[14px] font-normal text-steel-900 focus:border-amber-400 focus:outline-none"
                >
                  <option value="">Выберите, если знаете</option>
                  {field.options.map((option) => <option key={option}>{option}</option>)}
                </select>
              ) : (
                <input
                  value={answers[field.name] ?? ""}
                  onChange={(e) => setAnswers((current) => ({ ...current, [field.name]: e.target.value }))}
                  placeholder={field.placeholder}
                  className="mt-1.5 w-full rounded-md border border-steel-200 px-3 py-2.5 text-[14px] font-normal text-steel-900 placeholder:text-steel-400 focus:border-amber-400 focus:outline-none"
                />
              )}
            </label>
          ))}
          <label className="text-[12px] font-bold text-steel-700">
            Телефон <span className="text-amber-700">*</span>
            <input required type="tel" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} placeholder="+7 (___) ___-__-__" className="mt-1.5 w-full rounded-md border border-steel-200 px-3 py-2.5 text-[14px] font-normal focus:border-amber-400 focus:outline-none" />
          </label>
          <details className="group rounded-md border border-steel-200 bg-steel-50/60 sm:col-span-2">
            <summary className="cursor-pointer list-none px-3 py-2.5 text-[12.5px] font-bold text-steel-700 marker:hidden">
              <span className="flex items-center justify-between gap-3">
                Добавить имя, e-mail или комментарий
                <span aria-hidden="true" className="text-[16px] text-amber-700 transition group-open:rotate-45">+</span>
              </span>
            </summary>
            <div className="grid gap-4 border-t border-steel-200 p-3 sm:grid-cols-2">
              <label className="text-[12px] font-bold text-steel-700">
                Имя
                <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className="mt-1.5 w-full rounded-md border border-steel-200 bg-white px-3 py-2.5 text-[14px] font-normal focus:border-amber-400 focus:outline-none" />
              </label>
              <label className="text-[12px] font-bold text-steel-700">
                E-mail
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className="mt-1.5 w-full rounded-md border border-steel-200 bg-white px-3 py-2.5 text-[14px] font-normal focus:border-amber-400 focus:outline-none" />
              </label>
              <label className="text-[12px] font-bold text-steel-700 sm:col-span-2">
                Комментарий
                <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder="Например, условия работы или желаемый срок" className="mt-1.5 w-full resize-y rounded-md border border-steel-200 bg-white px-3 py-2.5 text-[14px] font-normal focus:border-amber-400 focus:outline-none" />
              </label>
            </div>
          </details>
          <label className="text-[12px] font-bold text-steel-700 sm:col-span-2">
            Прикрепить реквизиты компании <span className="font-normal text-steel-500">(необязательно)</span>
            <input
              type="file"
              name="requisites"
              accept=".pdf,.xls,.xlsx,.csv,.doc,.docx,.jpg,.jpeg,.png"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                if (file && file.size > 10 * 1024 * 1024) {
                  setRequisites(null);
                  event.target.value = "";
                  setError("Файл реквизитов должен быть не больше 10 МБ.");
                  return;
                }
                setError("");
                setRequisites(file);
              }}
              className="mt-1.5 block w-full rounded-md border border-steel-200 bg-white px-3 py-2.5 text-[13px] font-normal text-steel-700 file:mr-3 file:rounded file:border-0 file:bg-amber-100 file:px-3 file:py-1.5 file:font-bold file:text-amber-900"
            />
            <span className="mt-1 block text-[11px] font-normal leading-snug text-steel-500">Карточка организации: PDF, Word, Excel, JPG или PNG до 10 МБ. Файл хранится вне публичного доступа.</span>
          </label>
          {error && <p role="alert" aria-live="assertive" className="text-[13px] text-red-700 sm:col-span-2">{error}</p>}
          <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row sm:items-center">
            <button disabled={busy} className="rounded-md bg-amber-400 px-5 py-3 text-[14px] font-bold text-steel-900 shadow-amber transition hover:bg-amber-300 disabled:opacity-60">
              {busy ? "Отправляем…" : "Получить подбор и цены"}
            </button>
            <p className="text-[11.5px] leading-snug text-steel-500">Без спама. Нажимая кнопку, вы соглашаетесь с обработкой персональных данных.</p>
          </div>
        </form>
      </div>
    </section>
  );
}
