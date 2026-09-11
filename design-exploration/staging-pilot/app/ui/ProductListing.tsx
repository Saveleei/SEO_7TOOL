"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import { AddRequestButton } from "./RequestCart";

const products = [
  { brand: "LENZ", model: "STEYR-35", title: "Магнитный сверлильный станок LENZ STEYR-35", diameter: 35, spindle: "Weldon 19", weight: "10,5 кг", reverse: false, power: 1100, brushless: false, priceValue: 47999, price: "47 999 ₽", image: "/products/lenz-steyr-35.jpg", href: "/product/lenz-steyr-35", fit: "Компактный станок для отверстий до Ø35 мм на монтаже" },
  { brand: "HEDEN", model: "DM-36K", title: "Магнитный сверлильный станок Heden DM-36K", diameter: 36, spindle: "Weldon 19", weight: "11,8 кг", reverse: false, power: 1600, brushless: false, priceValue: 44690, price: "44 690 ₽", image: "/products/heden-dm-36k.png", href: "", fit: "Базовое решение до Ø36 мм с подачей СОЖ" },
  { brand: "LENZ", model: "STEYR-35 MAX", title: "Машина сверлильная LENZ STEYR-35 MAX", diameter: 35, spindle: "Weldon 19", weight: "12,4 кг", reverse: true, power: 1600, brushless: true, priceValue: 77910, price: "77 910 ₽", image: "/products/lenz-steyr-35.jpg", href: "", fit: "Для задач, где нужен реверс и нарезание резьбы" },
];

type Range = "all" | "35" | "60";
type Sort = "recommended" | "price";

