"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { cleanParamName, compareCatalogProducts, type Product } from "@/lib/catalog";
import { ProductCard } from "@/components/ProductCard";
import { ManagerBlock } from "@/components/ManagerBlock";

const PAGE_SIZE = 24;
type Sort = "default" | "price-asc" | "price-desc" | "name";
const sortLabels: Record<Sort, string> = {
  default: "Сначала в наличии и дешевле",
  "price-asc": "Цена: дешевле",
  "price-desc": "Цена: дороже",
  name: "По названию",
};

// Параметры, которые имеет смысл показывать как фильтр facet:
// должны быть категориальные (немного значений), значимые.
const PRIORITY_PARAMS = [
  "Серия",
  "Хвостовик",
  "Покрытие",
  "Материал режущей части",
  "Рабочая длина",
  "Шпиндель",
  "Реверс",
  "Поворотное основание",
  "Число скоростей",
];

type Facet = { name: string; unit?: string; values: { value: string; count: number }[] };

function buildFacets(items: Product[]): Facet[] {
  const facets = new Map<string, Map<string, number>>();
  const units = new Map<string, string>();
  for (const p of items) {
    const seen = new Set<string>();
    const params = p.listingParams ?? p.variants.flatMap((variant) => variant.params);
    for (const prm of params) {
      const name = cleanParamName(prm.name);
      const key = `${name}::${prm.value}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!facets.has(name)) facets.set(name, new Map());
      const m = facets.get(name)!;
      m.set(prm.value, (m.get(prm.value) || 0) + 1);
      if (prm.unit && !units.has(name)) units.set(name, prm.unit);
    }
  }
  // выбираем по приоритету, но также допускаем любые с >=2 значениями и >=3 общими counts
  const allNames = Array.from(facets.keys());
  const ordered = [
    ...PRIORITY_PARAMS.filter((n) => facets.has(n)),
    ...allNames.filter((n) => !PRIORITY_PARAMS.includes(n)),
  ];
  const out: Facet[] = [];
  for (const name of ordered) {
    const valuesMap = facets.get(name)!;
    if (valuesMap.size < 2 || valuesMap.size > 30) continue;
    const total = Array.from(valuesMap.values()).reduce((a, b) => a + b, 0);
    if (total < 3) continue;
    if (name === "Бренд" || name === "Материал") continue; // бренд отдельно, материал часто multivalue
    const values = Array.from(valuesMap.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => {
        const an = parseFloat(a.value), bn = parseFloat(b.value);
        if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
        return b.count - a.count;
      });
    out.push({ name, unit: units.get(name), values });
    if (out.length >= 6) break;
  }
  return out;
}

function productMatchesFacet(p: Product, name: string, picked: Set<string>): boolean {
  if (picked.size === 0) return true;
  const params = p.listingParams ?? p.variants.flatMap((variant) => variant.params);
  for (const prm of params) {
    if (cleanParamName(prm.name) === name && picked.has(prm.value)) return true;
  }
  return false;
}

export function CategoryFilters({
  items,
  brands,
  initialPage = 1,
  initialFilters = {},
  basePath,
}: {
  items: Product[];
  brands: string[];
  initialPage?: number;
  initialFilters?: Record<string, string[]>;
  basePath: string;
}) {
  const facets = useMemo(() => buildFacets(items), [items]);

  const [pickedBrands, setPickedBrands] = useState<string[]>(() => {
    const requested = initialFilters.brand ?? initialFilters["Бренд"] ?? [];
    return requested.filter((brand) => brands.includes(brand));
  });
  const [picked, setPicked] = useState<Record<string, Set<string>>>(() => Object.fromEntries(
    facets.map((facet) => [
      facet.name,
      new Set((initialFilters[facet.name] ?? []).filter((value) => facet.values.some((item) => item.value === value))),
    ]),
  ));
  const [inStockOnly, setInStockOnly] = useState(false);
  const [hasPriceOnly, setHasPriceOnly] = useState(false);
  const [discountOnly, setDiscountOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("default");
  const [page, setPage] = useState(initialPage);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const initialFilterKey = JSON.stringify(initialFilters);

  // При client-side переходе по QuickChips Next сохраняет экземпляр
  // компонента. Синхронизируем state с новыми server props, иначе URL менялся,
  // а результаты оставались от предыдущего состояния до полной перезагрузки.
  useEffect(() => {
    const requestedBrands = initialFilters.brand ?? initialFilters["Бренд"] ?? [];
    setPickedBrands(requestedBrands.filter((brand) => brands.includes(brand)));
    setPicked(Object.fromEntries(facets.map((facet) => [
      facet.name,
      new Set((initialFilters[facet.name] ?? []).filter((value) => facet.values.some((item) => item.value === value))),
    ])));
    setPage(initialPage);
  // initialFilterKey is the stable semantic dependency for the serialized map.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPage, initialFilterKey, facets, brands]);

  const filtered = useMemo(() => {
    let arr = items;
    if (pickedBrands.length) arr = arr.filter((p) => pickedBrands.includes(p.brand));
    if (inStockOnly) arr = arr.filter((p) => p.stock > 0);
    if (hasPriceOnly) arr = arr.filter((p) => p.priceFrom != null);
    if (discountOnly) arr = arr.filter((p) => p.discountPct);
    for (const f of facets) {
      const set = picked[f.name];
      if (set && set.size) arr = arr.filter((p) => productMatchesFacet(p, f.name, set));
    }
    const q = query.trim().toLowerCase();
    if (q) {
      arr = arr.filter((p) =>
        p.title.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        (p.listingVariantSkus ?? p.variants.map((variant) => variant.sku)).some((sku) => sku.toLowerCase().includes(q)),
      );
    }
    arr = [...arr];
    if (sort === "default") arr.sort(compareCatalogProducts);
    if (sort === "price-asc") arr.sort((a, b) => (a.priceFrom ?? Infinity) - (b.priceFrom ?? Infinity) || a.title.localeCompare(b.title, "ru"));
    if (sort === "price-desc") arr.sort((a, b) => (b.priceTo ?? -Infinity) - (a.priceTo ?? -Infinity) || a.title.localeCompare(b.title, "ru"));
    if (sort === "name") arr.sort((a, b) => a.title.localeCompare(b.title, "ru") || a.id.localeCompare(b.id));
    return arr;
  }, [items, pickedBrands, picked, inStockOnly, hasPriceOnly, discountOnly, query, sort, facets]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const toggleBrand = (b: string) => {
    setPickedBrands((prev) => (prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]));
    setPage(1);
  };
  const toggleFacet = (name: string, value: string) => {
    setPicked((prev) => {
      const set = new Set(prev[name] ?? []);
      if (set.has(value)) set.delete(value);
      else set.add(value);
      return { ...prev, [name]: set };
    });
    setPage(1);
  };
  const reset = () => {
    setPickedBrands([]);
    setPicked({});
    setInStockOnly(false);
    setHasPriceOnly(false);
    setDiscountOnly(false);
    setQuery("");
    setPage(1);
  };

  const activeCount =
    pickedBrands.length +
    Object.values(picked).reduce((a, s) => a + (s?.size ?? 0), 0) +
    (inStockOnly ? 1 : 0) +
    (hasPriceOnly ? 1 : 0) +
    (discountOnly ? 1 : 0) +
    (query ? 1 : 0);

  return (
    <section className="bg-white">
      <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 sm:py-10">
        {/* Mobile-trigger для фильтров */}
        <div className="mb-4 flex items-center justify-between lg:hidden">
          <button
            onClick={() => setFiltersOpen(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-amber-300 bg-white px-4 py-2.5 text-[13px] font-bold text-amber-800 shadow-soft transition hover:bg-amber-50"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M4 6h16M7 12h10M10 18h4"/></svg>
            Фильтры
            {activeCount > 0 && <span className="rounded-full bg-amber-400 px-1.5 text-[11px] text-steel-900">{activeCount}</span>}
          </button>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="min-h-11 rounded-md border border-steel-200 bg-white px-3 py-2 text-[13px] text-steel-800 focus:border-amber-400 focus:outline-none"
          >
            {(Object.keys(sortLabels) as Sort[]).map((s) => (
              <option key={s} value={s}>{sortLabels[s]}</option>
            ))}
          </select>
        </div>

        {/* mobile drawer */}
        {filtersOpen && (
          <div className="fixed inset-0 z-[80] flex lg:hidden" role="dialog" aria-modal>
            <button onClick={() => setFiltersOpen(false)} aria-label="Закрыть" className="absolute inset-0 bg-steel-900/60 backdrop-blur-sm"/>
            <div className="relative ml-auto h-full w-[88%] max-w-[360px] overflow-y-auto bg-white p-5 shadow-elev animate-[slideRight_.22s_cubic-bezier(.2,.8,.2,1)]">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-[16px] font-extrabold text-steel-900">Фильтры</h3>
                <button onClick={() => setFiltersOpen(false)} aria-label="Закрыть" className="grid h-11 w-11 place-items-center rounded-full border border-steel-200 text-steel-500 hover:border-amber-300 hover:text-amber-700">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M6 6l12 12M18 6l-12 12"/></svg>
                </button>
              </div>
              <FiltersBody
                activeCount={activeCount} reset={reset}
                query={query} setQuery={(v) => { setQuery(v); setPage(1); }}
                inStockOnly={inStockOnly} setInStockOnly={() => { setInStockOnly((v) => !v); setPage(1); }}
                hasPriceOnly={hasPriceOnly} setHasPriceOnly={() => { setHasPriceOnly((v) => !v); setPage(1); }}
                discountOnly={discountOnly} setDiscountOnly={() => { setDiscountOnly((v) => !v); setPage(1); }}
                brands={brands} pickedBrands={pickedBrands} toggleBrand={toggleBrand}
                facets={facets} picked={picked} toggleFacet={toggleFacet}
              />
              <button
                onClick={() => setFiltersOpen(false)}
                className="mt-5 inline-flex w-full items-center justify-center rounded-md bg-amber-400 px-4 py-3 text-[13.5px] font-bold text-steel-900 shadow-amber"
              >
                Показать {filtered.length}
              </button>
            </div>
            <style>{`@keyframes slideRight { from { transform: translateX(100%) } to { transform: translateX(0) } }`}</style>
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-[280px_1fr] lg:gap-10">
          <aside className="hidden space-y-5 lg:block">
            <div className="rounded-[var(--radius-card)] border border-steel-200 bg-white p-5 shadow-soft">
              <FiltersBody
                activeCount={activeCount} reset={reset}
                query={query} setQuery={(v) => { setQuery(v); setPage(1); }}
                inStockOnly={inStockOnly} setInStockOnly={() => { setInStockOnly((v) => !v); setPage(1); }}
                hasPriceOnly={hasPriceOnly} setHasPriceOnly={() => { setHasPriceOnly((v) => !v); setPage(1); }}
                discountOnly={discountOnly} setDiscountOnly={() => { setDiscountOnly((v) => !v); setPage(1); }}
                brands={brands} pickedBrands={pickedBrands} toggleBrand={toggleBrand}
                facets={facets} picked={picked} toggleFacet={toggleFacet}
              />
            </div>

            <ManagerBlock compact />
          </aside>

          <div data-catalog-results>
            <div className="hidden flex-wrap items-center justify-between gap-3 border-b border-steel-100 pb-4 lg:flex">
              <div className="text-[13px] text-steel-500">
                Найдено <span className="font-semibold text-steel-900">{filtered.length}</span> из {items.length}
              </div>
              <label className="flex items-center gap-2 text-[13px] text-steel-600">
                Сортировка
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as Sort)}
                  className="rounded-md border border-steel-200 bg-white px-3 py-1.5 text-[13px] text-steel-800 focus:border-amber-400 focus:outline-none"
                >
                  {(Object.keys(sortLabels) as Sort[]).map((s) => (
                    <option key={s} value={s}>{sortLabels[s]}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mb-3 text-[13px] text-steel-500 lg:hidden">
              Найдено <span className="font-semibold text-steel-900">{filtered.length}</span> из {items.length}
            </div>

            {filtered.length === 0 ? (
              <div className="mt-8 rounded-[var(--radius-card)] border border-dashed border-steel-200 bg-steel-50/40 p-12 text-center">
                <div className="font-display text-[18px] font-bold text-steel-900">
                  По выбранным фильтрам ничего не нашлось
                </div>
                <button
                  onClick={reset}
                  className="mt-4 inline-flex min-h-11 items-center justify-center rounded-md bg-amber-400 px-4 py-2.5 text-[13px] font-bold text-steel-900 shadow-amber transition hover:bg-amber-300"
                >
                  Сбросить фильтры
                </button>
              </div>
            ) : (
              <>
                <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
                  {visible.map((p, index) => (
                    <Fragment key={p.id}>
                      <ProductCard p={p} />
                      {index === 5 && (
                        <a
                          href="#selection-form"
                          className="col-span-2 flex min-h-[112px] flex-col items-start justify-between gap-4 rounded-[var(--radius-card)] border border-amber-300 bg-gradient-to-r from-amber-50 via-white to-cobalt-50/50 p-4 shadow-soft transition hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-card sm:flex-row sm:items-center xl:col-span-3"
                        >
                          <span>
                            <span className="block text-[10.5px] font-bold uppercase tracking-[0.18em] text-amber-700">Не нашли точную позицию?</span>
                            <span className="mt-1 block font-display text-[17px] font-extrabold text-steel-900 sm:text-[20px]">Инженер подберёт оборудование по вашей задаче</span>
                            <span className="mt-1 block text-[12.5px] text-steel-600">Форма остаётся ниже каталога — здесь быстрый переход без прерывания просмотра.</span>
                          </span>
                          <span className="w-full shrink-0 rounded-md bg-amber-400 px-4 py-2.5 text-center text-[12.5px] font-bold text-steel-900 shadow-amber sm:w-auto">Перейти к подбору ↓</span>
                        </a>
                      )}
                    </Fragment>
                  ))}
                </div>
                {totalPages > 1 && <Pager page={safePage} totalPages={totalPages} onChange={setPage} basePath={basePath} />}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function FiltersBody(props: {
  activeCount: number; reset: () => void;
  query: string; setQuery: (v: string) => void;
  inStockOnly: boolean; setInStockOnly: () => void;
  hasPriceOnly: boolean; setHasPriceOnly: () => void;
  discountOnly: boolean; setDiscountOnly: () => void;
  brands: string[]; pickedBrands: string[]; toggleBrand: (b: string) => void;
  facets: Facet[]; picked: Record<string, Set<string>>; toggleFacet: (n: string, v: string) => void;
}) {
  const { activeCount, reset, query, setQuery, inStockOnly, setInStockOnly, hasPriceOnly, setHasPriceOnly, discountOnly, setDiscountOnly, brands, pickedBrands, toggleBrand, facets, picked, toggleFacet } = props;
  return (
    <>
      <div className="flex items-center justify-between">
        <h3 className="font-display text-[15px] font-bold text-steel-900">
          Фильтры
          {activeCount > 0 && (
            <span className="ml-2 rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-extrabold text-steel-900">{activeCount}</span>
          )}
        </h3>
        {activeCount > 0 && (
          <button onClick={reset} className="text-[12px] font-medium text-amber-700 hover:text-amber-800">Сбросить</button>
        )}
      </div>
      <div className="mt-4">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Артикул, название, бренд"
          className="min-h-11 w-full rounded-md border border-steel-200 bg-white px-3 py-2 text-[13px] text-steel-900 placeholder:text-steel-400 focus:border-amber-400 focus:outline-none"
        />
      </div>
      <FacetGroup label="Состояние">
        <Toggle checked={inStockOnly} onChange={setInStockOnly} label="Только в наличии" />
        <Toggle checked={hasPriceOnly} onChange={setHasPriceOnly} label="Только с ценой" />
        <Toggle checked={discountOnly} onChange={setDiscountOnly} label="Только акции" accent="amber" />
      </FacetGroup>
      {brands.length > 0 && (
        <FacetGroup label="Бренд">
          {brands.map((b) => (
            <Toggle key={b} checked={pickedBrands.includes(b)} onChange={() => toggleBrand(b)} label={b} />
          ))}
        </FacetGroup>
      )}
      {facets.map((f) => (
        <FacetGroup key={f.name} label={f.name + (f.unit ? `, ${f.unit}` : "")}>
          {f.values.map((v) => (
            <Toggle key={v.value} checked={(picked[f.name] ?? new Set()).has(v.value)} onChange={() => toggleFacet(f.name, v.value)} label={v.value} hint={`${v.count}`} />
          ))}
        </FacetGroup>
      ))}
    </>
  );
}

function FacetGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-5 border-t border-steel-100 pt-4">
      <div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-steel-500">{label}</div>
      <ul className="mt-2.5 space-y-1.5 max-h-56 overflow-y-auto pr-1">{children}</ul>
    </div>
  );
}

function Toggle({
  checked, onChange, label, hint, accent,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  hint?: string;
  accent?: "amber";
}) {
  return (
    <li>
      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[13px] text-steel-700 transition hover:bg-amber-50 sm:min-h-0">
        <span className="flex items-center gap-2.5 min-w-0">
          <input
            type="checkbox"
            checked={checked}
            onChange={onChange}
            className={`h-4 w-4 rounded border-steel-300 ${accent === "amber" ? "text-amber-500 focus:ring-amber-400" : "text-amber-500 focus:ring-amber-400"}`}
          />
          <span className="truncate">{label}</span>
        </span>
        {hint && <span className="shrink-0 text-[11px] text-steel-400">{hint}</span>}
      </label>
    </li>
  );
}

function Pager({ page, totalPages, onChange, basePath }: { page: number; totalPages: number; onChange: (p: number) => void; basePath: string }) {
  const buttons: number[] = [];
  for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) buttons.push(i);
  const cls = (active: boolean) =>
    `inline-flex h-11 min-w-11 items-center justify-center rounded-md border px-3 text-[13px] font-medium transition sm:h-9 sm:min-w-9 ${
      active ? "border-amber-500 bg-amber-400 text-steel-900 shadow-amber"
             : "border-steel-200 bg-white text-steel-700 hover:border-amber-300 hover:text-amber-700"
    }`;
  const href = (value: number) => value > 1 ? `${basePath}?page=${value}` : basePath;
  const selectPage = (event: React.MouseEvent<HTMLAnchorElement>, value: number) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onChange(value);
    window.history.pushState(null, "", href(value));
    document.querySelector("[data-catalog-results]")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <nav aria-label="Страницы каталога" className="mt-8 flex flex-wrap items-center gap-2">
      {page > 1 && <a rel="prev" href={href(page - 1)} onClick={(event) => selectPage(event, page - 1)} className={cls(false)}>← Назад</a>}
      {buttons[0] > 1 && (<><a href={href(1)} onClick={(event) => selectPage(event, 1)} className={cls(false)}>1</a>{buttons[0] > 2 && <span className="px-1 text-steel-400">…</span>}</>)}
      {buttons.map((b) => <a key={b} href={href(b)} aria-current={b === page ? "page" : undefined} onClick={(event) => selectPage(event, b)} className={cls(b === page)}>{b}</a>)}
      {buttons[buttons.length - 1] < totalPages && (<>{buttons[buttons.length - 1] < totalPages - 1 && <span className="px-1 text-steel-400">…</span>}<a href={href(totalPages)} onClick={(event) => selectPage(event, totalPages)} className={cls(false)}>{totalPages}</a></>)}
      {page < totalPages && <a rel="next" href={href(page + 1)} onClick={(event) => selectPage(event, page + 1)} className={cls(false)}>Вперёд →</a>}
    </nav>
  );
}
