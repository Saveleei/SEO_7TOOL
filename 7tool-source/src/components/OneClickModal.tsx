"use client";

import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import type { Product, Variant } from "@/lib/catalog";
import { fmtPrice, variantSlug, variantTitle } from "@/lib/catalog";
import { manager } from "@/lib/site-config";
import { formatPhone } from "@/lib/phone";
import { sendLead } from "@/lib/lead-client";
import { ProductImage } from "./ProductImage";
import { ManagerPhoto } from "./ManagerPhoto";
import { trackConfirmedLead, trackEvent } from "@/lib/analytics";

export function OneClickModal({
  open,
  onClose,
  product,
  variant,
  intent = "one_click",
}: {
  open: boolean;
  onClose: () => void;
  product: Product;
  variant: Variant;
  intent?: "one_click" | "quote";
}) {
  const quoteMode = intent === "quote" || variant.price == null;
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string>();

  useEffect(() => {
    if (open) trackEvent("open_one_click", { page_type: "product", category: product.category, product_id: product.id, variant_id: variant.id, brand: product.brand, intent: quoteMode ? "quote" : "one_click" });
  }, [open, product.id, product.category, product.brand, variant.id, quoteMode]);

  const handleClose = () => {
    onClose();
    setTimeout(() => { setSubmitted(false); setErr(null); setRequestId(undefined); }, 200);
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const r = await sendLead({
      type: quoteMode ? "product_quote" : "one_click",
      name,
      phone,
      message: comment,
      productId: product.id,
      variantId: variant.id,
      productTitle: `${variantTitle(product, variant)} · арт. ${variant.sku}${variant.price ? " · " + variant.price + " ₽" : ""}`,
      productUrl: `/p/${variantSlug(product, variant)}`,
      extra: { intent: quoteMode ? "quote" : "one_click", variantId: variant.id, sku: variant.sku },
    });
    setBusy(false);
    if (!r.ok) { setErr(r.error || "Не удалось отправить"); return; }
    setRequestId(r.requestId);
    trackConfirmedLead(r.requestId, quoteMode ? "submit_product_quote" : "submit_one_click", {
      form_id: quoteMode ? "product_quote" : "one_click",
      page_type: "product",
      category: product.category,
      product_id: product.id,
      variant_id: variant.id,
      brand: product.brand,
      intent: quoteMode ? "quote" : "one_click",
    });
    setSubmitted(true);
  }

  return (
    <Modal open={open} onClose={handleClose} width="max-w-[520px]">
      {submitted ? (
        <div className="p-8 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-700">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="M5 12l4 4 10-10" /></svg>
          </div>
          <h2 className="mt-5 font-display text-[22px] font-extrabold text-steel-900">
            Заявка принята
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-steel-600">
            {manager.name} свяжется по номеру <span className="font-semibold text-steel-900">{phone}</span> в рабочее время — {quoteMode ? "уточнит условия и подготовит КП" : "подтвердит наличие и оформит счёт"}.
          </p>
          {requestId && <p className="mt-2 text-[12px] text-steel-600">Номер обращения: <strong>{requestId}</strong></p>}
          <button
            onClick={handleClose}
            className="mt-6 inline-flex items-center justify-center rounded-md bg-amber-400 px-5 py-3 text-[13.5px] font-bold text-steel-900 shadow-amber transition hover:-translate-y-0.5 hover:bg-amber-300"
          >
            Закрыть
          </button>
        </div>
      ) : (
        <>
          <div className="relative bg-gradient-to-br from-amber-50 via-white to-amber-50/40 px-6 pb-5 pt-8">
            <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-300" />
            <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-amber-700">
              {quoteMode ? "Коммерческое предложение" : "Купить в 1 клик"}
            </div>
            <h2 className="mt-1.5 font-display text-[20px] font-extrabold leading-tight text-steel-900">
              {quoteMode ? "Получить КП по выбранному товару" : "Заявка без оформления — менеджер перезвонит"}
            </h2>
          </div>

          <div className="grid gap-3 px-6 py-4 sm:grid-cols-[88px_1fr] sm:items-center">
            <div className="overflow-hidden rounded-md border border-steel-200">
              <ProductImage p={product} className="aspect-square" sizes="88px" />
            </div>
            <div className="min-w-0">
              <div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-amber-700">{product.brand}</div>
              <div className="mt-0.5 line-clamp-2 text-[13.5px] font-semibold text-steel-900">{product.title}</div>
              <div className="mt-1 text-[12px] text-steel-500">арт. {variant.sku}</div>
              {variant.price != null && (
                <div className="mt-1.5 font-display text-[18px] font-extrabold text-steel-900">
                  {fmtPrice(variant.price)}
                </div>
              )}
            </div>
          </div>

          <form
            onSubmit={onSubmit}
            className="grid gap-3 border-t border-steel-100 px-6 py-5"
          >
            <Field label="Ваше имя" value={name} onChange={setName} placeholder="Иван" required />
            <Field label="Телефон" value={phone} onChange={(v) => setPhone(formatPhone(v))} placeholder="+7 (___) ___-__-__" type="tel" required />
            <label className="flex flex-col gap-1.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-steel-500">
              Комментарий
              <textarea
                rows={2}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={quoteMode ? "Количество, реквизиты, сроки и особые условия" : "Кол-во, отсрочка, особые условия"}
                className="rounded-md border border-steel-200 bg-white px-3 py-2 text-[14px] font-normal normal-case tracking-normal text-steel-900 placeholder:text-steel-400 focus:border-amber-400 focus:outline-none"
              />
            </label>
            {err && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">{err}</div>}
            <button
              type="submit"
              disabled={busy}
              className="mt-1 inline-flex items-center justify-center gap-2 rounded-md bg-amber-400 px-5 py-3 text-[14px] font-bold text-steel-900 shadow-amber transition hover:-translate-y-0.5 hover:bg-amber-300 disabled:opacity-60"
            >
              {busy ? "Отправляем…" : quoteMode ? "Получить КП" : "Отправить заявку"}
            </button>
            <p className="text-center text-[11px] leading-snug text-steel-500">
              Нажимая «Отправить», вы соглашаетесь с обработкой персональных данных.
            </p>
          </form>

          <div className="flex items-center gap-3 border-t border-steel-100 bg-steel-50/60 px-6 py-3">
            <ManagerPhoto size={36} />
            <div className="text-[12px] leading-tight text-steel-600">
              <span className="font-semibold text-steel-900">{manager.name}</span> · ответит в рабочее время
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}

function Field({
  label, value, onChange, type = "text", placeholder, required,
}: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; required?: boolean }) {
  return (
    <label className="flex flex-col gap-1.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-steel-500">
      <span>{label}{required && <span className="text-amber-600"> *</span>}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="rounded-md border border-steel-200 bg-white px-3 py-2 text-[14px] font-normal normal-case tracking-normal text-steel-900 placeholder:text-steel-400 focus:border-amber-400 focus:outline-none"
      />
    </label>
  );
}
