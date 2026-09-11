"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export function HeaderSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase().replace(/ё/g, "е");
  const result = useMemo(() => {
    if (/steyr.?35|стейр.?35|steir.?35/.test(normalized)) return { type: "Точное совпадение", title: "LENZ STEYR-35", meta: "Ø35 мм · Weldon 19 · 10,5 кг", href: "/product/lenz-steyr-35", image: "/products/lenz-steyr-35.jpg" };
    if (/реверс|резьб|метчик/.test(normalized)) return { type: "Подборка по функции", title: "Магнитные станки с реверсом", meta: "Фильтр по функции и рабочему диапазону", href: "/catalog/sverlenie/magnitnye-stanki", image: "/products/lenz-steyr-35.jpg" };
    if (/корон|сверл|магнит/.test(normalized)) return { type: "Категория и товары", title: "Сверление и оснастка", meta: "Станки, корончатые свёрла и принадлежности", href: "/catalog/sverlenie", image: "/products/annular-drills.png" };
    return { type: "Подбор по запросу", title: `Разобрать задачу «${query}»`, meta: "Проверим каталог и доступные варианты поставки", href: "/#quick-order", image: "/category/stanki-sverlilnye.webp" };
  }, [normalized, query]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (normalized) router.push(result.href);
  }

  return <div className="header-search-wrap"><form className="header-search-form" role="search" onSubmit={submit}><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Поиск по каталогу" placeholder="Модель или производственная задача" /><button type="submit">Найти</button></form>{normalized.length > 2 && <div className="header-search-panel"><Link href={result.href}><Image src={result.image} alt="" width={52} height={52} /><div><small>{result.type}</small><b>{result.title}</b><span>{result.meta}</span></div><strong>→</strong></Link><Link href="/#quick-order">Не нашли? Опишите задачу или пришлите спецификацию</Link></div>}</div>;
}
