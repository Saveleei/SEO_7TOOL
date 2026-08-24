"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Product, Variant } from "@/lib/catalog";
import { cleanParamName, fmtPrice, variantSlug, variantTitle } from "@/lib/catalog";
import { manager } from "@/lib/site-config";
import { useLiveProduct } from "@/lib/live";
import { ProductImage } from "@/components/ProductImage";
import { AddToCartButton } from "@/components/AddToCartButton";
import { Spotlight } from "@/components/Spotlight";
import { ManagerBlock } from "@/components/ManagerBlock";
import { OneClickModal } from "@/components/OneClickModal";
import { StickyCta } from "./StickyCta";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { TrustRow } from "@/components/TrustRow";
import { SocialBumper } from "@/components/SocialBumper";
import { PriceMatch } from "@/components/PriceMatch";
import { FavoriteButton } from "@/components/FavoriteButton";
import { ProductFaq } from "@/components/ProductFaq";
import { CategorySelectionForm } from "@/components/CategorySelectionForm";
import type { SelectionField } from "@/lib/category-content";
import { brandSlug } from "@/lib/brand";
import { ecommerceProduct } from "@/lib/advertising";
import { trackEcommerce, trackEvent } from "@/lib/analytics";

export function ProductView({
  product: rawProduct,
  initialVariantId,
  categoryTitle,
  categorySlug,
  selectionTitle,
  selectionFields = [],
  hasVerifiedFaq = false,
  hasVerifiedEnrichment = false,
}: {
  product: Product;
  initialVariantId?: string;
  categoryTitle?: string;
  categorySlug?: string;
  selectionTitle?: string;
  selectionFields?: SelectionField[];
  hasVerifiedFaq?: boolean;
  hasVerifiedEnrichment?: boolean;
}) {
  // Свежие цена/наличие из /api/live слиты в товар — вся логика ниже (выбор варианта,
  // доступность осей, статус наличия, цена) сразу реактивна без пересборки сайта.
  const product = useLiveProduct(rawProduct);
  const fallback =
    product.variants.find((v) => v.available && (v.quantity ?? 0) > 0) ??
    product.variants.find((v) => v.available) ??
    product.variants[0];
  const initial = initialVariantId
    ? product.variants.find((v) => v.id === initialVariantId) ?? fallback
    : fallback;
  const [variantId, setVariantId] = useState(initial.id);
  const variant = product.variants.find((v) => v.id === variantId) ?? initial;
  // Точный остаток для маркетингового «осталось мало» берём из сборки (rawProduct),
  // а не из live — live наружу отдаёт только булево наличие, без числа штук.
  const rawQty = rawProduct.variants.find((v) => v.id === variantId)?.quantity ?? 0;
  const [oneClickOpen, setOneClickOpen] = useState(false);
  const initialUrlEffect = useRef(true);

  // Общий URL товарной группы остаётся стабильным при первом рендере. URL
  // модификации появляется только после осознанного выбора покупателя — так
  // canonical, история браузера и индексируемый адрес не расходятся.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (initialUrlEffect.current) {
      initialUrlEffect.current = false;
      if (!initialVariantId) return;
    }
    const newSlug = variantSlug(product, variant);
    const newPath = `/p/${newSlug}`;
    if (window.location.pathname !== newPath) {
      window.history.replaceState(null, "", newPath);
    }
  }, [initialVariantId, product, variant]);

  // Только фотографии самого товара/варианта из фида. Не подменяем их
  // обложкой категории и не показываем одинаковые URL несколько раз.
  const gallery = useMemo(
    () => Array.from(new Set([
      ...(variant.images ?? []),
      ...(product.images ?? []),
    ].filter(Boolean))),
    [variant.images, product.images],
  );
  const [imgIndex, setImgIndex] = useState(0);
  useEffect(() => { setImgIndex(0); }, [variantId]);
  const initialAnalyticsVariant = useRef(true);
  const lastTrackedVariant = useRef<string | null>(null);
  useEffect(() => {
    if (lastTrackedVariant.current === variant.id) return;
    lastTrackedVariant.current = variant.id;
    trackEcommerce("detail", [ecommerceProduct(product, variant, "product")]);
    if (initialAnalyticsVariant.current) {
      initialAnalyticsVariant.current = false;
    } else {
      trackEvent("select_variant", {
        page_type: "product",
        category: product.category,
        product_id: product.id,
        variant_id: variant.id,
        brand: product.brand,
      });
    }
  }, [product, variant]);

  const axes = product.paramAxes;
  const hasAxes = axes.length > 0 && product.variants.length > 1;
  const hasVariantPicker = product.variants.length > 1;
  const stockLine = stockLabel(variant);

  const optionsByAxis = useMemo(() => {
    const out: Record<string, { value: string; available: boolean }[]> = {};
    for (const axis of axes) {
      const map = new Map<string, { value: string; available: boolean }>();
      for (const v of product.variants) {
        const param = v.params.find((p) => p.name === axis);
        if (!param) continue;
        const cur = map.get(param.value);
        const slotAvail = v.available && (v.quantity ?? 0) > 0;
        if (!cur) {
          map.set(param.value, { value: param.value, available: slotAvail });
        } else if (slotAvail && !cur.available) {
          cur.available = true;
        }
      }
      out[axis] = Array.from(map.values());
    }
    return out;
  }, [product, axes]);

  const selectAxisValue = (axis: string, value: string) => {
    const cur = new Map<string, string>();
    for (const p of variant.params) cur.set(p.name, p.value);
    cur.set(axis, value);
    let candidate = product.variants.find((v) => {
      for (const [k, val] of cur) {
        if (axes.includes(k) && !v.params.some((p) => p.name === k && p.value === val)) return false;
      }
      return true;
    });
    if (!candidate) {
      candidate = product.variants.find((v) =>
        v.params.some((p) => p.name === axis && p.value === value),
      );
    }
    if (candidate) setVariantId(candidate.id);
  };

  // Split params into spec rows (excluding axes); group multi-value params by name
  const grouped = useMemo(() => {
    const map = new Map<string, { unit?: string; values: string[] }>();
    for (const p of variant.params) {
      if (axes.includes(p.name)) continue;
      const name = cleanParamName(p.name);
      const ent = map.get(name) ?? { unit: p.unit, values: [] };
      if (p.unit && !ent.unit) ent.unit = p.unit;
      if (!ent.values.includes(p.value)) ent.values.push(p.value);
      map.set(name, ent);
    }
    return Array.from(map.entries()).map(([name, v]) => ({ name, ...v }));
  }, [variant, axes]);
  const highlights = grouped
    .filter((item) => !/^(бренд|артикул|sku|штрихкод)$/i.test(item.name))
    .slice(0, 4);

  // подпись варианта в крошках — пересчитывается при смене variant
  const isVariantPick = product.isGroup && product.variants.length > 1;
  const variantCrumb = isVariantPick
    ? product.paramAxes
        .map((a) => variant.params.find((p) => p.name === a))
        .filter(Boolean)
        .map((p) => `${p!.value}${p!.unit ? ` ${p!.unit}` : ""}`)
        .join(" · ") || `арт. ${variant.sku}`
    : null;

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Главная", href: "/" },
          ...(categoryTitle && categorySlug ? [{ label: categoryTitle, href: `/c/${categorySlug}` }] : []),
          ...(isVariantPick
            ? [
                { label: product.title, href: `/p/${product.slug}` },
                { label: variantCrumb ?? `арт. ${variant.sku}` },
              ]
            : [{ label: product.title }]),
        ]}
      />

      {/* Top: large gallery + key info + manager */}
      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-12">
        {/* Gallery */}
        <div>
          <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-steel-200 bg-white shadow-card">
            <ProductImage
              p={{ icon: product.icon, title: product.title, images: gallery }}
              priority
              index={Math.min(imgIndex, Math.max(0, gallery.length - 1))}
              alt={`${variantTitle(product, variant)} — фото ${Math.min(imgIndex, Math.max(0, gallery.length - 1)) + 1}`}
              className="aspect-square sm:aspect-[5/4]"
              sizes="(min-width: 1024px) 56vw, 100vw"
            />
            {gallery.length > 1 && (
              <>
                <button
                  onClick={() => setImgIndex((i) => (i - 1 + gallery.length) % gallery.length)}
                  aria-label="Предыдущее фото"
                  className="absolute left-3 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full border border-steel-200 bg-white/95 text-steel-700 shadow-card transition hover:border-amber-400 hover:bg-amber-400 hover:text-steel-900 hover:shadow-amber"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M15 6l-6 6 6 6"/></svg>
                </button>
                <button
                  onClick={() => setImgIndex((i) => (i + 1) % gallery.length)}
                  aria-label="Следующее фото"
                  className="absolute right-3 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full border border-steel-200 bg-white/95 text-steel-700 shadow-card transition hover:border-amber-400 hover:bg-amber-400 hover:text-steel-900 hover:shadow-amber"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M9 6l6 6-6 6"/></svg>
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-steel-900/80 px-2.5 py-0.5 text-[11px] font-bold text-amber-300">
                  {imgIndex + 1} / {gallery.length}
                </div>
              </>
            )}
          </div>
          {gallery.length > 1 && (
            <div className="mt-3 grid grid-cols-4 gap-3">
              {gallery.slice(0, 8).map((src, i) => (
                <button
                  key={src}
                  onClick={() => setImgIndex(i)}
                  aria-label={`Фото ${i + 1}`}
                  className={`overflow-hidden rounded-md border-2 bg-white transition ${
                    i === imgIndex
                      ? "border-amber-500 shadow-amber"
                      : "border-steel-200 hover:border-amber-300 shadow-soft"
                  }`}
                >
                  <ProductImage
                    p={{ icon: product.icon, title: product.title, images: gallery }}
                    index={i}
                    alt={`${variantTitle(product, variant)} — фото ${i + 1}`}
                    className="aspect-square"
                    sizes="160px"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          <div className="flex items-center gap-3 text-[12px] uppercase tracking-[0.16em]">
            {product.brand && product.brand !== "—" ? (
              <Link href={`/brand/${brandSlug(product.brand)}`} className="font-bold tracking-[0.18em] text-amber-700 hover:text-amber-800 hover:underline">
                {product.brand}
              </Link>
            ) : null}
            <span className="text-steel-300">·</span>
            <span className="text-steel-500">арт. {variant.sku || product.sku}</span>
            {variant.barcode && (
              <>
                <span className="text-steel-300">·</span>
                <span className="text-steel-400">EAN {variant.barcode}</span>
              </>
            )}
          </div>
          <div className="mt-2 flex items-start justify-between gap-3">
            <h1 className="font-display text-[24px] font-extrabold leading-tight tracking-tight text-steel-900 lg:text-[30px]">
              {product.isGroup && product.variants.length > 1
                ? variantTitle(product, variant)
                : product.title}
            </h1>
            <FavoriteButton productId={product.id} className="shrink-0" />
          </div>

          {hasVariantPicker && (
            <div className="mt-6 rounded-[var(--radius-card)] border border-steel-200 bg-steel-50/60 p-4">
              <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.17em] text-amber-700">
                Быстрый выбор по характеристикам
              </div>
              {hasAxes ? <div className="space-y-4">
              {axes.map((axis) => {
                const opts = optionsByAxis[axis] ?? [];
                const current = variant.params.find((p) => p.name === axis)?.value;
                const unit = variant.params.find((p) => p.name === axis)?.unit;
                return (
                  <div key={axis}>
                    <div className="flex items-baseline justify-between">
                      <div className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-steel-500">
                        {cleanParamName(axis)}{unit && <span className="ml-1 text-steel-400">({unit})</span>}
                      </div>
                      {current && (
                        <div className="text-[12.5px] font-semibold text-steel-700">
                          {current}{unit ? ` ${unit}` : ""}
                        </div>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {opts.map((o) => {
                        const active = current === o.value;
                        return (
                          <button
                            key={o.value}
                            onClick={() => selectAxisValue(axis, o.value)}
                            className={`tip rounded-md border px-3 py-1.5 text-[13px] font-bold transition ${
                              active
                                ? "border-amber-500 bg-amber-400 text-steel-900 shadow-amber"
                                : o.available
                                ? "border-steel-200 bg-white text-steel-800 hover:border-amber-300 hover:bg-amber-50"
                                : "border-steel-200 bg-steel-50 text-steel-400 hover:border-amber-200"
                            }`}
                            data-tip={o.available ? "В наличии" : "Под заказ"}
                          >
                            {o.value}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              </div> : (
                <label className="block text-[12px] font-semibold text-steel-600">
                  Модификация
                  <select
                    value={variant.id}
                    onChange={(event) => setVariantId(event.target.value)}
                    className="mt-1.5 min-h-11 w-full rounded-md border border-steel-200 bg-white px-3 py-2 text-[13px] font-medium text-steel-900 focus:border-amber-400 focus:outline-none"
                  >
                    {product.variants.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.sku}{item.available && (item.quantity ?? 0) > 0 ? " · в наличии" : " · под заказ"}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )}

          <Spotlight className="mt-6 rounded-[var(--radius-card)] border border-steel-200 bg-white p-5 shadow-card transition hover:border-amber-300 hover:shadow-amber">
            <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
              {variant.price != null ? (
                <div className="font-display text-[36px] font-extrabold leading-none text-steel-900">
                  {fmtPrice(variant.price)}
                </div>
              ) : (
                <div className="font-display text-[26px] font-extrabold leading-none text-steel-900">
                  Цена по запросу
                </div>
              )}
              {variant.oldPrice != null && variant.price != null && variant.oldPrice > variant.price && (
                <>
                  <div className="text-[15px] text-steel-400 line-through">{fmtPrice(variant.oldPrice)}</div>
                  <span className="rounded-md bg-amber-400 px-2.5 py-1 text-[12px] font-extrabold uppercase tracking-wider text-steel-900 shadow-amber">
                    −{Math.round(((variant.oldPrice - variant.price) / variant.oldPrice) * 100)}%
                  </span>
                </>
              )}
            </div>

            <div className="mt-2.5">
              {stockLine.kind === "in" ? (
                <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[12px] font-bold text-emerald-700">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </span>
                  В наличии · со склада
                </span>
              ) : stockLine.kind === "preorder" ? (
                <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-[12px] font-bold text-amber-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  Под заказ
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-md border border-steel-200 bg-steel-50 px-2.5 py-1 text-[12px] font-bold text-steel-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-steel-300" />
                  Нет в наличии
                </span>
              )}
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              {variant.price != null ? (
                <>
                  <AddToCartButton variantId={variant.id} ecommerceItem={ecommerceProduct(product, variant, "product")} variant="primary">
                    {variant.available && (variant.quantity ?? 0) > 0 ? "В корзину" : "В корзину · под заказ"}
                  </AddToCartButton>
                  <button
                    onClick={() => setOneClickOpen(true)}
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-steel-200 bg-white px-5 py-3 text-[14px] font-semibold text-steel-700 transition hover:border-amber-400 hover:bg-amber-50 hover:text-amber-800"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                    Купить в 1 клик
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setOneClickOpen(true)}
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-amber-400 px-5 py-3 text-[14px] font-bold text-steel-900 shadow-amber transition hover:-translate-y-0.5 hover:bg-amber-300 hover:shadow-elev"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 5h18M3 12h18M3 19h12" /></svg>
                    Получить коммерческое предложение
                  </button>
                  <a
                    href={`tel:${manager.phone.replace(/\D/g, "")}`}
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-steel-200 bg-white px-5 py-3 text-[14px] font-semibold text-steel-700 transition hover:border-amber-400 hover:bg-amber-50 hover:text-amber-800"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                    Позвонить менеджеру
                  </a>
                </>
              )}
            </div>

            <SocialBumper productId={product.id} stock={rawQty} hasPrice={variant.price != null} />

            <PriceMatch product={product} variant={variant} />
          </Spotlight>

          <div className="mt-6">
            <ManagerBlock />
          </div>
        </div>
      </div>

      {/* Преимущества — полная ширина, чтобы 4 плашки не сжимались */}
      <TrustRow />

      {/* Сначала помогаем понять товар: ключевые параметры, описание и полная спецификация. */}
      {(product.description || (!hasVerifiedEnrichment && product.seoText) || grouped.length > 0) && (
        <section id="p-info" className="mt-12 scroll-mt-28">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700">
            <span className="h-px w-6 bg-amber-400" />
            О товаре
          </div>
          <h2 className="mt-2 font-display text-[24px] font-extrabold text-steel-900">
            Описание и характеристики
          </h2>

          {highlights.length > 0 && (
            <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {highlights.map((item) => (
                <div key={item.name} className="rounded-[12px] border border-steel-200 bg-steel-50/70 px-4 py-3">
                  <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-steel-500">{item.name}</div>
                  <div className="mt-1 text-[14px] font-bold leading-snug text-steel-900">
                    {item.values.join(", ")}{item.unit ? ` ${item.unit}` : ""}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)] lg:gap-14">
            {(product.description || (!hasVerifiedEnrichment && product.seoText)) && (
              <div>
                <h3 className="font-display text-[20px] font-extrabold text-steel-900">Описание товара</h3>
                {product.description && (
                  <p className="mt-4 whitespace-pre-line text-[15px] leading-relaxed text-steel-700">
                    {product.description}
                  </p>
                )}
                {!hasVerifiedEnrichment && product.seoText && (
                  <div className="mt-6 border-t border-steel-100 pt-5">
                    <h3 className="font-display text-[18px] font-bold text-steel-900">Назначение и применение</h3>
                    <div className="mt-3 space-y-3 text-[14px] leading-7 text-steel-700">
                      {product.seoText.split(/\n{2,}/).filter(Boolean).map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {grouped.length > 0 && (
              <div id="p-specs" className="scroll-mt-28">
                <h3 className="font-display text-[20px] font-extrabold text-steel-900">Все характеристики</h3>
                <dl className="mt-4 divide-y divide-steel-100 rounded-[var(--radius-card)] border border-steel-200 bg-white shadow-soft">
                  {grouped.map((g) => (
                    <div key={g.name} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-4 px-4 py-3">
                      <dt className="break-words text-[13px] text-steel-500">{g.name}</dt>
                      <dd className="break-words text-[14px] font-medium text-steel-900">
                        {g.values.join(", ")}
                        {g.unit ? ` ${g.unit}` : ""}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        </section>
      )}

      {/* После изучения товара — короткая тематическая форма подбора. */}
      {categorySlug && categoryTitle && selectionFields.length > 0 && (
        <CategorySelectionForm
          category={categorySlug}
          categoryTitle={categoryTitle}
          fields={selectionFields}
          heading={selectionTitle}
          embedded
          productContext={{
            id: product.id,
            title: variantTitle(product, variant),
            sku: variant.sku || product.sku,
            url: `/p/${variantSlug(product, variant)}`,
            variantId: variant.id,
          }}
        />
      )}

      {/* FAQ снимает оставшиеся возражения перед подтверждением склада. */}
      {!hasVerifiedFaq && <ProductFaq product={product} variant={variant} />}

      <OneClickModal
        open={oneClickOpen}
        onClose={() => setOneClickOpen(false)}
        product={product}
        variant={variant}
      />

      <StickyCta product={product} variant={variant} onOneClick={() => setOneClickOpen(true)} />
    </>
  );
}

function stockLabel(v: Variant): { kind: "in" | "preorder" | "out" } {
  if (!v.available) return { kind: "out" };
  if ((v.quantity ?? 0) <= 0) return { kind: "preorder" };
  return { kind: "in" };
}
