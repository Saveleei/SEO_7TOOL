"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildDrillDiameterOptions, buildDrillSelectionUrl, drillWorkOptions, resolveReverseFacetValue } from "../data/drillSelection.mjs";
import { ContactRequestDialog } from "./ContactRequestDialog";

type FacetOption = { value: string; label: string; count: number };

export function DrillSelectionAssistant({
  diameterFacetKey,
  diameterOptions,
  reverseFacetKey,
  reverseOptions = [],
  selectedDiameter = 35,
  selectedReverse = [],
  selectedWork = "unknown",
  lockedSegment,
  lockedSubsegment,
  selectorTitle = "Подобрать сверлильный станок",
  selectorIntro = "Начните с условий работы и требуемого диаметра.",
}: {
  diameterFacetKey: string;
  diameterOptions: FacetOption[];
  reverseFacetKey?: string;
  reverseOptions?: FacetOption[];
  selectedDiameter?: number;
  selectedReverse?: string[];
  selectedWork?: "installation" | "workshop" | "unknown";
  lockedSegment?: "drill-magnetic" | "drill-stationary" | "drill-rail" | "drill-special";
  lockedSubsegment?: string;
  selectorTitle?: string;
  selectorIntro?: string;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const firstWorkRef = useRef<HTMLButtonElement>(null);
  const allDiameterOptions = useMemo(() => buildDrillDiameterOptions(diameterOptions, Math.max(1, diameterOptions.length)), [diameterOptions]);
  const visibleDiameterOptions = useMemo(() => buildDrillDiameterOptions(diameterOptions, 6, selectedDiameter), [diameterOptions, selectedDiameter]);
  const [work, setWork] = useState(selectedWork);
  const [diameter, setDiameter] = useState(selectedDiameter);
  const subtypeRequiresThreading = lockedSubsegment === "magnetic-tapping" || lockedSubsegment === "stationary-tapping";
  const [threading, setThreading] = useState(subtypeRequiresThreading || selectedReverse.includes("Да"));
  const showWorkChoice = !lockedSegment;
  const showThreadingChoice = !lockedSubsegment && Boolean(reverseFacetKey && reverseOptions.length > 0);
  const reverse = resolveReverseFacetValue(threading, reverseOptions.map((option) => option.value));
  const recommendation = useMemo(() => {
    if (lockedSegment === "drill-magnetic") return { title:`Магнитные станки от Ø${diameter} мм`, note:lockedSubsegment ? "Сохраним выбранный вид и применим только совместимые параметры фида." : "Покажем переносные модели для установки непосредственно на металлоконструкцию." };
    if (lockedSegment === "drill-stationary") return { title:`Стационарные станки от Ø${diameter} мм`, note:lockedSubsegment ? "Сохраним выбранную компоновку и сузим её по рабочему диаметру." : "Покажем цеховые модели с подходящим рабочим диапазоном." };
    if (work === "installation") return { title:`Переносные магнитные станки от Ø${diameter} мм`, note:"Сначала покажем модели для работы непосредственно на металлоконструкции." };
    if (work === "workshop") return { title:`Стационарные станки от Ø${diameter} мм`, note:"Покажем оборудование для постоянного рабочего места в цехе." };
    return { title:`Станки с рабочим диапазоном от Ø${diameter} мм`, note:"Тип установки не ограничиваем — его можно уточнить после просмотра." };
  }, [diameter, lockedSegment, lockedSubsegment, work]);
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
      lockedSegment,
      lockedSubsegment,
    }));
  }

  return <details ref={detailsRef} className="burr-finder drill-finder" id="drill-selector">
    <summary>
      <span className="drill-finder-symbol" aria-hidden="true"><b>Ø</b><i>↕</i></span>
      <span><small>Подбор без модели</small><b>{lockedSegment ? selectorTitle : "Не знаете тип сверлильного станка?"}</b><em>{lockedSegment ? selectorIntro : "Ответьте на три вопроса — сузим фактический каталог по рабочей задаче."}</em></span>
      <i>Подобрать за минуту <span aria-hidden="true">↓</span></i>
    </summary>
    <div className="burr-finder-body">
      <div className="burr-finder-heading"><div><span>Технический отбор</span><h3>{lockedSegment ? selectorTitle : "Начните с условий работы"}</h3><p>Подбор предварительный: точную совместимость, комплектацию и режим работы подтвердит инженер.</p></div><small>Артикул и контакты пока не нужны</small></div>
      <div className="drill-selector-steps">
        {showWorkChoice && <fieldset><legend><span>01</span> Где будет работать станок?</legend><div className="burr-task-options" role="group" aria-label="Условия работы">{drillWorkOptions.map((option, index) => <button ref={index === 0 ? firstWorkRef : undefined} className={work === option.id ? "active" : undefined} type="button" onClick={() => setWork(option.id)} aria-pressed={work === option.id} key={option.id}><b>{option.label}</b><span>{option.hint}</span></button>)}</div></fieldset>}
        <fieldset><legend><span>{showWorkChoice ? "02" : "01"}</span> Какой диаметр отверстия требуется?</legend><div className="drill-diameter-options">{visibleDiameterOptions.map((option) => <button ref={!showWorkChoice && option === visibleDiameterOptions[0] ? firstWorkRef : undefined} className={diameter === option.value ? "active" : undefined} type="button" onClick={() => setDiameter(option.value)} aria-pressed={diameter === option.value} key={option.value}>{option.label}</button>)}</div><small>{allDiameterOptions.length > 1 ? <>Диапазон текущего раздела: <b>{allDiameterOptions[0].label.replace("до Ø", "")}–{allDiameterOptions[allDiameterOptions.length - 1].label.replace("до Ø", "")}</b>. Показаны ключевые размеры. <a href="#feed-filter-panel">Другой размер — в полном фильтре</a>.</> : "Размеры взяты из текущего раздела каталога."}</small></fieldset>
        {showThreadingChoice && <fieldset><legend><span>{showWorkChoice ? "03" : "02"}</span> Нужен реверс или нарезание резьбы?</legend><div className="drill-diameter-options"><button className={!threading ? "active" : undefined} type="button" onClick={() => setThreading(false)} aria-pressed={!threading}>Не требуется</button><button className={threading ? "active" : undefined} type="button" onClick={() => setThreading(true)} aria-pressed={threading}>Требуется</button></div><small>{threading ? "В выдаче оставим модели с реверсом. Возможность нарезания резьбы проверим отдельно." : "Не ограничиваем выдачу по реверсу."}</small></fieldset>}
        {lockedSubsegment && <div className="drill-selector-locked"><span>Вид оборудования сохранён</span><b>{selectorTitle}</b><a href={`/c/stanki-sverlilnye?segment=${encodeURIComponent(lockedSegment ?? "")}#products`}>Изменить вид</a></div>}
      </div>
      <section className="burr-finder-result" aria-live="polite"><div><span>Предварительный результат</span><h4>{recommendation.title}</h4><p>{recommendation.note}</p><small>Наличие и пригодность для конкретной операции подтверждаются после выбора модели.</small></div><div className="burr-result-actions"><ContactRequestDialog categoryTitle={requestContext} buttonLabel="Консультация с инженером" /><button className="button burr-result-secondary" type="button" onClick={showProducts}>Показать подходящие станки</button></div></section>
    </div>
  </details>;
}
