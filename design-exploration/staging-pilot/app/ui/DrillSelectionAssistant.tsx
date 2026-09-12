"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildDrillSelectionUrl, drillDiameterOptions, drillWorkOptions, resolveReverseFacetValue } from "../data/drillSelection.mjs";
import { TestRequestForm } from "./TestRequestForm";

type FacetOption = { value: string; label: string; count: number };

export function DrillSelectionAssistant({
  diameterFacetKey,
  reverseFacetKey,
  reverseOptions = [],
  selectedDiameter = 35,
  selectedReverse = [],
  selectedWork = "unknown",
}: {
  diameterFacetKey: string;
  reverseFacetKey?: string;
  reverseOptions?: FacetOption[];
  selectedDiameter?: number;
  selectedReverse?: string[];
  selectedWork?: "installation" | "workshop" | "unknown";
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const firstWorkRef = useRef<HTMLButtonElement>(null);
  const [work, setWork] = useState(selectedWork);
  const [diameter, setDiameter] = useState(selectedDiameter);
  const [threading, setThreading] = useState(selectedReverse.includes("Да"));
  const reverse = resolveReverseFacetValue(threading, reverseOptions.map((option) => option.value));
  const recommendation = useMemo(() => {
    if (work === "installation") return { title:`Переносные магнитные станки от Ø${diameter} мм`, note:"Сначала покажем модели для работы непосредственно на металлоконструкции." };
    if (work === "workshop") return { title:`Сверлильные станки от Ø${diameter} мм`, note:"Покажем оборудование без ограничения по массе и типу установки." };
    return { title:`Станки с рабочим диапазоном от Ø${diameter} мм`, note:"Тип установки не ограничиваем — его можно уточнить после просмотра." };
  }, [diameter, work]);
  const workLabel = drillWorkOptions.find((option) => option.id === work)?.label ?? "не указан";
  const requestContext = `Категория: сверлильные станки. Работа: ${workLabel}. Требуемый диаметр: до Ø${diameter} мм. Реверс или резьба: ${threading ? "требуется" : "не требуется"}.`;

  useEffect(() => {
    function openAssistant() {
      if (!detailsRef.current) return;
      detailsRef.current.open = true;
      window.requestAnimationFrame(() => {
        detailsRef.current?.scrollIntoView({ behavior:"smooth", block:"start" });
        firstWorkRef.current?.focus({ preventScroll:true });
      });
    }
    function openFromHash() {
      if (window.location.hash === "#drill-selector") openAssistant();
    }
    function handleSelectorLink(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href="#drill-selector"]') : null;
      if (!target) return;
      event.preventDefault();
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#drill-selector`);
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
    window.location.assign(buildDrillSelectionUrl({
      pathname:window.location.pathname,
      search:window.location.search,
      diameterFacetKey,
      reverseFacetKey,
      diameter,
      reverse,
      work,
    }));
  }

  return <details ref={detailsRef} className="burr-finder drill-finder" id="drill-selector">
    <summary>
      <span className="drill-finder-symbol" aria-hidden="true"><b>Ø</b><i>↕</i></span>
      <span><small>Подбор без модели</small><b>Не знаете тип сверлильного станка?</b><em>Ответьте на три вопроса — сузим фактический каталог по рабочей задаче.</em></span>
      <i>Подобрать за минуту <span aria-hidden="true">↓</span></i>
    </summary>
    <div className="burr-finder-body">
      <div className="burr-finder-heading"><div><span>Технический отбор</span><h3>Начните с условий работы</h3><p>Подбор предварительный: точную совместимость, комплектацию и режим работы подтвердит инженер.</p></div><small>Артикул и контакты пока не нужны</small></div>
      <div className="drill-selector-steps">
        <fieldset><legend><span>01</span> Где будет работать станок?</legend><div className="burr-task-options" role="group" aria-label="Условия работы">{drillWorkOptions.map((option, index) => <button ref={index === 0 ? firstWorkRef : undefined} className={work === option.id ? "active" : undefined} type="button" onClick={() => setWork(option.id)} aria-pressed={work === option.id} key={option.id}><b>{option.label}</b><span>{option.hint}</span></button>)}</div></fieldset>
        <fieldset><legend><span>02</span> Какой диаметр отверстия требуется?</legend><div className="drill-diameter-options">{drillDiameterOptions.map((option) => <button className={diameter === option.value ? "active" : undefined} type="button" onClick={() => setDiameter(option.value)} aria-pressed={diameter === option.value} key={option.value}>{option.label}</button>)}</div></fieldset>
        <fieldset><legend><span>03</span> Нужен реверс или нарезание резьбы?</legend><div className="drill-diameter-options"><button className={!threading ? "active" : undefined} type="button" onClick={() => setThreading(false)} aria-pressed={!threading}>Не требуется</button><button className={threading ? "active" : undefined} type="button" onClick={() => setThreading(true)} aria-pressed={threading}>Требуется</button></div><small>{threading ? "В выдаче оставим модели с реверсом. Возможность нарезания резьбы проверим отдельно." : "Не ограничиваем выдачу по реверсу."}</small></fieldset>
      </div>
      <section className="burr-finder-result" aria-live="polite"><div><span>Предварительный результат</span><h4>{recommendation.title}</h4><p>{recommendation.note}</p><small>Наличие и пригодность для конкретной операции подтверждаются после выбора модели.</small></div><div className="burr-result-actions"><button className="button button-orange" type="button" onClick={showProducts}>Показать подходящие станки</button><details><summary>Проверить с инженером</summary><TestRequestForm compact primaryContact="phone" context={requestContext} buttonLabel="Заказать звонок инженера" /></details></div></section>
    </div>
  </details>;
}
