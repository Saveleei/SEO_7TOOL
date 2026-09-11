"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useMemo, useState } from "react";

export function HeroSearch() {
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState(false);
  const normalized = query.trim().toLowerCase().replace(/ё/g,"е");
  const showResult = searched || normalized.length > 2;

  const intent = useMemo(() => {
    const exact = /steyr.?35|стейр.?35|steir.?35/.test(normalized);
    const cutter = /корон|фрез|сверло/.test(normalized);
    const reverse = /реверс|резьб|метчик/.test(normalized);
    const diameter = normalized.match(/(?:ø|ф|d|диаметр)?\s?(35|36|50|55|60|100|125)/)?.[1];
    if (exact) return { label:"точная модель", title:"Магнитный станок LENZ STEYR-35", meta:"Артикул STEYR-35 · Ø35 мм · Weldon 19", href:"/product/lenz-steyr-35", image:"/products/lenz-steyr-35.jpg", category:"Магнитные сверлильные станки" };
    if (cutter) return { label:"товарный тип", title:`Корончатые свёрла${diameter ? ` Ø${diameter} мм` : ""}`, meta:"Подбор по диаметру, длине, материалу и хвостовику", href:"/catalog/sverlenie", image:"/products/annular-drills.png", category:"Оснастка для сверления" };
    if (reverse) return { label:"характеристика", title:`Магнитные станки с реверсом${diameter ? ` до Ø${diameter} мм` : ""}`, meta:"Поиск внутри технических характеристик", href:"/catalog/sverlenie/magnitnye-stanki", image:"/products/lenz-steyr-35.jpg", category:"Подборка по функции" };
    return { label:"задача", title:`Оборудование для запроса «${query || "сверление металла"}»`, meta:"Ищем по моделям, артикулам, синонимам и параметрам", href:"/catalog/sverlenie/magnitnye-stanki", image:"/products/heden-dm-36k.png", category:"Результаты по задаче" };
  }, [normalized, query]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearched(true);
  }

  return (
    <div className="hero-search-wrap" id="search">
      <form className="hero-search" onSubmit={submit} role="search">
        <span aria-hidden="true">⌕</span>
        <input value={query} onChange={(event) => { setQuery(event.target.value); setSearched(false); }} placeholder="Модель, артикул или задача" aria-label="Поиск по каталогу" />
        <button type="submit">Найти</button>
      </form>
      <div className="search-examples">
        <span>Примеры:</span>
        {["STEYR-35", "коронка 35 Weldon", "станок 50 с реверсом"].map((item) => <button key={item} type="button" onClick={() => setQuery(item)}>{item}</button>)}
      </div>
      {showResult && (
        <div className="search-panel" aria-live="polite">
          <div className="search-understood"><span>Запрос распознан как</span><b>{intent.label}</b>{/35/.test(normalized) && <em>Ø35 мм</em>}{/реверс/.test(normalized) && <em>реверс</em>}</div>
          <Link className="search-hit" href={intent.href}><Image src={intent.image} alt="" width={66} height={66} /><div><small>{intent.category}</small><strong>{intent.title}</strong><span>{intent.meta}</span></div><b>Открыть →</b></Link>
          <div className="search-more"><Link href="/catalog/sverlenie/magnitnye-stanki">Все результаты в категории</Link><a href={`mailto:info@7tool.ru?subject=Не%20нашёл%20${encodeURIComponent(query)}`}>Не нашли? Подберём аналог</a></div>
        </div>
      )}
    </div>
  );
}
