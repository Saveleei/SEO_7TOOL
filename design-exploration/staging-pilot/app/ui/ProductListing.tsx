"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";

const products = [
  { brand: "LENZ", model: "STEYR-35", title: "Магнитный сверлильный станок LENZ STEYR-35", diameter: 35, spindle: "Weldon 19", weight: "10,5 кг", price: "47 999 ₽", oldPrice: "59 998 ₽", image: "/products/lenz-steyr-35.jpg", href: "/product/lenz-steyr-35" },
  { brand: "HEDEN", model: "DM-36K", title: "Магнитный сверлильный станок Heden DM-36K", diameter: 36, spindle: "Weldon 19", weight: "11,8 кг", price: "44 690 ₽", image: "/products/heden-dm-36k.png", href: "" },
  { brand: "LENZ", model: "STEYR-35 MAX", title: "Машина сверлильная STEYR-35 MAX", diameter: 35, spindle: "Weldon 19", weight: "12,4 кг", price: "77 910 ₽", image: "/products/lenz-steyr-35.jpg", href: "" },
];

type Range = "all" | "35" | "60";

export function ProductListing() {
  const [range, setRange] = useState<Range>("all");
  const filtered = useMemo(() => products.filter((product) => range === "all" || (range === "35" ? product.diameter <= 35 : product.diameter > 35 && product.diameter <= 60)), [range]);

  return (
    <div className="listing-layout">
      <aside className="filters">
        <div className="filters-title"><b>Быстрый подбор</b><span>{filtered.length} из 47</span></div>
        <fieldset><legend>Корончатое сверло</legend>
          <button className={range === "all" ? "active" : ""} onClick={() => setRange("all")} type="button">Все диаметры</button>
          <button className={range === "35" ? "active" : ""} onClick={() => setRange("35")} type="button">до 35 мм</button>
          <button className={range === "60" ? "active" : ""} onClick={() => setRange("60")} type="button">36–60 мм</button>
        </fieldset>
        <fieldset><legend>Питание</legend><label><input type="checkbox" defaultChecked /> 220 В</label><label><input type="checkbox" /> Аккумулятор</label></fieldset>
        <fieldset><legend>Функции</legend><label><input type="checkbox" /> Реверс</label><label><input type="checkbox" defaultChecked /> Система СОЖ</label></fieldset>
        <fieldset><legend>Бренд</legend><label><input type="checkbox" defaultChecked /> LENZ</label><label><input type="checkbox" defaultChecked /> Heden</label><label><input type="checkbox" /> BDS</label></fieldset>
      </aside>

      <div className="listing-main">
        <div className="listing-tools"><p><strong>47 моделей</strong> · показаны товарные семейства</p><select aria-label="Сортировка" defaultValue="recommended"><option value="recommended">Сначала рекомендуемые</option><option value="price">Сначала дешевле</option></select></div>
        <div className="product-grid">
          {filtered.map((product) => (
            <article className="catalog-product" key={product.model}>
              <div className="catalog-media"><span>В наличии</span><Image src={product.image} alt={product.title} width={420} height={360} /></div>
              <div className="catalog-copy"><small>{product.brand} · {product.model}</small><h2>{product.href ? <Link href={product.href}>{product.title}</Link> : product.title}</h2>
                <dl><div><dt>Корончатое сверло</dt><dd>до {product.diameter} мм</dd></div><div><dt>Шпиндель</dt><dd>{product.spindle}</dd></div><div><dt>Масса</dt><dd>{product.weight}</dd></div></dl>
                <div className="catalog-price"><div>{product.oldPrice && <del>{product.oldPrice}</del>}<b>{product.price}</b><span>с НДС</span></div>{product.href ? <Link href={product.href}>Подробнее</Link> : <span className="catalog-link-disabled">Следующий этап</span>}</div>
              </div>
            </article>
          ))}
        </div>
        {filtered.length === 0 && <div className="empty-result"><b>Нет моделей в этом диапазоне</b><button type="button" onClick={() => setRange("all")}>Сбросить фильтр</button></div>}
      </div>
    </div>
  );
}
