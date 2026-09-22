"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildCategorySelectionContext, buildCategorySelectionUrl } from "../data/categorySelection.mjs";
import type { FeedFacet } from "../data/feedCatalog";
import { TestRequestForm } from "./TestRequestForm";

type Criterion = { title: string; copy: string };
type SelectionFacet = FeedFacet & {
  selectionMode?: "exact" | "minimum" | "range";
  minimumFacetKey?: string;
  initialValue?: string;
  question?: string;
  selectionHint?: string;
  hasMoreOptions?: boolean;
};

export function CategorySelectionAssistant({
  categoryTitle,
  selectorTitle,
  selectorIntro,
  selectorResult,
  facets,
  selectedFilters,
  criteria,
}: {
  categoryTitle: string;
  selectorTitle: string;
  selectorIntro: string;
  selectorResult: string;
  facets: SelectionFacet[];
  selectedFilters: Record<string, string[]>;
  criteria: Criterion[];
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const firstChoiceRef = useRef<HTMLButtonElement>(null);
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(facets.map((facet) => [facet.key, facet.initialValue ?? selectedFilters[facet.key]?.[0] ?? ""])));
  const selections = useMemo(() => facets.map((facet) => ({
    key:facet.key,
    label:facet.question ?? facet.label,
    value:values[facet.key] ?? "",
    mode:facet.selectionMode ?? "exact",
    minimumFacetKey:facet.minimumFacetKey,
  })), [facets, values]);
  const selectedCount = selections.filter((selection) => selection.value).length;
  const requestContext = buildCategorySelectionContext(categoryTitle, selections);

  useEffect(() => {
    function openAssistant() {
      if (!detailsRef.current) return;
      detailsRef.current.open = true;
      window.requestAnimationFrame(() => {
        detailsRef.current?.scrollIntoView({ behavior:"smooth", block:"start" });
        const firstControl = firstChoiceRef.current
          ?? detailsRef.current?.querySelector<HTMLInputElement>('.request-form input:not([type="checkbox"])');
        firstControl?.focus({ preventScroll:true });
      });
    }
    function openFromHash() {
      if (window.location.hash === "#category-selector") openAssistant();
    }
    function handleSelectorLink(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href="#category-selector"]') : null;
      if (!target) return;
      event.preventDefault();
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#category-selector`);
      openAssistant();
    }
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    document.addEventListener("click", handleSelectorLink);
    return () => {
      window.removeEventListener("hashchange", openFromHash);
      document.removeEventListener("click", handleSelectorLink);
    };
  }, []);

  function showProducts() {
    window.location.assign(buildCategorySelectionUrl({ pathname:window.location.pathname, search:window.location.search, selections }));
  }

  return <details ref={detailsRef} className="burr-finder category-finder" id="category-selector">
    <summary>
      <span className="category-finder-symbol" aria-hidden="true"><b>?</b><i>✓</i></span>
      <span><small>{facets.length > 0 ? "Подбор без артикула" : "Инженерный подбор"}</small><b>{selectorTitle}</b><em>{selectorIntro}</em></span>
      <i>{facets.length > 0 ? "Подобрать за минуту" : "Передать задачу"} <span aria-hidden="true">↓</span></i>
    </summary>
    <div className="burr-finder-body">
      <div className="burr-finder-heading"><div><span>{facets.length > 0 ? "Шаг 1 · параметры" : "Инженерный запрос"}</span><h3>{facets.length > 0 ? "Выберите только то, что уже известно" : "Начните с задачи и оборудования"}</h3><p>{facets.length > 0 ? "Значения взяты из текущего фида. Любой вопрос можно пропустить — подбор не должен останавливаться из-за неизвестного параметра." : "В этой категории пока недостаточно структурированных данных для безопасного автоматического отбора."}</p></div><small>{facets.length > 0 ? "Контакты пока не нужны" : "Артикул не требуется"}</small></div>

      {facets.length > 0 ? <>
        <div className="category-selector-fields">
          {facets.map((facet, facetIndex) => <fieldset key={facet.key}><legend><span>{String(facetIndex + 1).padStart(2, "0")}</span>{facet.question ?? facet.label}</legend><div>
            <button ref={facetIndex === 0 ? firstChoiceRef : undefined} className={!values[facet.key] ? "active" : undefined} type="button" onClick={() => setValues((current) => ({ ...current, [facet.key]:"" }))} aria-pressed={!values[facet.key]}>Не важно</button>
            {facet.options.map((option) => <button className={values[facet.key] === option.value ? "active" : undefined} type="button" onClick={() => setValues((current) => ({ ...current, [facet.key]:option.value }))} aria-pressed={values[facet.key] === option.value} key={option.value}><span>{option.label}</span><small>{option.count}</small></button>)}
          </div><small>{facet.numeric && facet.options.length > 1 ? <>Диапазон каталога: <b>{facet.options[0].label}–{facet.options[facet.options.length - 1].label}</b>. {facet.selectionHint} {facet.hasMoreOptions && <><a href="#feed-filter-panel">Другой точный размер — в полном фильтре</a>.</>}</> : <>{facet.help} {facet.hasMoreOptions && <><a href="#feed-filter-panel">Другой вариант — в полном фильтре</a>.</>}</>}</small></fieldset>)}
        </div>
        <section className="burr-finder-result" aria-live="polite"><div><span>Предварительный отбор</span><h4>{selectedCount > 0 ? `Выбрано параметров: ${selectedCount}` : "Можно начать с одного параметра"}</h4><p>{selectorResult}</p><small>Цена, комплектность, наличие и срок проверяются по выбранному исполнению перед оплатой.</small></div><div className="burr-result-actions"><button className="button button-orange" type="button" onClick={showProducts}>{selectedCount > 0 ? "Показать подходящие товары" : "Показать весь каталог"}</button><details><summary>Проверить с инженером</summary><TestRequestForm key={requestContext} compact primaryContact="phone" context={requestContext} buttonLabel="Заказать звонок инженера" /></details></div></section>
      </> : <div className="category-selector-manual"><ol>{criteria.slice(0, 3).map((item, index) => <li key={item.title}><span>{String(index + 1).padStart(2, "0")}</span><div><b>{item.title}</b><p>{item.copy}</p></div></li>)}<li className="category-selector-spec-option"><span aria-hidden="true">PDF</span><div><b>Есть ТЗ, чертёж или карта деталей?</b><p>Приложите файл прямо к заявке — без перехода в почту и повторного описания задачи.</p><a href={`/?request=spec&task=${encodeURIComponent(categoryTitle)}#quick-order`}>Передать ТЗ файлом →</a></div></li></ol><TestRequestForm compact primaryContact="phone" context={requestContext} buttonLabel="Передать задачу инженеру" /></div>}
    </div>
  </details>;
}