export function ProductListing() {
  const [range, setRange] = useState<Range>("all");
  const [brands, setBrands] = useState(["LENZ", "HEDEN"]);
  const [reverseOnly, setReverseOnly] = useState(false);
  const [brushlessOnly, setBrushlessOnly] = useState(false);
  const [sort, setSort] = useState<Sort>("recommended");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [compare, setCompare] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filtered = useMemo(() => {
    const result = products.filter((product) => {
      const diameterMatch = range === "all" || (range === "35" ? product.diameter <= 35 : product.diameter > 35 && product.diameter <= 60);
      return diameterMatch && brands.includes(product.brand) && (!reverseOnly || product.reverse) && (!brushlessOnly || product.brushless);
    });
    return sort === "price" ? [...result].sort((a, b) => a.priceValue - b.priceValue) : result;
  }, [range, brands, reverseOnly, brushlessOnly, sort]);

  function toggleBrand(brand: string) {
    setBrands((current) => current.includes(brand) ? current.filter((item) => item !== brand) : [...current, brand]);
  }

  function toggleCompare(model: string) {
    setCompare((current) => current.includes(model) ? current.filter((item) => item !== model) : [...current, model]);
  }

  return (
    <>
      <div className="listing-layout">
        <aside className={`filters ${filtersOpen ? "open" : ""}`}>
          <div className="filters-title"><b>Быстрый подбор</b><span>{filtered.length} {filtered.length === 1 ? "модель" : filtered.length > 1 && filtered.length < 5 ? "модели" : "моделей"}</span><button className="filters-toggle" type="button" onClick={() => setFiltersOpen((current) => !current)}>{filtersOpen ? "Свернуть" : "Все фильтры"}</button></div>
          <fieldset><legend>Макс. диаметр корончатого сверла</legend>
            <button className={range === "all" ? "active" : ""} onClick={() => setRange("all")} type="button">Все диаметры</button>
            <button className={range === "35" ? "active" : ""} onClick={() => setRange("35")} type="button">до 35 мм</button>
            <button className={range === "60" ? "active" : ""} onClick={() => setRange("60")} type="button">36–60 мм</button>
          </fieldset>
          <fieldset><legend>Функции</legend><label><input aria-label="Только с реверсом" type="checkbox" checked={reverseOnly} onChange={(event) => setReverseOnly(event.target.checked)} /> Только с реверсом</label><label><input aria-label="Бесщёточный двигатель" type="checkbox" checked={brushlessOnly} onChange={(event) => setBrushlessOnly(event.target.checked)} /> Бесщёточный двигатель</label><label><input aria-label="Подача СОЖ" type="checkbox" checked readOnly /> Подача СОЖ</label></fieldset>
          <fieldset><legend>Бренд</legend>{["LENZ", "HEDEN"].map((brand) => <label key={brand}><input aria-label={`Бренд ${brand}`} type="checkbox" checked={brands.includes(brand)} onChange={() => toggleBrand(brand)} /> {brand}</label>)}</fieldset>
          <a className="filter-help" href="mailto:info@7tool.ru?subject=Подбор%20по%20параметрам">Подбор по нестандартным параметрам</a>
        </aside>

        <div className="listing-main">
          {(range !== "all" || reverseOnly || brushlessOnly || brands.length !== 2) && <div className="applied-filters"><span>Вы выбрали:</span>{range !== "all" && <button type="button" onClick={() => setRange("all")}>Ø {range === "35" ? "до 35" : "36–60"} ×</button>}{reverseOnly && <button type="button" onClick={() => setReverseOnly(false)}>С реверсом ×</button>}{brushlessOnly && <button type="button" onClick={() => setBrushlessOnly(false)}>Бесщёточный ×</button>}{brands.length !== 2 && brands.map((brand) => <button type="button" onClick={() => toggleBrand(brand)} key={brand}>{brand} ×</button>)}<button className="reset-all" type="button" onClick={() => { setRange("all"); setBrands(["LENZ", "HEDEN"]); setReverseOnly(false); setBrushlessOnly(false); }}>Сбросить всё</button></div>}
          <div className="listing-tools"><p><strong>Показано {filtered.length}</strong> из 3 моделей пилота</p><div><select aria-label="Сортировка" value={sort} onChange={(event) => setSort(event.target.value as Sort)}><option value="recommended">Сначала рекомендуемые</option><option value="price">Сначала дешевле</option></select><span className="view-switch" aria-label="Вид списка"><button className={view === "grid" ? "active" : ""} type="button" onClick={() => setView("grid")}>Плитка</button><button className={view === "list" ? "active" : ""} type="button" onClick={() => setView("list")}>Список</button></span></div></div>
          <div className={`product-grid ${view === "list" ? "product-list-view" : ""}`}>
            {filtered.map((product) => {
              const selected = compare.includes(product.model);
              return <article className="catalog-product" key={product.model}>
                <div className="catalog-media"><span className="on-order">Наличие уточняем · срок в КП</span><label className="compare-check"><input aria-label={`Сравнить ${product.model}`} type="checkbox" checked={selected} onChange={() => toggleCompare(product.model)} /> Сравнить</label><Image src={product.image} alt={product.title} width={420} height={360} /></div>
                <div className="catalog-copy"><small>{product.brand} · {product.model}</small><h2>{product.href ? <Link href={product.href}>{product.title}</Link> : product.title}</h2>
                  <p className="catalog-reason"><b>Подходит:</b> {product.fit}</p>
                  <dl><div><dt>Корончатое сверло</dt><dd>до {product.diameter} мм</dd></div><div><dt>Шпиндель</dt><dd>{product.spindle}</dd></div><div><dt>Мощность</dt><dd>{product.power.toLocaleString("ru-RU")} Вт</dd></div><div><dt>Реверс</dt><dd>{product.reverse ? "Есть" : "Нет"}</dd></div><div><dt>Масса</dt><dd>{product.weight}</dd></div></dl>
                  <div className="catalog-price"><div><b>{product.price}</b><span>ориентировочная цена с НДС · подтвердим в КП</span></div></div>
                  <div className="catalog-actions"><AddRequestButton item={{ id: product.model, title: product.title, article: `Артикул ${product.model}`, price: product.price }}>В запрос</AddRequestButton>{product.href ? <Link href={product.href}>Подробнее</Link> : <button type="button" onClick={() => toggleCompare(product.model)}>{selected ? "Добавлено" : "В сравнение"}</button>}</div>
                </div>
              </article>;
            })}
          </div>
          {filtered.length === 0 && <div className="empty-result"><b>В пилоте нет моделей с таким сочетанием</b><p>Сбросьте фильтры или отправьте параметры инженеру — отсутствие результата не должно быть тупиком.</p><button type="button" onClick={() => { setRange("all"); setBrands(["LENZ", "HEDEN"]); setReverseOnly(false); setBrushlessOnly(false); }}>Сбросить фильтры</button><a href="mailto:info@7tool.ru?subject=Подобрать%20аналог%20магнитного%20станка">Подобрать аналог →</a></div>}
        </div>
      </div>
      <div className="selection-brief selection-brief--after" aria-label="Порядок подбора станка">
        <div><span>01</span><b>Диаметр и глубина</b><small>задают рабочий диапазон</small></div>
        <div><span>02</span><b>Основание и масса</b><small>важны для места работы</small></div>
        <div><span>03</span><b>Реверс и двигатель</b><small>зависят от операции</small></div>
        <Link href="/compare">Сравнить модели по всем параметрам →</Link>
      </div>
      {compare.length > 0 && <div className="compare-tray" role="status"><div><b>К сравнению: {compare.length}</b><span>{compare.join(" · ")}</span></div><Link href="/compare">Открыть таблицу сравнения</Link><button type="button" onClick={() => setCompare([])} aria-label="Очистить сравнение">×</button></div>}
    </>
  );
}
