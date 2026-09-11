"use client";

import Link from "next/link";
import { useState } from "react";

export function ProductActions() {
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  return <div className="purchase-actions">
    <div className="quantity-control" aria-label="Количество"><button type="button" onClick={() => setQuantity((value) => Math.max(1,value-1))}>−</button><b>{quantity}</b><button type="button" onClick={() => setQuantity((value) => value+1)}>+</button></div>
    <button className={added ? "added" : ""} type="button" onClick={() => setAdded(true)}>{added ? `Добавлено: ${quantity} шт.` : "Добавить в заявку"}</button>
    <a href="#request">Получить КП</a>
    <Link href="/compare">Подобрать аналог</Link>
    {added && <p role="status">Товар сохранён в тестовом черновике. Ничего не отправлено.</p>}
  </div>;
}
