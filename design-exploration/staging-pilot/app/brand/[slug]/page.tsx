import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { getFeedBrandAliasTarget, getFeedBrandLanding } from "../../data/brandCatalog";
import { toFeedProductCardModel } from "../../data/feedCatalog";
import { publicBrandPath, publicCategoryPath } from "../../data/publicUrls";
import { createPublicMetadata } from "../../data/seo";
import { buildBrandSeoKeywords } from "../../data/seoKeywords";
import { SEO_SITE_ORIGIN } from "../../data/seoIndexing.mjs";
import { Breadcrumbs } from "../../ui/Breadcrumbs";
import { FeedProductList } from "../../ui/FeedProductList";
import { JsonLd } from "../../ui/JsonLd";
import { PilotFooter } from "../../ui/PilotFooter";
import { PilotHeader } from "../../ui/PilotHeader";

type SearchValue = string | string[] | undefined;
type RouteProps = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, SearchValue>> };
const PAGE_SIZE = 24;

export async function generateMetadata({ params, searchParams }: RouteProps): Promise<Metadata> {
  const [{ slug }, rawSearchParams] = await Promise.all([params, searchParams]);
  const landing = getFeedBrandLanding(slug);
  const page = parsePage(rawSearchParams.page);
  const pageCount = landing ? Math.max(1, Math.ceil(landing.products.length / PAGE_SIZE)) : 1;
  const hasUnexpectedQuery = Object.entries(rawSearchParams).some(([key, value]) => key !== "page" && hasValue(value));
  const validPage = Boolean(page && page <= pageCount);
  const title = landing ? `${landing.brand}: оборудование и инструмент — купить у 7TOOL${page && page > 1 ? ` — страница ${page}` : ""}` : "Бренд — 7TOOL";
  const description = landing ? `Каталог ${landing.brand}: ${landing.products.length} товарных серий в ${landing.categories.length} разделах. Характеристики, цены и запрос коммерческого предложения.` : "Оборудование и промышленный инструмент по брендам.";
  const metadata = createPublicMetadata({
    title,
    description,
    path:`/brand/${slug}`,
    indexable:Boolean(landing) && validPage && !hasUnexpectedQuery,
    image:landing?.products[0]?.images[0],
    keywords:buildBrandSeoKeywords({ brand:landing?.brand, categories:landing?.categories.map((category) => category.title) }),
  });
  const canonical = new URL(`/brand/${slug}${page && page > 1 ? `?page=${page}` : ""}`, SEO_SITE_ORIGIN).toString();
  return { ...metadata, alternates:{ canonical }, openGraph:{ ...metadata.openGraph, url:canonical } };
}

export default async function BrandPage({ params, searchParams }: RouteProps) {
  const [{ slug }, rawSearchParams] = await Promise.all([params, searchParams]);
  const landing = getFeedBrandLanding(slug);
  if (!landing) {
    const aliasTarget = getFeedBrandAliasTarget(slug);
    if (aliasTarget) permanentRedirect(`/brand/${aliasTarget}`);
    notFound();
  }
  const page = parsePage(rawSearchParams.page);
  const pageCount = Math.max(1, Math.ceil(landing.products.length / PAGE_SIZE));
  if (!page || page > pageCount) notFound();
  const products = landing.products.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const cards = products.map((product) => toFeedProductCardModel(product));
  const canonicalPath = `${publicBrandPath(landing.brand)}${page > 1 ? `?page=${page}` : ""}`;
  const collection = {
    "@context":"https://schema.org",
    "@type":"CollectionPage",
    name:`Оборудование ${landing.brand}`,
    url:new URL(canonicalPath, SEO_SITE_ORIGIN).toString(),
    inLanguage:"ru-RU",
    about:{ "@type":"Brand", name:landing.brand },
    mainEntity:{
      "@type":"ItemList",
      numberOfItems:landing.products.length,
      itemListElement:products.map((product, index) => ({ "@type":"ListItem", position:(page - 1) * PAGE_SIZE + index + 1, name:product.title, url:new URL(`/p/${product.slug}`, SEO_SITE_ORIGIN).toString() })),
    },
  };

  return <div className="site-shell"><JsonLd data={collection} /><PilotHeader /><main className="inner-page">
    <section className="catalog-hero"><div className="container"><Breadcrumbs items={[{ label:"Главная", href:"/" }, { label:"Каталог", href:"/catalog" }, { label:landing.brand }]} /><p className="eyebrow">Бренд в каталоге 7TOOL</p><h1>{landing.brand}: оборудование и инструмент</h1><p>Товарные серии, характеристики и исполнения {landing.brand} из текущего каталога поставщика. Наличие, комплектацию и срок поставки менеджер подтверждает для выбранного артикула.</p><div className="catalog-hero-stats"><span><b>{landing.products.length.toLocaleString("ru-RU")}</b> товарных серий</span><span><b>{landing.categories.length}</b> разделов каталога</span></div></div></section>

    <section className="section section-muted"><div className="container"><div className="section-heading"><div><p className="eyebrow">Ассортимент бренда</p><h2>Разделы с продукцией {landing.brand}</h2></div><p>Переходы ведут на основные индексируемые категории без фильтров и промежуточных редиректов.</p></div><nav className="related-category-links" aria-label={`Категории ${landing.brand}`}>{landing.categories.map((category) => <Link href={publicCategoryPath(category.slug)} key={category.slug}>{category.title}<span>{category.count}</span></Link>)}</nav></div></section>

    <section className="section" id="products"><div className="container"><div className="section-heading"><div><p className="eyebrow">Товары {landing.brand}</p><h2>Модели и исполнения</h2></div><p>Цена и доступность показываются только по данным товарного фида; неподтверждённые сведения не добавляются.</p></div><FeedProductList products={cards} />{pageCount > 1 && <nav className="feed-pagination" aria-label="Страницы бренда"><div>{Array.from({ length:pageCount }, (_, index) => index + 1).map((value) => <Link className={value === page ? "active" : undefined} aria-current={value === page ? "page" : undefined} href={`${publicBrandPath(landing.brand)}${value > 1 ? `?page=${value}` : ""}`} key={value}>{value}</Link>)}</div></nav>}</div></section>
  </main><PilotFooter /></div>;
}

function parsePage(value: SearchValue): number | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined || raw === "") return 1;
  if (!/^\d+$/u.test(raw)) return undefined;
  const page = Number.parseInt(raw, 10);
  return page >= 1 ? page : undefined;
}

function hasValue(value: SearchValue): boolean {
  return Array.isArray(value) ? value.some((item) => item.trim().length > 0) : typeof value === "string" && value.trim().length > 0;
}
