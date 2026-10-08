import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { searchCatalog } from "../data/catalogSearch";
import type { CatalogSearchHit } from "../data/catalogSearchTypes";
import { Breadcrumbs } from "../ui/Breadcrumbs";
import { ContactRequestDialog } from "../ui/ContactRequestDialog";
import { PilotFooter } from "../ui/PilotFooter";
import { PilotHeader } from "../ui/PilotHeader";
import { AddRequestButton } from "../ui/RequestCart";
import { SmartSearch } from "../ui/SmartSearch";
import { createPublicMetadata } from "../data/seo";

export const metadata: Metadata = createPublicMetadata({ title:"Поиск по каталогу — 7TOOL", description:"Поиск промышленного оборудования по модели, категории и производственной задаче.", path:"/search", indexable:false });

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const query = typeof raw.q === "string" ? raw.q.trim().slice(0, 120) : "";
  const result = searchCatalog(query, { products:18, categories:6, tasks:4 });
  const total = result.products.length + result.categories.length + result.tasks.length;

  return <div className="site-shell"><PilotHeader />
    <main className="inner-page search-results-page">
      <div className="container"><Breadcrumbs items={[{ label:"Главная", href:"/" }, { label:"Поиск" }]} /></div>
      <section className="search-results-hero"><div className="container"><p className="eyebrow">Поиск по реальному товарному фиду</p><h1>{query ? <>Результаты по запросу «{query}»</> : "Найдите товар или опишите задачу"}</h1><p>Ищите по названию, бренду, модели, типу оборудования или операции. Знать внутренний артикул 7TOOL необязательно.</p><div className="search-results-search"><SmartSearch placement="hero" /></div></div></section>

      {query && total > 0 && <section className="section search-results-content"><div className="container">
        <div className="search-results-summary"><div><span>Распознано как</span><b>{result.interpretation}</b></div><p>Сначала показаны точные и наиболее близкие совпадения. Наличие и условия поставки подтверждаются менеджером перед оплатой.</p></div>

        {result.products.length > 0 && <div className="search-product-section"><div className="section-heading"><div><p className="eyebrow">Товары и исполнения</p><h2>Подходящие позиции</h2></div><p>{result.products.length} результатов из товарного фида</p></div><div className="search-product-grid">{result.products.map((product) => <SearchProductCard product={product} key={product.id} />)}</div></div>}

        {(result.categories.length > 0 || result.tasks.length > 0) && <div className="search-discovery"><section><span>Категории</span><h2>Уточнить тип товара</h2>{result.categories.map((item) => <SearchDirection item={item} key={item.id} />)}</section><section><span>Производственная задача</span><h2>Начать с операции</h2>{result.tasks.map((item) => <SearchDirection item={item} key={item.id} />)}</section></div>}
      </div></section>}

      {query && total === 0 && <section className="section"><div className="container search-zero-state"><div><p className="eyebrow">Нет точного совпадения</p><h2>Сохраним ваш запрос и подберём решение</h2><p>Товар может называться иначе, поставляться под другой маркой или отсутствовать в текущем фиде. Не заставляем вас угадывать артикул.</p><ul><li>Проверим аналоги по рабочим характеристикам</li><li>Уточним возможность поставки отсутствующей модели</li><li>Вернём цену с НДС и срок только после подтверждения</li></ul></div><aside><b>Запрос уже подставлен</b><p>Откройте короткую форму и добавьте телефон. Повторно вводить «{query}» не потребуется.</p><Link href={`/?task=${encodeURIComponent(query)}#quick-order`}>Продолжить подбор по задаче</Link><ContactRequestDialog categoryTitle={query} buttonLabel="Перезвоните по этому запросу" /></aside></div></section>}

      {!query && <section className="section"><div className="container search-start-state"><h2>Можно начать с обычной фразы</h2><div><Link href="/search?q=магнитный%20станок%2035%20мм">магнитный станок 35 мм</Link><Link href="/search?q=снять%20фаску%20с%20трубы">снять фаску с трубы</Link><Link href="/search?q=сварочная%20каретка">сварочная каретка</Link></div></div></section>}
    </main><PilotFooter /></div>;
}

function SearchProductCard({ product }: { product: CatalogSearchHit }) {
  return <article className="search-product-card">
    <Link className="search-product-image" href={product.href}>{product.image ? <Image src={product.image} alt={product.title} width={260} height={210} unoptimized /> : <span>Изображение уточняется</span>}</Link>
    <div className="search-product-main"><small>{product.eyebrow}</small><h3><Link href={product.href}>{product.title}</Link></h3><p>{product.meta}</p>{product.specs?.length ? <ul>{product.specs.map((spec) => <li key={spec}>{spec}</li>)}</ul> : null}</div>
    <div className="search-product-buy"><b>{product.price}</b><span className={product.availability?.startsWith("В наличии") || product.availability?.startsWith("Есть") ? "available" : undefined}>{product.availability}</span><small>{product.availabilityDetail}</small><div>{product.requestItem ? <AddRequestButton item={product.requestItem}>Получить КП</AddRequestButton> : <Link className="search-product-primary" href={product.href}>Выбрать исполнение</Link>}<Link href={product.href}>Все характеристики</Link></div></div>
  </article>;
}

function SearchDirection({ item }: { item: CatalogSearchHit }) {
  return <Link className="search-direction" href={item.href}>{item.image ? <Image src={item.image} alt="" width={62} height={62} /> : null}<span><small>{item.eyebrow}</small><b>{item.title}</b><em>{item.meta}</em></span><strong>→</strong></Link>;
}

