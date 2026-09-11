"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";

const products = [
  { brand: "LENZ", model: "STEYR-35", title: "Магнитный сверлильный станок LENZ STEYR-35", diameter: 35, spindle: "Weldon 19", weight: "10,5 кг", reverse: false, priceValue: 47999, price: "47 999 ₽", oldPrice: "59 998 ₽", image: "/products/lenz-steyr-35.jpg", href: "/product/lenz-steyr-35", fit: "Компактный станок для отверстий до Ø35 мм на монтаже" },
  { brand: "HEDEN", model: "DM-36K", title: "Магнитный сверлильный станок Heden DM-36K", diameter: 36, spindle: "Weldon 19", weight: "11,8 кг", reverse: false, priceValue: 44690, price: "44 690 ₽", image: "/products/heden-dm-36k.png", href: "", fit: "Базовое решение до Ø36 мм с подачей СОЖ" },
  { brand: "LENZ", model: "STEYR-35 MAX", title: "Машина сверлильная LENZ STEYR-35 MAX", diameter: 35, spindle: "Weldon 19", weight: "12,4 кг", reverse: true, priceValue: 77910, price: "77 910 ₽", image: "/products/lenz-steyr-35.jpg", href: "", fit: "Для задач, где нужен реверс и нарезание резьбы" },
];

type Range = "all" | "35" | "60";
type Sort = "recommended" | "price";

export function ProductListing() {
  const [range, setRange] = useState<Range>("all");
  const [brands, setBrands] = useState(["LENZ", "HEDEN"]);
  const [reverseOnly, setReverseOnly] = useState(false);
  const [sort, setSort] = useState<Sort>("recommended");
  const [compare, setCompare] = useState<string[]>([]);

  const filtered = useMemo(() => {
    const result = products.filter((product) => {
      const diameterMatch = range === "all" || (range === "35" ? product.diameter <= 35 : product.diameter > 35 && product.diameter <= 60);
      return diameterMatch && brands.includes(product.brand) && (!reverseOnly || product.reverse);
    });
    return sort === "price" ? [...result].sort((a, b) => a.priceValue - b.priceValue) : result;
  }, [range, brands, reverseOnly, sort]);

  function toggleBrand(brand: string) {
    setBrands((current) => current.includes(brand) ? current.filter((item) => item !== brand) : [...current, brand]);
  }

  function toggleCompare(model: string) {
    setCompare((current) => current.includes(model) ? current.filter((item) => item !== model) : [...current, model]);
  }

  return (
    <>
      <div className="selection-brief" aria-label="Порядок подбора станка">
        <div><span>01</span><b>Диаметр и глубина</b><small>задают мощность и ход</small></div>
        <div><span>02</span><b>Основание и масса</b><small>важны для места работы</small></div>
        <div><span>03</span><b>Реверс и СОЖ</b><small>зависят от операции</small></div>
        <a href="mailto:info@7tool.ru?subject=Помощь%20с%20подбором%20магнитного%20станка">Не знаете параметры? Напишите инженеру →</a>
      </div>
      <div className="listing-layout">
        <aside className="filters">
          <div className="filters-title"><b>Быстрый подбор</b><span>{filtered.length} модели</span></div>
          <fieldset><legend>Макс. диаметр корончатого сверла</legend>
            <button className={range === "all" ? "active" : ""} onClick={() => setRange("all")} type="button">Все диаметры</button>
            <button className={range === "35" ? "active" : ""} onClick={() => setRange("35")} type="button">до 35 мм</button>
            <button className={range === "60" ? "active" : ""} onClick={() => setRange("60")} type="button">36–60 мм</button>
          </fieldset>
          <fieldset><legend>Функции</legend><label><input type="checkbox" checked={reverseOnly} onChange={(event) => setReverseOnly(event.target.checked)} /> Только с реверсом</label><label><input type="checkbox" checked readOnly /> Подача СОЖ</label></fieldset>
          <fieldset><legend>Бренд</legend>{["LENZ", "HEDEN"].map((brand) => <label key={brand}><input type="checkbox" checked={brands.includes(brand)} onChange={() => toggleBrand(brand)} /> {brand}</label>)}</fieldset>
          <a className="filter-help" href="mailto:info@7tool.ru?subject=Подбор%20по%20параметрам">Подбор по нестандартным параметрам</a>
        </aside>

        <div className="listing-main">
          <div className="listing-tools"><p><strong>Показано {filtered.length}</strong> из 3 моделей пилота</p><select aria-label="Сортировка" value={sort} onChange={(event) => setSort(event.target.value as Sort)}><option value="recommended">Сначала рекомендуемые</option><option value="price">Сначала дешевле</option></select></div>
          <div className="product-grid">
            {filtered.map((product) => {
              const selected = compare.includes(product.model);
              return <article className="catalog-product" key={product.model}>
                <div className="catalog-media"><span>Наличие уточняется</span><label className="compare-check"><input type="checkbox" checked={selected} onChange={() => toggleCompare(product.model)} /> Сравнить</label><Image src={product.image} alt={product.title} width={420} height={360} /></div>
                <div className="catalog-copy"><small>{product.brand} · {product.model}</small><h2>{product.href ? <Link href={product.href}>{product.title}</Link> : product.title}</h2>
                  <p className="catalog-reason"><b>Подходит:</b> {product.fit}</p>
                  <dl><div><dt>Корончатое сверло</dt><dd>до {product.diameter} мм</dd></div><div><dt>Шпиндель</dt><dd>{product.spindle}</dd></div><div><dt>Реверс</dt><dd>{product.reverse ? "Есть" : "Нет"}</dd></div><div><dt>Масса</dt><dd>{product.weight}</dd></div></dl>
                  <div className="catalog-price"><div>{product.oldPrice && <del>{product.oldPrice}</del>}<b>{product.price}</b><span>с НДС · цену подтвердим в КП</span></div></div>
                  <div className="catalog-actions"><a href={`mailto:info@7tool.ru?subject=КП%20на%20${encodeURIComponent(product.model)}`}>Запросить КП</a>{product.href ? <Link href={product.href}>Подробнее</Link> : <button type="button" onClick={() => toggleCompare(product.model)}>{selected ? "Добавлено" : "В сравнение"}</button>}</div>
                </div>
              </article>;
            })}
          </div>
          {filtered.length === 0 && <div className="empty-result"><b>В пилоте нет моделей с таким сочетанием</b><p>Сбросьте фильтры или отправьте параметры инженеру.</p><button type="button" onClick={() => { setRange("all"); setBrands(["LENZ", "HEDEN"]); setReverseOnly(false); }}>Сбросить фильтры</button></div>}
        </div>
      </div>
      {compare.length > 0 && <div className="compare-tray" role="status"><div><b>К сравнению: {compare.length}</b><span>{compare.join(" · ")}</span></div><a href={`mailto:info@7tool.ru?subject=Сравнить%20${encodeURIComponent(compare.join(" и "))}`}>Получить сравнение на email</a><button type="button" onClick={() => setCompare([])} aria-label="Очистить сравнение">×</button></div>}
    </>
  );
}
