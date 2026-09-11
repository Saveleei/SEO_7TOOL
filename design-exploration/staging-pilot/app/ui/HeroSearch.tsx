"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useState } from "react";

export function HeroSearch() {
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState(false);
  const showResult = searched || query.trim().length > 2;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearched(true);
  }

  return (
    <div className="hero-search-wrap">
      <form className="hero-search" onSubmit={submit} role="search">
        <span aria-hidden="true">⌕</span>
        <input value={query} onChange={(event) => { setQuery(event.target.value); setSearched(false); }} placeholder="Например: STEYR-35 или сверление Ø35 мм" aria-label="Поиск по каталогу" />
        <button type="submit">Найти</button>
      </form>
      <div className="search-examples">
        <span>Попробуйте:</span>
        {["STEYR-35", "сверло Ø35", "станок с реверсом"].map((item) => <button key={item} type="button" onClick={() => setQuery(item)}>{item}</button>)}
      </div>
      {showResult && (
        <div className="search-result" aria-live="polite">
          <Image src="/products/lenz-steyr-35.jpg" alt="" width={68} height={68} />
          <div><span>Точное совпадение · LENZ</span><strong>Магнитный станок STEYR-35</strong><small>Ø35 мм · Weldon 19 · в наличии</small></div>
          <b>47 999 ₽</b>
          <Link href="/product/lenz-steyr-35">Открыть</Link>
        </div>
      )}
    </div>
  );
}
