"use client";

import Link from "next/link";
import { useState } from "react";
import { useRequestCart } from "./RequestCart";

const variants = [
  { id:"STEYR-35", label:"Ø35 мм", article:"STEYR-35", diameter:"35 мм", spindle:"Weldon 19", power:"1 100 Вт", weight:"10,5 кг", price:"47 999 ₽" },
  { id:"STEYR-35-MAX", label:"Ø35 + реверс", article:"STEYR-35 MAX", diameter:"35 мм", spindle:"Weldon 19", power:"1 600 Вт", weight:"12,4 кг", price:"77 910 ₽" },
  { id:"STEYR-60", label:"Ø60 мм", article:"STEYR-60", diameter:"60 мм", spindle:"Weldon 19", power:"1 800 Вт", weight:"15,8 кг", price:"Цена по запросу" },
  { id:"STEYR-60-R", label:"Ø60 + реверс", article:"STEYR-60 R", diameter:"60 мм", spindle:"Weldon 19", power:"1 900 Вт", weight:"16,2 кг", price:"Цена по запросу" },
];

export function ProductBuybox() {
  const [selectedId, setSelectedId] = useState(variants[0].id);
  const [quantity, setQuantity] = useState(1);
  const { addItem, open } = useRequestCart();
  const selected = variants.find((variant) => variant.id === selectedId) ?? variants[0];

  function add() {
    addItem({ id:selected.id, title:`Магнитный сверлильный станок LENZ ${selected.article}`, article:`Артикул ${selected.article}`, price:selected.price, quantity });
  }

  return <>
    <div className="variant-selector"><span>Выберите вариант</span><div>{variants.map((variant) => <button className={variant.id === selected.id ? "active" : ""} type="button" key={variant.id} onClick={() => setSelectedId(variant.id)}>{variant.label}</button>)}</div><small>Цена, статус и характеристики относятся к выбранному варианту.</small></div>
    <div className="product-buybox">
      <div className="product-status is-on-order"><span>Наличие уточняем</span><b>Реальный срок укажем в КП</b><small>После запроса менеджер проверит доступность выбранной модификации у поставщика.</small></div>
      <div className="price-block"><div><b>{selected.price}</b><span>{selected.price.includes("₽") ? "ориентировочная цена с НДС" : "менеджер вернёт цену и срок одним ответом"}</span></div></div>
      <div className="purchase-actions">
        <div className="quantity-control" aria-label="Количество"><button type="button" onClick={() => setQuantity((value) => Math.max(1,value-1))}>−</button><b>{quantity}</b><button type="button" onClick={() => setQuantity((value) => value+1)}>+</button></div>
        <button type="button" onClick={add}>Добавить в запрос</button>
        <button className="purchase-open-request" type="button" onClick={open}>Открыть запрос КП</button>
        <Link href="/compare">Сравнить варианты</Link>
      </div>
      <div className="purchase-proof" aria-label="Условия запроса"><span>КП и счёт с НДС</span><span>Статус выбранной позиции</span><span>Ответ менеджера с контекстом товара</span></div>
    </div>
    <div className="key-specs"><div><span>Корончатое сверло</span><b>до {selected.diameter}</b></div><div><span>Шпиндель</span><b>{selected.spindle}</b></div><div><span>Мощность</span><b>{selected.power}</b></div><div><span>Масса</span><b>{selected.weight}</b></div></div>
  </>;
}
