"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "@/lib/cart";
import { fmtPrice, type CategoryIcon } from "@/lib/catalog";
import { useLiveVariants } from "@/lib/live";
import { formatPhone } from "@/lib/phone";
import { sendLead } from "@/lib/lead-client";
import { ProductImage } from "@/components/ProductImage";
import { trackConfirmedLead, trackEcommerce, trackEvent } from "@/lib/analytics";
import { advertisingOfferId } from "@/lib/advertising";

type CatalogRow = {
  productSlug: string;
  title: string;
  brand: string;
  category: string;
  sku: string;
  icon: CategoryIcon;
  images?: string[];
  variantId: string;
  price?: number;
  available: boolean;
  paramSummary: string;
};

export function CartView() {
  const { lines, count, setQty, remove, clear } = useCart();
  const live = useLiveVariants(lines.map((l) => l.id));
  const idsKey = lines.map((line) => line.id).join(",");
  const [catalogRows, setCatalogRows] = useState<CatalogRow[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const checkoutStarted = useRef(false);
  const [form, setForm] = useState({
    company: "",
    inn: "",
    name: "",
    phone: "",
    email: "",
    comment: "",
  });

  type Row = CatalogRow & {
    qty: number;
  };
  const rows = useMemo(() => {
    const qtyById = new Map(lines.map((line) => [line.id, line.qty]));
    return catalogRows.flatMap((row): Row[] => {
      const qty = qtyById.get(row.variantId);
      if (qty == null) return [];
      return [{
        ...row,
        qty,
        price: live[row.variantId]?.price ?? row.price,
        available: live[row.variantId]?.available ?? row.available,
      }];
    });
  }, [catalogRows, lines, live]);

  function ecommerceItem(row: Row, quantity: number) {
    return {
      id: advertisingOfferId(row.variantId), name: row.title, brand: row.brand,
      category: row.category, price: row.price, quantity, variant: row.sku, list: "cart",
    };
  }

  useEffect(() => {
    const controller = new AbortController();
    if (!idsKey) {
      setCatalogRows([]);
      setCatalogLoading(false);
      return () => controller.abort();
    }
    setCatalogLoading(true);
    fetch(`/api/cart?ids=${encodeURIComponent(idsKey)}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
      .then((data: { items?: CatalogRow[] }) => setCatalogRows(data.items ?? []))
      .catch(() => {
        if (!controller.signal.aborted) setCatalogRows([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setCatalogLoading(false);
      });
    return () => controller.abort();
  }, [idsKey]);

  if (count > 0 && catalogLoading && rows.length === 0) {
    return (
      <section className="bg-white py-16">
        <div className="mx-auto max-w-[1280px] px-6 text-center text-[14px] text-steel-500">
          Загружаем актуальные позиции корзины…
        </div>
      </section>
    );
  }

  // Итого считаем по live-ценам (а не по frozen-агрегату из провайдера корзины).
  const total = rows.reduce((s, r) => s + (r.price != null ? r.price * r.qty : 0), 0);

  if (count === 0 && !submitted) {
    return (
      <section className="bg-white py-16">
        <div className="mx-auto max-w-[1280px] px-6">
          <div className="mx-auto max-w-[560px] rounded-[var(--radius-card)] border border-dashed border-steel-200 bg-steel-50/40 px-8 py-14 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-cobalt-50 text-cobalt-700">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 4h2l2.5 12h12l2-9H6" />
                <circle cx="9" cy="20" r="1.5" />
                <circle cx="18" cy="20" r="1.5" />
              </svg>
            </div>
            <h2 className="mt-5 font-display text-[22px] font-semibold text-steel-900">
              Корзина пока пустая
            </h2>
            <p className="mt-2 text-[14px] text-steel-600">
              Откройте каталог — выберите типоразмер и добавьте позиции.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href="/c/koronchatye-sverla"
                className="inline-flex items-center justify-center rounded-md bg-amber-400 px-5 py-3 text-[13.5px] font-semibold text-steel-900 shadow-amber transition hover:-translate-y-0.5 hover:bg-amber-300"
              >
                Сверла корончатые
              </Link>
              <Link
                href="/c/stanki-sverlilnye"
                className="inline-flex items-center justify-center rounded-md border border-steel-200 bg-white px-5 py-3 text-[13.5px] font-semibold text-steel-700 hover:border-cobalt-300 hover:text-cobalt-700"
              >
                Магнитные станки
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (submitted) {
    return (
      <section className="bg-white py-16">
        <div className="mx-auto max-w-[1280px] px-6">
          <div className="mx-auto max-w-[560px] rounded-[var(--radius-card)] border border-cobalt-100 bg-gradient-to-br from-cobalt-50/60 via-white to-amber-50/40 px-8 py-14 text-center shadow-soft">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-700">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M5 12l4 4 10-10" />
              </svg>
            </div>
            <h2 className="mt-5 font-display text-[24px] font-semibold text-steel-900">
              Заявка принята
            </h2>
            <p className="mt-3 text-[14.5px] leading-relaxed text-steel-600">
              Менеджер свяжется в течение 15 минут в рабочее время и подтвердит цены / срок отгрузки.
            </p>
            <div className="mt-6">
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-md bg-amber-400 px-5 py-3 text-[13.5px] font-semibold text-steel-900 shadow-amber transition hover:-translate-y-0.5 hover:bg-amber-300"
              >
                На главную
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const hasUnpriced = rows.some((r) => r.price == null);

  return (
    <section className="bg-white py-12 lg:py-14">
      <div className="mx-auto max-w-[1280px] px-6">
        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[13px] text-steel-500">
              <span>
                В корзине <span className="font-semibold text-steel-900">{count}</span> поз.
              </span>
              <button onClick={clear} className="font-medium text-steel-500 hover:text-amber-700">
                Очистить корзину
              </button>
            </div>

            {rows.map((r) => (
              <article
                key={r.variantId}
                className="grid gap-4 rounded-[var(--radius-card)] border border-steel-100 bg-white p-4 shadow-soft sm:grid-cols-[120px_1fr_auto] sm:items-center"
              >
                <Link href={`/p/${r.productSlug}`} className="overflow-hidden rounded-md border border-steel-100">
                  <ProductImage
                    p={{ icon: r.icon, title: r.title, images: r.images }}
                    className="aspect-square"
                    sizes="120px"
                  />
                </Link>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-steel-500">
                    <span className="font-semibold text-steel-700">{r.brand}</span>
                    <span className="text-steel-300">·</span>
                    <span>арт. {r.sku}</span>
                  </div>
                  <Link
                    href={`/p/${r.productSlug}`}
                    className="mt-1 block text-[14.5px] font-medium leading-snug text-steel-900 transition hover:text-cobalt-700"
                  >
                    {r.title}
                  </Link>
                  {r.paramSummary && (
                    <div className="mt-1 text-[12.5px] text-steel-500">{r.paramSummary}</div>
                  )}
                </div>

                <div className="flex flex-col items-end gap-3">
                  <div className="inline-flex items-center rounded-md border border-steel-200 bg-white">
                    <button
                      onClick={() => {
                        trackEcommerce("remove", [ecommerceItem(r, 1)]);
                        trackEvent("remove_from_cart", { page_type: "cart", category: r.category, variant_id: r.variantId, brand: r.brand });
                        setQty(r.variantId, r.qty - 1);
                      }}
                      aria-label="Меньше"
                      className="grid h-9 w-9 place-items-center text-steel-600 hover:text-steel-900"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={r.qty}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (Number.isFinite(v)) {
                          const next = Math.max(1, v);
                          if (next > r.qty) trackEcommerce("add", [ecommerceItem(r, next - r.qty)]);
                          if (next < r.qty) trackEcommerce("remove", [ecommerceItem(r, r.qty - next)]);
                          setQty(r.variantId, next);
                        }
                      }}
                      className="h-9 w-12 border-x border-steel-200 bg-white text-center text-[14px] focus:outline-none"
                    />
                    <button
                      onClick={() => {
                        trackEcommerce("add", [ecommerceItem(r, 1)]);
                        setQty(r.variantId, r.qty + 1);
                      }}
                      aria-label="Больше"
                      className="grid h-9 w-9 place-items-center text-steel-600 hover:text-steel-900"
                    >
                      +
                    </button>
                  </div>
                  <div className="text-right">
                    {r.price != null ? (
                      <>
                        <div className="font-display text-[16px] font-bold text-steel-900">
                          {fmtPrice(r.price * r.qty)}
                        </div>
                        {r.qty > 1 && (
                          <div className="text-[11.5px] text-steel-400">
                            {fmtPrice(r.price)} × {r.qty}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="font-display text-[14px] font-bold text-steel-900">
                        Цена по запросу
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      trackEcommerce("remove", [ecommerceItem(r, r.qty)]);
                      trackEvent("remove_from_cart", { page_type: "cart", category: r.category, variant_id: r.variantId, brand: r.brand });
                      remove(r.variantId);
                    }}
                    className="text-[12px] font-medium text-steel-500 hover:text-amber-700"
                  >
                    Удалить
                  </button>
                </div>
              </article>
            ))}
          </div>

          <aside className="lg:sticky lg:top-28 lg:self-start">
            <form
              onFocus={() => {
                if (checkoutStarted.current) return;
                checkoutStarted.current = true;
                trackEvent("begin_checkout", { form_id: "cart_quote", page_type: "cart", placement: "checkout_form" });
              }}
              onSubmit={async (e) => {
                e.preventDefault();
                if (submitting) return;
                setSubmitting(true);
                setSubmitError("");
                const items = rows.map((row) => `· ${row.title} (${row.sku}) × ${row.qty}${row.price ? " — " + row.price * row.qty + " ₽" : ""}`).join("\n");
                try {
                  const res = await sendLead({
                    type: "cart_quote",
                    name: form.name,
                    company: form.company,
                    inn: form.inn,
                    phone: form.phone,
                    email: form.email,
                    message: `Корзина: ${rows.length} позиций · ${count} ед.\n${items}${form.comment ? "\n\nКомментарий:\n" + form.comment : ""}`,
                  });
                  if (res.ok) {
                    trackConfirmedLead(res.requestId, "submit_cart_quote", { form_id: "cart_quote", page_type: "cart", placement: "checkout_form" });
                    setSubmitted(true);
                    clear();
                  } else {
                    setSubmitError("Не удалось отправить заявку. Проверьте контактные данные или попробуйте ещё раз.");
                  }
                } finally {
                  setSubmitting(false);
                }
              }}
              className="rounded-[var(--radius-card)] border border-steel-100 bg-gradient-to-br from-white to-cobalt-50/30 p-6 shadow-card"
            >
              <h2 className="font-display text-[18px] font-semibold text-steel-900">Оформление</h2>

              <dl className="mt-4 space-y-2 text-[13.5px]">
                <div className="flex justify-between text-steel-600">
                  <dt>Позиций</dt>
                  <dd>{rows.length}</dd>
                </div>
                <div className="flex justify-between text-steel-600">
                  <dt>Единиц</dt>
                  <dd>{count}</dd>
                </div>
                <div className="flex justify-between text-steel-600">
                  <dt>Доставка</dt>
                  <dd>обсудим с менеджером</dd>
                </div>
              </dl>

              <div className="mt-4 border-t border-steel-100 pt-4">
                <div className="text-[12px] uppercase tracking-[0.14em] text-steel-500">Итого</div>
                {total > 0 ? (
                  <>
                    <div className="font-display text-[24px] font-bold leading-tight text-steel-900">
                      {fmtPrice(total)}
                    </div>
                    {hasUnpriced && (
                      <div className="mt-1 text-[12px] text-amber-700">
                        + позиции по запросу — рассчитаем в КП
                      </div>
                    )}
                  </>
                ) : (
                  <div className="font-display text-[20px] font-bold text-steel-900">
                    Цена по запросу
                  </div>
                )}
                <div className="mt-1 text-[12px] text-steel-500">
                  Цена с НДС. Окончательную сумму менеджер подтвердит в КП.
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                <Field label="Компания" placeholder='ООО "Завод-Тест"' value={form.company} onChange={(v) => setForm({ ...form, company: v })} />
                <Field label="ИНН" placeholder="7727456123" value={form.inn} onChange={(v) => setForm({ ...form, inn: v })} />
                <Field label="Контактное лицо" placeholder="Иванов И.И." required value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
                <Field label="Телефон" type="tel" placeholder="+7 (___) ___-__-__" required value={form.phone} onChange={(v) => setForm({ ...form, phone: formatPhone(v) })} />
                <Field label="E-mail" type="email" placeholder="snab@company.ru" required value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
                <label className="flex flex-col gap-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-steel-500">
                  Комментарий
                  <textarea
                    rows={3}
                    value={form.comment}
                    onChange={(e) => setForm({ ...form, comment: e.target.value })}
                    placeholder="Сроки, отсрочка, особые условия"
                    className="rounded-md border border-steel-200 bg-white px-3 py-2 text-[14px] font-normal normal-case tracking-normal text-steel-900 placeholder:text-steel-400 focus:border-cobalt-400 focus:outline-none"
                  />
                </label>
              </div>

              {submitError && (
                <p role="alert" aria-live="assertive" className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-700">
                  {submitError}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-amber-400 px-5 py-3 text-[14px] font-semibold text-steel-900 shadow-amber transition hover:-translate-y-0.5 hover:bg-amber-300 disabled:cursor-wait disabled:opacity-60"
              >
                {submitting ? "Отправляем…" : "Отправить заявку"}
              </button>
              <p className="mt-3 text-center text-[11.5px] leading-snug text-steel-500">
                Нажимая «Отправить», соглашаетесь с обработкой персональных данных.
              </p>
            </form>
          </aside>
        </div>
      </div>
    </section>
  );
}

function Field({
  label, type = "text", placeholder, value, onChange, required,
}: {
  label: string; type?: string; placeholder?: string;
  value: string; onChange: (v: string) => void; required?: boolean;
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
