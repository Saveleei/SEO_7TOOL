"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export function DrillSelector() {
  const [diameter, setDiameter] = useState<35 | 60 | 125>(35);
  const [threading, setThreading] = useState(false);
  const [mode, setMode] = useState<"installation" | "workshop">("installation");

  const result = useMemo(() => {
    if (diameter === 35 && !threading) return { model: "LENZ STEYR-35", note: "компактный класс для мобильных работ", count: "3 модели пилота" };
    if (diameter === 35) return { model: "LENZ STEYR-35 MAX", note: "реверс и расширенный диапазон оборотов", count: "1 модель пилота" };
    if (diameter === 60 && threading) return { model: "LENZ STEYR-55 T", note: "класс до Ø60 мм с реверсом", count: "подбор по полному каталогу" };
    if (diameter === 60) return { model: "HEDEN DM-50V2", note: "двухскоростной класс до Ø50–60 мм", count: "подбор по полному каталогу" };
    return { model: threading ? "LENZ STEYR-125 T" : "LENZ STEYR-125", note: "тяжёлый класс для цеховой работы", count: "индивидуальный расчёт" };
  }, [diameter, threading]);

  return <section className="guided-selector" aria-labelledby="selector-title">
    <div className="selector-intro"><p className="eyebrow">Инженерный подбор · 30 секунд</p><h2 id="selector-title">Не знаете модель? Начните с задачи</h2><p>Ответьте на три вопроса — покажем подходящий класс оборудования без лишних параметров.</p></div>
    <div className="selector-steps">
      <fieldset><legend><span>01</span> Максимальный диаметр</legend><div>{([35,60,125] as const).map((value) => <button type="button" className={diameter === value ? "active" : ""} onClick={() => setDiameter(value)} key={value}>до Ø{value} мм</button>)}</div></fieldset>
      <fieldset><legend><span>02</span> Нарезание резьбы</legend><div><button type="button" className={!threading ? "active" : ""} onClick={() => setThreading(false)}>Не требуется</button><button type="button" className={threading ? "active" : ""} onClick={() => setThreading(true)}>Требуется</button></div></fieldset>
      <fieldset><legend><span>03</span> Где работает станок</legend><div><button type="button" className={mode === "installation" ? "active" : ""} onClick={() => setMode("installation")}>Монтаж</button><button type="button" className={mode === "workshop" ? "active" : ""} onClick={() => setMode("workshop")}>Цех</button></div></fieldset>
    </div>
    <div className="selector-result" aria-live="polite"><div><small>Рекомендуемый класс · {mode === "installation" ? "приоритет малой массы" : "приоритет ресурса"}</small><b>{result.model}</b><span>{result.note} · {result.count}</span></div><Link href="/compare">Сравнить варианты</Link><a href={`mailto:info@7tool.ru?subject=Подбор%20станка%20до%20${diameter}%20мм${threading ? "%20с%20реверсом" : ""}`}>Передать инженеру →</a></div>
  </section>;
}
