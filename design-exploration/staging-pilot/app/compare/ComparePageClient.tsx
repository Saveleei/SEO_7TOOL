"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ContactRequestDialog } from "../ui/ContactRequestDialog";
import { AddRequestButton } from "../ui/RequestCart";
import { useComparison } from "../ui/Comparison";

type ComparisonProduct = {
  key: string;
  productId: string;
  variantId?: string;
  mode: "series" | "variant";
  modeLabel: string;
  slug: string;
  title: string;
  brand: string;
  sku: string;
  choiceLabel: string;
  image?: string;
  href: string;
  price: string;
  variantCount: number;
  available: boolean;
  shippingLabel: string;
  shippingDetail: string;
  specs: Array<{ label: string; value: string }>;
};

type ApiResponse = { ok: boolean; items?: ComparisonProduct[]; missing?: string[]; message?: string };
type ComparisonResult = { requestKey: string; products: ComparisonProduct[]; missing: string[]; error: string };

export function ComparePageClient() {
  const { items: selections, restored, remove, clear } = useComparison();
  const [result, setResult] = useState<ComparisonResult>({ requestKey:"", products:[], missing:[], error:"" });
  const requestKey = JSON.stringify(selections.map(({ slug, variantId }) => ({ slug, variantId })));

  useEffect(() => {
    if (!restored || requestKey === "[]") return;
    const controller = new AbortController();
    fetch(`/api/compare?items=${encodeURIComponent(requestKey)}`, { signal:controller.signal, cache:"no-store" })
      .then(async (response) => ({ response, payload:await response.json() as ApiResponse }))
      .then(({ response, payload }) => {
        if (!response.ok || !payload.ok) throw new Error(payload.message || "Не удалось обновить сравнение.");
        setResult({ requestKey, products:payload.items ?? [], missing:payload.missing ?? [], error:"" });
        trackView(payload.items ?? []);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setResult({ requestKey, products:[], missing:[], error:reason instanceof Error ? reason.message : "Не удалось обновить сравнение." });
      })
    return () => controller.abort();
  }, [requestKey, restored]);

  const currentResult = result.requestKey === requestKey ? result : { requestKey, products:[], missing:[], error:"" };
  const { products, missing, error } = currentResult;
  const loading = restored && selections.length > 0 && result.requestKey !== requestKey;

  const rows = useMemo(() => {
    const labels = Array.from(new Set(products.flatMap((product) => product.specs.map((spec) => spec.label))));
    return labels.slice(0, 16).map((label) => ({ label, values:products.map((product) => product.specs.find((spec) => spec.label === label)?.value ?? "") }));
  }, [products]);

  if (!restored || loading) return <ComparisonState title="Обновляем данные из каталога" copy="Проверяем актуальные цены, наличие и характеристики выбранных товаров." loading />;
  if (error) return <ComparisonState title="Сравнение временно не загрузилось" copy={error} retry />;
  if (selections.length === 0 || products.length === 0) return <ComparisonState title="Вы пока не выбрали товары" copy="Добавьте к сравнению две–четыре модели из категории или карточки товара." empty />;

  if (products.length === 1) {
    const product = products[0];
    return <section className="comparison-single-state container" aria-live="polite"><div><p className="eyebrow">Первый кандидат сохранён</p><h1>Добавьте ещё один товар</h1><p>После второго выбора появится единая таблица цены, наличия и решающих характеристик.</p><Link href={`/c/${selections[0]?.category ?? "stanki-sverlilnye"}`}>Вернуться в категорию</Link></div><ComparisonProductCard product={product} onRemove={() => remove(product.productId, "comparison_page")} /></section>;
  }

  const requestContext = products.map((product) => `${product.title}${product.choiceLabel ? ` — ${product.choiceLabel}` : ""}`).join("; ");
  return <>
    <section className="compare-hero"><div className="container compare-heading"><div><p className="eyebrow">Ваш выбор из текущего каталога</p><h1>{products.length} товара — одна таблица</h1><p>Цены, наличие и характеристики заново получены из действующего фида. Пустые значения не дополнены предположениями.</p></div><aside><b>Нужен вывод специалиста?</b><span>Инженер проверит применимость, исполнение и комплектность под вашу задачу.</span><ContactRequestDialog categoryTitle={`Сравнение: ${requestContext}`} buttonLabel="Получить рекомендацию" /></aside></div></section>

    <section className="compare-section comparison-dynamic-page"><div className="container">
      <div className="comparison-toolbar"><p>{missing.length > 0 ? `${missing.length} сохранённых позиций больше нет в текущем фиде.` : `Выбрано ${products.length} из 4. Можно вернуться в каталог и заменить любой товар.`}</p><button type="button" onClick={() => clear("comparison_page")}>Очистить сравнение</button></div>
      <p className="compare-scroll-hint" id="compare-scroll-hint">На узком экране проведите по таблице влево или вправо. Названия параметров закреплены слева.</p>
      <div className="compare-scroll" tabIndex={0} aria-describedby="compare-scroll-hint"><table className="comparison-table comparison-table--dynamic">
        <caption className="visually-hidden">Сравнение выбранных товаров по цене, наличию и рабочим характеристикам</caption>
        <thead><tr><th scope="col">Параметр</th>{products.map((product) => <th scope="col" key={product.key}><ComparisonProductCard product={product} onRemove={() => remove(product.productId, "comparison_page")} /></th>)}</tr></thead>
        <tbody>
          <tr><th scope="row">Наличие и срок</th>{products.map((product) => <td key={`${product.key}-shipping`}><span className={product.available ? "comparison-available" : undefined}>{product.shippingLabel}</span><small>{product.shippingDetail}</small></td>)}</tr>
          <tr><th scope="row">Выбранный уровень</th>{products.map((product) => <td key={`${product.key}-mode`}>{product.modeLabel}<small>{product.choiceLabel}</small></td>)}</tr>
          {rows.map((row) => <tr key={row.label}><th scope="row">{row.label}</th>{row.values.map((value, index) => <td key={`${products[index]?.key}-${row.label}`}>{value || <span className="comparison-unknown">Нет данных в фиде</span>}</td>)}</tr>)}
        </tbody>
        <tfoot><tr className="comparison-table__commercial-row"><th scope="row"><b>Цена и следующий шаг</b><span>Окончательные цену, наличие, комплектацию и срок зафиксирует менеджер в КП.</span></th>{products.map((product) => <td key={`${product.key}-commercial`}><small>{product.mode === "variant" ? "Цена выбранного исполнения с НДС" : "Диапазон цен товарной серии"}</small><strong>{product.price}</strong>{product.available && <em>{product.shippingLabel}</em>}{product.mode === "variant" && product.variantId ? <AddRequestButton item={{ id:`variant:${product.variantId}`, title:product.title, article:product.sku ? `Артикул ${product.sku}` : "Артикул не указан в фиде", price:product.price, image:product.image, href:product.href, shippingLabel:product.shippingLabel, shippingDetail:product.shippingDetail }}>Добавить в КП</AddRequestButton> : <Link href={product.href}>Выбрать исполнение</Link>}</td>)}</tr></tfoot>
      </table></div>
      <div className="comparison-after-table"><Link href={`/c/${selections[0]?.category ?? "stanki-sverlilnye"}`}>← Вернуться к выбору</Link><p>Сравнение помогает сократить список. Совместимость и условия поставки подтверждаются для конкретного исполнения.</p></div>
    </div></section>
  </>;
}

