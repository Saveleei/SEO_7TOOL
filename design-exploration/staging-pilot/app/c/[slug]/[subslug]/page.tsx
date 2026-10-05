import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedFeedCatalogSnapshot, toFeedProductCardModel } from "../../../data/feedCatalog";
import { getLegacySubcategoriesForCategory, getLegacySubcategory } from "../../../data/legacySubcategories";
import { publicCategoryPath } from "../../../data/publicUrls";
import { createPublicMetadata } from "../../../data/seo";
import { buildSubcategorySeoKeywords } from "../../../data/seoKeywords";
import { SEO_SITE_ORIGIN } from "../../../data/seoIndexing.mjs";
import { socialCardMetadataImage } from "../../../data/socialCards";
import { Breadcrumbs } from "../../../ui/Breadcrumbs";
import { FeedProductList } from "../../../ui/FeedProductList";
import { JsonLd } from "../../../ui/JsonLd";
import { PilotFooter } from "../../../ui/PilotFooter";
import { PilotHeader } from "../../../ui/PilotHeader";

type SearchValue = string | string[] | undefined;
type RouteProps = { params: Promise<{ slug: string; subslug: string }>; searchParams: Promise<Record<string, SearchValue>> };
const PAGE_SIZE = 24;

export async function generateMetadata({ params, searchParams }: RouteProps): Promise<Metadata> {
  const [{ slug, subslug }, rawSearchParams] = await Promise.all([params, searchParams]);
  const landing = getLegacySubcategory(slug, subslug);
  const page = parsePage(rawSearchParams.page);
  const hasUnexpectedQuery = Object.entries(rawSearchParams).some(([key, value]) => key !== "page" && hasValue(value));
  const pageCount = landing ? Math.max(1, Math.ceil(landing.productIds.length / PAGE_SIZE)) : 1;
  const validPage = Boolean(page && page <= pageCount);
  const canonicalPath = `/c/${slug}/${subslug}${page && page > 1 ? `?page=${page}` : ""}`;
  const title = landing ? `${landing.metaTitle}${page && page > 1 ? ` — страница ${page}` : ""}` : "Подкатегория — 7TOOL";
  const description = landing ? `${landing.metaDescription}${page && page > 1 ? ` Страница ${page}.` : ""}` : "Подборка промышленного оборудования 7TOOL.";
  const metadata = createPublicMetadata({
    title,
    description,
    path:`/c/${slug}/${subslug}`,
    indexable:Boolean(landing) && validPage && !hasUnexpectedQuery,
    image:landing ? socialCardMetadataImage("subcategory", landing.imageAlt ?? `${landing.title} — изображение подкатегории 7TOOL`, slug, subslug) : undefined,
    keywords:buildSubcategorySeoKeywords({ title:landing?.title, h1:landing?.h1 }),
  });
  const canonical = new URL(canonicalPath, SEO_SITE_ORIGIN).toString();
  return { ...metadata, alternates:{ canonical }, openGraph:{ ...metadata.openGraph, url:canonical } };
}

export default async function LegacySubcategoryPage({ params, searchParams }: RouteProps) {
  const [{ slug, subslug }, rawSearchParams] = await Promise.all([params, searchParams]);
  const landing = getLegacySubcategory(slug, subslug);
  if (!landing) notFound();
  const page = parsePage(rawSearchParams.page);
  const pageCount = Math.max(1, Math.ceil(landing.productIds.length / PAGE_SIZE));
  if (!page || page > pageCount) notFound();

  const productIds = new Set(landing.productIds);
  const products = getPublishedFeedCatalogSnapshot().products.filter((product) => productIds.has(product.id));
  const pageProducts = products.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const productCards = pageProducts.map((product) => toFeedProductCardModel(product));
  const siblings = getLegacySubcategoriesForCategory(slug).filter((entry) => entry.slug !== subslug).slice(0, 8);
  const paragraphs = landing.seoText.split(/\n\s*\n/gu).map((paragraph) => paragraph.trim()).filter(Boolean);
  const pageUrl = new URL(`/c/${slug}/${subslug}${page > 1 ? `?page=${page}` : ""}`, SEO_SITE_ORIGIN).toString();
  const collection = {
    "@context":"https://schema.org",
    "@type":"CollectionPage",
    name:landing.h1 ?? landing.title,
    description:landing.metaDescription,
    url:pageUrl,
    inLanguage:"ru-RU",
    mainEntity:{
      "@type":"ItemList",
      numberOfItems:landing.count,
      itemListElement:pageProducts.map((product, index) => ({
        "@type":"ListItem",
        position:(page - 1) * PAGE_SIZE + index + 1,
        name:product.title,
        url:new URL(`/p/${product.slug}`, SEO_SITE_ORIGIN).toString(),
      })),
    },
  };
  const faq = landing.faq.length ? {
    "@context":"https://schema.org",
    "@type":"FAQPage",
    mainEntity:landing.faq.map((item) => ({ "@type":"Question", name:item.question, acceptedAnswer:{ "@type":"Answer", text:item.answer } })),
  } : undefined;

  return <div className="site-shell"><JsonLd data={collection} />{faq && <JsonLd data={faq} />}<PilotHeader /><main className="inner-page">
    <section className="catalog-hero"><div className="container"><Breadcrumbs items={[{ label:"Главная", href:"/" }, { label:"Каталог", href:"/catalog" }, { label:landing.categoryTitle, href:publicCategoryPath(slug) }, { label:landing.title }]} /><p className="eyebrow">{landing.categoryTitle}</p><h1>{landing.h1 ?? landing.title}</h1><p>{landing.intro}</p><div className="catalog-hero-stats"><span><b>{landing.count.toLocaleString("ru-RU")}</b> товарных серий в подборке</span><span><b>{page}</b> из {pageCount} страниц</span></div></div></section>

    <section className="section" id="products"><div className="container"><div className="section-heading"><div><p className="eyebrow">Проверяемая подборка</p><h2>{landing.shortDescription}</h2></div><p>Состав сформирован по правилам исходного каталога; параметры и цены берутся из текущего товарного снимка.</p></div><FeedProductList products={productCards} />{pageCount > 1 && <nav className="feed-pagination" aria-label="Страницы подборки"><div>{Array.from({ length:pageCount }, (_, index) => index + 1).map((value) => <Link className={value === page ? "active" : undefined} aria-current={value === page ? "page" : undefined} href={`/c/${slug}/${subslug}${value > 1 ? `?page=${value}` : ""}`} key={value}>{value}</Link>)}</div></nav>}</div></section>

    {page === 1 && <section className="section section-muted"><div className="container"><div className="section-heading"><div><p className="eyebrow">Как выбрать</p><h2>{landing.seoTitle ?? `О подборке «${landing.title}»`}</h2></div></div><div className="feed-product-description">{paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>{landing.faq.length > 0 && <div className="public-info-list"><h2>Вопросы о выборе</h2>{landing.faq.map((item) => <article key={item.question}><h3>{item.question}</h3><p>{item.answer}</p></article>)}</div>}</div></section>}

    {siblings.length > 0 && <section className="section"><div className="container"><div className="section-heading"><div><p className="eyebrow">Смежные подборки</p><h2>Другие подкатегории раздела</h2></div></div><nav className="related-category-links" aria-label="Смежные подкатегории">{siblings.map((item) => <Link href={`/c/${slug}/${item.slug}`} key={item.slug}>{item.title}<span>→</span></Link>)}</nav></div></section>}
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
