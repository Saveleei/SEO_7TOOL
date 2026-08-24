"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Product } from "@/lib/catalog";
import { cleanParamName, getProductAvailability, isValidPrice, priceLabel, productForListing } from "@/lib/catalog";
import { ProductImage } from "@/components/ProductImage";
import { trackEvent, trackEcommerce } from "@/lib/analytics";
import { LANDING_SELECTION_EVENT, readLandingSelection, toggleLandingSelection } from "@/lib/landing-selection";
import { advertisingVariantUrl, ecommerceProduct } from "@/lib/advertising";

export function LandingProductCard({ product, category, intent }: { product: Product; category: string; intent: string }) {
  const compact = productForListing(product);
  const availability = getProductAvailability(product);
  const representative = availability.availableVariants.find((variant) => isValidPrice(variant.price))
    ?? availability.orderableVariants.find((variant) => isValidPrice(variant.price))
    ?? product.variants[0];
  const url = representative ? advertisingVariantUrl(product, representative) : `/p/${product.slug}`;
  const keySpecs = getKeySpecs(product, category);
  const [selected, setSelected] = useState(false);
  useEffect(() => {
    const refresh = () => setSelected(readLandingSelection(category, intent).some((item) => item.id === product.id));
    refresh();
    window.addEventListener(LANDING_SELECTION_EVENT, refresh);
    return () => window.removeEventListener(LANDING_SELECTION_EVENT, refresh);
  }, [category, intent, product.id]);
  const trackProductClick = () => {
    trackEvent("lp_product_click", { category, intent, product_id: product.id, variant_id: representative?.id, placement: "landing_products" });
    if (representative) trackEcommerce("click", [ecommerceProduct(product, representative, `landing:${category}:${intent}`)]);
  };
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-steel-200 bg-white shadow-soft transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-card">
      <Link
        href={url}
        onClick={trackProductClick}
        className="block"
      >
        <ProductImage p={compact} className="aspect-[4/3] border-b border-steel-100" sizes="(max-width: 640px) 50vw, 260px" />
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-amber-700">{product.brand}</div>
        <Link href={url} onClick={trackProductClick} className="mt-1 line-clamp-3 font-display text-[15px] font-extrabold leading-tight text-steel-900 hover:text-amber-800">{product.title}</Link>
        {keySpecs.length > 0 && (
          <dl className="mt-3 grid gap-1 border-t border-steel-100 pt-2 text-[10.5px] leading-snug text-steel-600">
            {keySpecs.map((spec) => (
              <div key={spec.label} className="flex items-start justify-between gap-2">
                <dt className="line-clamp-1">{spec.label}</dt>
                <dd className="line-clamp-1 text-right font-bold text-steel-800">{spec.value}</dd>
              </div>
            ))}
          </dl>
        )}
        <div className={`mt-3 text-[11px] font-bold ${availability.priority <= 1 ? "text-emerald-700" : "text-steel-500"}`}>{availability.label}</div>
        <div className="mt-auto pt-2 font-display text-[18px] font-extrabold text-steel-900">{priceLabel(product)}</div>
        <button
          type="button"
          onClick={() => {
            const next = toggleLandingSelection(category, intent, { id: product.id, title: product.title, url, price: priceLabel(product) });
            const isSelected = next.some((item) => item.id === product.id);
            setSelected(isSelected);
            if (isSelected) trackEvent("lp_quick_choice", { category, intent, product_id: product.id, placement: "quote_selection" });
          }}
          className={`mt-3 inline-flex min-h-11 items-center justify-center rounded-lg border px-3 text-[12px] font-extrabold ${selected ? "border-amber-400 bg-amber-50 text-amber-700" : "border-amber-300 bg-amber-400 text-steel-900 hover:bg-amber-300"}`}
        >
          {selected ? "✓ Добавлено в КП" : "+ Добавить в КП"}
        </button>
        <Link href={url} onClick={trackProductClick} className="mt-2 inline-flex min-h-10 items-center justify-center rounded-lg border border-steel-200 px-3 text-[12px] font-extrabold text-steel-700 hover:border-amber-300">Подробнее</Link>
      </div>
    </article>
  );
}

const specKeywords: Record<string, string[]> = {
  "stanki-sverlilnye": ["диаметр", "мощность", "двигател", "шпиндел"],
  "koronchatye-sverla": ["материал режущей", "рабочая длина", "хвостовик", "диаметр"],
  borfrezy: ["форма", "тип насечки", "диаметр фрез", "диаметр хвостов"],
  "kromkorezy-po-listu": ["тип", "ширина фаски", "угол фаски", "привод"],
  "kromkorezy-dlya-trub": ["диаметр", "способ крепления", "доступные приводы", "толщина стенки"],
};

function getKeySpecs(product: Product, category: string): Array<{ label: string; value: string }> {
  const params = product.variants[0]?.params ?? [];
  const keywords = specKeywords[category] ?? [];
  const selected = keywords.flatMap((keyword) => {
    const param = params.find((item) => cleanParamName(item.name).toLocaleLowerCase("ru").includes(keyword));
    return param ? [{ label: cleanParamName(param.name), value: `${param.value}${param.unit ? ` ${param.unit}` : ""}` }] : [];
  });
  const unique = Array.from(new Map(selected.map((item) => [item.label, item])).values()).slice(0, 2);
  if (unique.length < 2 && product.variants.length > 1) {
    unique.push({ label: "Модификации", value: product.variants.length.toLocaleString("ru-RU") });
  }
  return unique.slice(0, 2);
}
