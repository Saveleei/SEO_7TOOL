"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildBurrSelectionUrl, burrTaskOptions, getBurrTaskRecommendation, resolveMaterialFacetValue } from "../data/burrSelection.mjs";
import { BurrShapeMark } from "./BurrShapeMark";
import { ContactRequestDialog } from "./ContactRequestDialog";

type FacetOption = { value: string; label: string; count: number };

const materials = ["Сталь", "Нержавеющая сталь", "Чугун", "Алюминий / цветные металлы", "Не знаю"];

export function BurrSelectionAssistant({
  shapeFacetKey,
  shapeOptions,
  shankFacetKey,
  shankOptions = [],
  materialFacetKey,
  materialOptions = [],
  selectedShapes = [],
}: {
  shapeFacetKey: string;
  shapeOptions: FacetOption[];
  shankFacetKey?: string;
  shankOptions?: FacetOption[];
  materialFacetKey?: string;
  materialOptions?: FacetOption[];
  selectedShapes?: string[];
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const firstTaskRef = useRef<HTMLButtonElement>(null);
  const [task, setTask] = useState("");
  const [material, setMaterial] = useState("");
  const [shank, setShank] = useState("");
  const recommendation = useMemo(
    () => getBurrTaskRecommendation(task, shapeOptions.map((option) => option.value)),
    [task, shapeOptions],
  );
  const taskLabel = burrTaskOptions.find((option) => option.id === task)?.label ?? "не выбрана";
  const materialFacetValue = resolveMaterialFacetValue(material, materialOptions.map((option) => option.value));
  const requestContext = `Категория: борфрезы. Задача: ${taskLabel}. Материал: ${material || "не указан"}. Хвостовик: ${shank || "не указан"}. Предварительно: ${recommendation.title}.`;

  useEffect(() => {
    function openAssistant() {
      if (!detailsRef.current) return;
      detailsRef.current.open = true;
      window.requestAnimationFrame(() => {
        detailsRef.current?.scrollIntoView({ behavior:"smooth", block:"start" });
        firstTaskRef.current?.focus({ preventScroll:true });
      });
    }

    function openFromHash() {
      if (window.location.hash === "#burr-selector") openAssistant();
    }

    function handleSelectorLink(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href="#burr-selector"]') : null;
      if (!target) return;
      event.preventDefault();
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#burr-selector`);
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
    const target = buildBurrSelectionUrl({
      pathname:window.location.pathname,
      search:window.location.search,
      shapeFacetKey,
      shankFacetKey,
      materialFacetKey,
      forms:recommendation.forms,
      shank,
      material:materialFacetValue,
    });
    window.location.assign(target);
  }

  return <details ref={detailsRef} className="burr-finder" id="burr-selector">
    <summary>
      <span className="burr-finder-symbol" aria-hidden="true"><BurrShapeMark shape="C" /><BurrShapeMark shape="M" /></span>
      <span><small>Подбор без артикула</small><b>Не знаете форму борфрезы?</b><em>{selectedShapes.length > 0 ? `Сейчас выбрано: ${selectedShapes.join(", ")}. Можно проверить выбор по задаче.` : "Выберите геометрию участка — покажем подходящие формы из каталога."}</em></span>
      <i>Подобрать за минуту <span aria-hidden="true">↓</span></i>
    </summary>
    <div className="burr-finder-body">
      <div className="burr-finder-heading"><div><span>Шаг 1 из 2</span><h3>Что будете обрабатывать?</h3><p>Выбирайте форму участка, а не название борфрезы. Результат предварительный — совместимость проверяется по детали и инструменту.</p></div><small>Контакты пока не нужны</small></div>
      <div className="burr-task-options" role="group" aria-label="Геометрия обрабатываемого участка">
        {burrTaskOptions.map((option, index) => <button ref={index === 0 ? firstTaskRef : undefined} className={task === option.id ? "active" : undefined} type="button" onClick={() => setTask(option.id)} aria-pressed={task === option.id} key={option.id}><b>{option.label}</b><span>{option.hint}</span></button>)}
      </div>

      {task && <div className="burr-finder-step-two">
        <div className="burr-secondary-fields"><fieldset><legend>Материал детали</legend><div>{materials.map((option) => <label className={material === option ? "active" : undefined} key={option}><input type="radio" name="burr-material" value={option} checked={material === option} onChange={() => setMaterial(option)} /><span>{option}</span></label>)}</div><small>{materialFacetValue ? "Применим фильтр по назначению из каталога." : "Если материал неизвестен, оставим выдачу без этого ограничения."}</small></fieldset>
        <fieldset><legend>Диаметр хвостовика</legend><div>{shankOptions.map((option) => <label className={shank === option.value ? "active" : undefined} key={option.value}><input type="radio" name="burr-shank" value={option.value} checked={shank === option.value} onChange={() => setShank(option.value)} /><span>{option.label}</span></label>)}<label className={shank === "" ? "active" : undefined}><input type="radio" name="burr-shank" value="" checked={shank === ""} onChange={() => setShank("")} /><span>Не знаю</span></label></div><small>Если не знаете — оставьте без ограничения.</small></fieldset></div>

        <section className="burr-finder-result" aria-live="polite"><div><span>Предварительный результат</span><h4>{recommendation.title}</h4><p>{recommendation.reason}</p>{recommendation.forms.length > 0 && <div className="burr-result-shapes">{recommendation.forms.map((shape: string) => <span key={shape}><BurrShapeMark shape={shape} /><b>{shape}</b></span>)}</div>}<small>Подбор не является обещанием совместимости. Инженер уточнит насечку, размер и режим работы.</small></div><div className="burr-result-actions"><ContactRequestDialog categoryTitle={requestContext} buttonLabel="Консультация с инженером" /><button className="button burr-result-secondary" type="button" onClick={showProducts}>{recommendation.forms.length > 0 ? "Показать подходящие товары" : "Показать все формы"}</button></div></section>
      </div>}
    </div>
  </details>;
}
