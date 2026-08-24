"use client";

import { useState } from "react";
import { Modal } from "./Modal";
import type { Product, Variant } from "@/lib/catalog";
import { fmtPrice } from "@/lib/catalog";
import { manager } from "@/lib/site-config";
import { formatPhone } from "@/lib/phone";
import { sendLead } from "@/lib/lead-client";
import { trackConfirmedLead } from "@/lib/analytics";

export function PriceMatch({ product, variant }: { product: Product; variant: Variant }) {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [phone, setPhone] = useState("");
  const [link, setLink] = useState("");
  const [seenPrice, setSeenPrice] = useState("");

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex items-center gap-2 text-[12.5px] font-semibold text-amber-700 hover:text-amber-800"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0z"/><path d="M9 12l2 2 4-4"/></svg>
        Нашли дешевле? Дадим скидку
      </button>

      <Modal open={open} onClose={() => { setOpen(false); setTimeout(() => setSubmitted(false), 200); }} width="max-w-[480px]">
        {submitted ? (
          <div className="p-8 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-700">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="M5 12l4 4 10-10" /></svg>
            </div>
            <h2 className="mt-5 font-display text-[20px] font-extrabold text-steel-900">Запрос принят</h2>
            <p className="mt-2 text-[13.5px] text-steel-600">
              {manager.name} проверит цену конкурента и перезвонит на <b>{phone}</b> в течение 30 минут с предложением.
            </p>
          </div>
        ) : (
          <>
            <div className="relative bg-gradient-to-br from-amber-50 via-white to-amber-50/40 px-6 pb-5 pt-8">
              <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-300" />
              <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-amber-700">
                Гарантия лучшей цены
              </div>
              <h2 className="mt-1 font-display text-[20px] font-extrabold leading-tight text-steel-900">
                Нашли дешевле? Сделаем скидку и закроем разницу
              </h2>
              <p className="mt-1 text-[12.5px] text-steel-600">
                Пришлите ссылку — менеджер сверит позицию и перезвонит в течение 30 минут.
              </p>
            </div>
            <div className="grid gap-2 px-6 py-3 text-[12px] text-steel-600">
              <div className="flex items-center justify-between rounded-md bg-steel-50 px-3 py-2">
                <span className="truncate">{product.brand} · {variant.sku}</span>
                <span className="font-bold text-steel-900">
                  {variant.price != null ? fmtPrice(variant.price) : "по запросу"}
                </span>
              </div>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const r = await sendLead({
                  type: "price_match",
                  phone,
                  message: `Ссылка: ${link}${seenPrice ? "\nЦена конкурента: " + seenPrice + " ₽" : ""}`,
                  productId: product.id,
                  variantId: variant.id,
                  productTitle: `${product.brand} · ${variant.sku}${variant.price ? " · " + variant.price + " ₽" : ""}`,
                  productUrl: `/p/${product.slug}`,
                });
                if (r.ok) {
                  trackConfirmedLead(r.requestId, "submit_price_match", { form_id: "price_match", page_type: "product", category: product.category, product_id: product.id, variant_id: variant.id, brand: product.brand });
                  setSubmitted(true);
                }
              }}
              className="grid gap-3 border-t border-steel-100 px-6 py-4"
            >
              <label className="flex flex-col gap-1.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-steel-500">
                <span>Ссылка где видели <span className="text-amber-600">*</span></span>
                <input
                  type="url"
                  required
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="https://..."
                  className="rounded-md border border-steel-200 bg-white px-3 py-2 text-[14px] font-normal normal-case tracking-normal text-steel-900 placeholder:text-steel-400 focus:border-amber-400 focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-steel-500">
                <span>Цена конкурента, ₽</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={seenPrice}
                  onChange={(e) => setSeenPrice(e.target.value)}
                  placeholder="например, 12 480"
                  className="rounded-md border border-steel-200 bg-white px-3 py-2 text-[14px] font-normal normal-case tracking-normal text-steel-900 placeholder:text-steel-400 focus:border-amber-400 focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-steel-500">
                <span>Телефон <span className="text-amber-600">*</span></span>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  placeholder="+7 (___) ___-__-__"
                  className="rounded-md border border-steel-200 bg-white px-3 py-2 text-[14px] font-normal normal-case tracking-normal text-steel-900 placeholder:text-steel-400 focus:border-amber-400 focus:outline-none"
                />
              </label>
              <button
                type="submit"
                className="mt-1 inline-flex items-center justify-center gap-2 rounded-md bg-amber-400 px-5 py-3 text-[14px] font-bold text-steel-900 shadow-amber transition hover:-translate-y-0.5 hover:bg-amber-300"
              >
                Запросить скидку
              </button>
            </form>
          </>
        )}
      </Modal>
    </>
  );
}