function ComparisonProductCard({ product, onRemove }: { product: ComparisonProduct; onRemove: () => void }) {
  return <article className="comparison-product-card">{product.image ? <Image src={product.image} alt="" width={220} height={150} unoptimized /> : <span className="comparison-product-fallback">Фото уточняется</span>}<small>{product.modeLabel}</small><b>{product.brand}</b><strong>{product.title}</strong><em>{product.choiceLabel}</em><div className="comparison-table__price"><small>{product.mode === "variant" ? "Цена исполнения" : "Цена серии"}</small><strong>{product.price}</strong></div><Link href={product.href}>Открыть товар →</Link><button type="button" onClick={onRemove} aria-label={`Убрать из сравнения: ${product.title}`}>Убрать</button></article>;
}

function ComparisonState({ title, copy, loading = false, retry = false, empty = false }: { title: string; copy: string; loading?: boolean; retry?: boolean; empty?: boolean }) {
  return <section className="comparison-empty container" aria-live="polite" aria-busy={loading}><span>{loading ? "Проверяем фид" : empty ? "Список пуст" : "Не удалось загрузить"}</span><h1>{title}</h1><p>{copy}</p><div>{retry && <button type="button" onClick={() => window.location.reload()}>Повторить</button>}<Link href="/catalog">Открыть каталог</Link><Link href="/#production-categories">Выбрать по задаче</Link></div></section>;
}

function trackView(items: ComparisonProduct[]) {
  if (items.length === 0) return;
  window.dispatchEvent(new CustomEvent("7tool:prototype-event", { detail:{ event:"comparison_view", placement:"comparison_page", page_type:"comparison", product_id:items[0].productId, variant_id:items[0].variantId, category:"mixed", candidate_count:items.length } }));
}
