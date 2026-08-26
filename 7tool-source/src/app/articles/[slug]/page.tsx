import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { SemanticNextSteps } from "@/components/SemanticNextSteps";
import { IntentLeadForm } from "@/components/IntentLeadForm";
import { StructuredData } from "@/components/StructuredData";
import { ArticleAnalytics, TrackedArticleLink } from "@/components/ArticleAnalytics";
import { getPublishedArticle, listPublishedArticleSlugs, type ArticleBlock, type PublishedArticleImage } from "@/lib/articles-db";
import { getEditorialPreview } from "@/lib/editorial-preview";
import { getSemanticLinks } from "@/lib/semantic-linking-db";
import { getLeadProfile } from "@/lib/lead-generation";
import { indexableRobots, noIndexRobots, pageTitle } from "@/lib/seo-metadata";
import { absoluteUrl, SITE_URL } from "@/lib/site-config";
import { buildArticleStructuredData, buildBreadcrumbList } from "@/lib/structured-data";

export const dynamicParams = true;
export const revalidate = 300;

export function generateStaticParams() {
  return listPublishedArticleSlugs().map((slug) => ({ slug }));
}

type RouteProps = { params: Promise<{ slug: string }> };

function articleForRoute(slug: string) {
  return getPublishedArticle(slug) ?? getEditorialPreview(slug);
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { slug } = await params;
  const article = articleForRoute(slug);
  if (!article) return { title: "Материал не найден", robots: noIndexRobots };
  return {
    title: pageTitle(article.metaTitle),
    description: article.metaDescription,
    alternates: { canonical: article.canonical },
    robots: article.humanReviewed ? indexableRobots : noIndexRobots,
    openGraph: {
      type: "article",
      url: article.canonical,
      title: article.metaTitle,
      description: article.metaDescription,
      publishedTime: new Date(article.publishedAt).toISOString(),
      modifiedTime: new Date(article.updatedAt).toISOString(),
      authors: [article.author],
    },
  };
}

export default async function ArticlePage({ params }: RouteProps) {
  const { slug } = await params;
  const article = articleForRoute(slug);
  if (!article) notFound();
  const semanticSourceType = article.contentType === "COMPARISON" ? "COMPARISON" : article.contentType === "ARTICLE" ? "ARTICLE" : null;
  const semanticLinks = semanticSourceType ? getSemanticLinks(semanticSourceType, article.id) : undefined;
  const semanticHrefs = new Set(semanticLinks?.items.map((item) => item.href) ?? []);
  const targetProducts = article.targetProducts.filter((product) => !semanticHrefs.has(`/p/${product.slug}`));
  const relatedArticles = article.relatedArticles.filter((related) => !semanticHrefs.has(`/articles/${related.slug}`));
  const leadProfile = getLeadProfile({ leadFormType: article.leadFormType, intentClass: article.intentClass, categorySlug: article.categorySlug });
  const leadProduct = article.targetProducts[0];
  const sourceNumbers = new Map(article.sources.map((source, index) => [source.sourceRef, index + 1]));
  const leadImages = article.images.filter((image) => image.slotType === "HERO" || (!image.sectionHeading && new Set(["DIAGRAM", "COMPARISON"]).has(image.slotType)));
  const unanchoredInlineImages = article.images.filter((image) => image.slotType === "INLINE" && !image.sectionHeading);
  const canonical = absoluteUrl(article.canonical);
  const structuredArticle = buildArticleStructuredData({
    url: canonical,
    headline: article.h1,
    description: article.excerpt,
    images: article.images.map(structuredImageUrl).filter((url): url is string => Boolean(url)),
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    author: article.author,
    reviewer: article.expertReviewer,
    publisherId: `${SITE_URL}/#organization`,
    websiteId: `${SITE_URL}/#website`,
    articleSection: article.categoryTitle,
    keywords: [article.primaryKeyword, ...article.secondaryKeywords],
  });
  const structuredBreadcrumb = buildBreadcrumbList([
    { name: "Главная", url: absoluteUrl("/") },
    { name: "База знаний", url: absoluteUrl("/articles") },
    { name: article.title, url: canonical },
  ], `${canonical}#breadcrumb`);
  return (
    <>
      {article.humanReviewed && <StructuredData data={structuredArticle} />}
      {article.humanReviewed && <StructuredData data={structuredBreadcrumb} />}
      <SiteHeader />
      {article.humanReviewed && <ArticleAnalytics articleId={article.id} category={article.categorySlug} targetId={`article-content-${article.id}`} />}
      <main>
        {!article.humanReviewed && (
          <div className="border-b border-amber-300 bg-amber-100 px-4 py-3 text-center text-[13px] font-bold text-amber-950">
            Локальный предпросмотр — статья не опубликована и закрыта от индексации
          </div>
        )}
        <header className="border-b border-steel-200 bg-white">
          <div className="mx-auto max-w-[1040px] px-4 pb-10 pt-7 sm:px-6 sm:pb-14 sm:pt-10">
            <Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "База знаний", href: "/articles" }, { label: article.title }]} />
            <div className="mt-8 flex flex-wrap items-center gap-3 text-[11px] font-bold uppercase tracking-[0.14em] text-steel-500">
              <TrackedArticleLink href={`/c/${article.categorySlug}`} event="CATEGORY_CLICK_FROM_ARTICLE" articleId={article.id} category={article.categorySlug} className="rounded-full bg-cobalt-50 px-3 py-1.5 text-cobalt-700 transition hover:bg-cobalt-100">{article.categoryTitle}</TrackedArticleLink>
              <span>{article.readingMinutes} мин чтения</span>
              <span aria-hidden>·</span>
              <time dateTime={new Date(article.updatedAt).toISOString()}>
                Обновлено {new Date(article.updatedAt).toLocaleDateString("ru-RU", { year: "numeric", month: "long", day: "numeric" })}
              </time>
            </div>
            <h1 className="mt-5 max-w-[940px] font-display text-[34px] font-black leading-[1.08] tracking-tight text-steel-900 sm:text-[48px] lg:text-[58px]">{article.h1}</h1>
            <p className="mt-5 max-w-[820px] text-[16px] leading-7 text-steel-600 sm:text-[18px]">{article.excerpt}</p>
            <div className="mt-7 flex flex-wrap gap-x-7 gap-y-2 border-t border-steel-100 pt-5 text-[12px] text-steel-500">
              <span><strong className="text-steel-800">Автор:</strong> {article.author}</span>
              <span><strong className="text-steel-800">Экспертная проверка:</strong> {article.expertReviewer}</span>
            </div>
          </div>
        </header>

        <div className="mx-auto grid max-w-[1160px] gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[minmax(0,760px)_280px] lg:items-start">
          <article id={`article-content-${article.id}`} className="min-w-0">
            <section className="rounded-[14px] border border-amber-200 bg-amber-50/70 p-6 sm:p-7">
              <h2 className="font-display text-[23px] font-extrabold tracking-tight text-steel-900">Короткий ответ</h2>
              <div className="mt-3 space-y-3 text-[15px] leading-7 text-steel-800">
                {article.content.shortAnswer.map((entry, index) => (
                  <p key={`${entry.text}-${index}`}>{entry.text}<SourceMarks refs={entry.sourceRefs} numbers={sourceNumbers} /></p>
                ))}
              </div>
            </section>

            {leadImages.map((image) => <ArticleMedia key={image.id} image={image} priority={image.slotType === "HERO"} />)}

            <div className="mt-10 space-y-12">
              {article.content.sections.map((section) => {
                const sectionImages = article.images.filter((image) => image.slotType !== "HERO" && image.sectionHeading === section.heading);
                return (
                  <section key={section.heading}>
                    <h2 className="font-display text-[27px] font-extrabold leading-tight tracking-tight text-steel-900 sm:text-[31px]">{section.heading}</h2>
                    <div className="mt-5 space-y-5 text-[15px] leading-7 text-steel-700">
                      {section.blocks.map((block, index) => <ContentBlock key={`${section.heading}-${index}`} block={block} sourceNumbers={sourceNumbers} />)}
                    </div>
                    {sectionImages.length > 1 ? (
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {sectionImages.map((image) => <ArticleMedia key={image.id} image={image} />)}
                      </div>
                    ) : sectionImages.map((image) => <ArticleMedia key={image.id} image={image} />)}
                  </section>
                );
              })}
            </div>

            {unanchoredInlineImages.map((image) => <ArticleMedia key={image.id} image={image} />)}

            {article.faq.length > 0 && (
              <section className="mt-14 border-t border-steel-200 pt-10">
                <h2 className="font-display text-[28px] font-extrabold tracking-tight text-steel-900">Частые вопросы</h2>
                <div className="mt-5 divide-y divide-steel-200 rounded-[14px] border border-steel-200 bg-white px-5 sm:px-7">
                  {article.faq.map((item) => (
                    <details key={item.question} className="group py-5">
                      <summary className="list-none pr-8 text-[15px] font-bold text-steel-900 marker:content-none">{item.question}</summary>
                      <p className="mt-3 text-[14px] leading-7 text-steel-700">{item.answer}<SourceMarks refs={[item.sourceRef]} numbers={sourceNumbers} /></p>
                    </details>
                  ))}
                </div>
              </section>
            )}

            <SemanticNextSteps links={semanticLinks} articleAnalytics={{ articleId: article.id, category: article.categorySlug }} className="mt-14 overflow-hidden rounded-[14px] border" />

            <div className="mt-14">
              <IntentLeadForm
                profileKey={leadProfile.key}
                context={{
                  articleId: article.id,
                  keywordClusterId: article.clusterId,
                  category: article.categorySlug,
                  intent: article.intentKey,
                  product: leadProduct ? { id: leadProduct.id, title: leadProduct.title, url: `/p/${leadProduct.slug}` } : undefined,
                }}
              />
              <div className="mt-4 flex flex-col items-start gap-3 rounded-[12px] border border-steel-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[14px] font-bold text-steel-900">Хотите выбрать самостоятельно?</p>
                  <p className="mt-1 text-[12px] leading-5 text-steel-600">Откройте категорию, сравните HSS и TCT, диаметры, рабочую длину и хвостовики.</p>
                </div>
                <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto">
                  <TrackedArticleLink
                    href={`/c/${article.categorySlug}`}
                    event="CATEGORY_CLICK_FROM_ARTICLE"
                    articleId={article.id}
                    category={article.categorySlug}
                    className="inline-flex min-h-11 items-center justify-center rounded-lg bg-amber-400 px-5 text-center text-[13px] font-extrabold text-steel-900 transition hover:bg-amber-300"
                  >
                    Корончатые свёрла
                  </TrackedArticleLink>
                  <TrackedArticleLink
                    href="/c/stanki-sverlilnye/magnitnye"
                    event="CATEGORY_CLICK_FROM_ARTICLE"
                    articleId={article.id}
                    category={article.categorySlug}
                    className="inline-flex min-h-11 items-center justify-center rounded-lg border border-steel-300 px-5 text-center text-[13px] font-bold text-steel-800 transition hover:border-cobalt-400 hover:text-cobalt-800"
                  >
                    Магнитные станки
                  </TrackedArticleLink>
                </div>
              </div>
            </div>

            <section className="mt-14 border-t border-steel-200 pt-9">
              <h2 className="font-display text-[24px] font-extrabold tracking-tight text-steel-900">Источники и проверка</h2>
              <ol className="mt-4 space-y-3 text-[13px] leading-6 text-steel-600">
                {article.sources.map((source, index) => (
                  <li key={`${source.sourceRef}-${source.claimText}`} id={`source-${index + 1}`} className="scroll-mt-32">
                    <span className="mr-2 font-bold text-steel-900">{index + 1}.</span>
                    {source.url || /^https?:\/\//i.test(source.sourceRef) ? (
                      <a href={source.url ?? source.sourceRef} rel="nofollow noopener noreferrer" className="font-semibold text-cobalt-700 underline decoration-cobalt-200 underline-offset-2 hover:text-cobalt-900">{source.name ?? source.url ?? source.sourceRef}</a>
                    ) : <span className="font-semibold text-steel-800">{source.sourceRef}</span>}
                    <span className="ml-2">— {source.claimText}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-5 rounded-lg bg-steel-50 px-4 py-3 text-[12px] leading-5 text-steel-600">
                {article.humanReviewed
                  ? "Материал прошёл проверку фактов, SEO и профильного специалиста. Точные параметры конкретной поставки подтверждаются паспортом изделия и менеджером."
                  : "Это редакционный предпросмотр. Проверка и публикационное подтверждение ещё не завершены; точные параметры конкретной поставки подтверждаются паспортом изделия и менеджером."}
              </p>
            </section>

            {article.expertProfile && (
              <section className="mt-10 rounded-[14px] border border-cobalt-200 bg-cobalt-50/50 p-6 sm:p-7">
                <div className="grid gap-5 sm:grid-cols-[96px_minmax(0,1fr)] sm:items-start">
                  <Image
                    src={article.expertProfile.photoPath}
                    alt={`Эксперт ${article.expertProfile.name}`}
                    width={96}
                    height={96}
                    className="h-24 w-24 rounded-[12px] border border-cobalt-200 bg-white object-cover"
                  />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cobalt-700">Профиль эксперта</p>
                    <h2 className="mt-2 font-display text-[22px] font-extrabold text-steel-900">{article.expertProfile.name}</h2>
                    <p className="mt-2 text-[14px] font-semibold leading-6 text-steel-800">{article.expertProfile.specialization}</p>
                    <p className="mt-3 text-[13px] leading-6 text-steel-600">{article.expertProfile.experience}</p>
                    <p className="mt-3 text-[12px] leading-5 text-steel-600">{article.expertProfile.reviewStatement}</p>
                    <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-bold text-cobalt-800">
                      {article.expertProfile.categories.map((category) => <span key={category} className="rounded-full border border-cobalt-200 bg-white px-3 py-1">{category}</span>)}
                      {article.expertProfile.brands.map((brand) => <span key={brand} className="rounded-full border border-cobalt-200 bg-white px-3 py-1">{brand}</span>)}
                    </div>
                    <p className="mt-4 text-[11px] text-steel-500">Проверенных опубликованных материалов: {article.expertProfile.articles.length}</p>
                  </div>
                </div>
              </section>
            )}
          </article>

          <aside className="space-y-5 lg:sticky lg:top-32">
            {targetProducts.length > 0 && (
              <section className="rounded-[14px] border border-steel-200 bg-white p-5 shadow-soft">
                <h2 className="font-display text-[18px] font-extrabold tracking-tight text-steel-900">Товары по теме</h2>
                <ul className="mt-4 divide-y divide-steel-100">
                  {targetProducts.map((product) => (
                    <li key={product.id} className="py-3 first:pt-0 last:pb-0">
                      <TrackedArticleLink href={`/p/${product.slug}`} event="PRODUCT_CLICK_FROM_ARTICLE" articleId={article.id} category={article.categorySlug} productId={product.id} className="block text-[13px] font-bold leading-5 text-steel-800 transition hover:text-amber-700">
                        {product.title}
                        {product.brand && <span className="mt-1 block text-[11px] font-medium uppercase tracking-wider text-steel-400">{product.brand}</span>}
                      </TrackedArticleLink>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <section className="rounded-[14px] border border-amber-300 bg-steel-900 p-5 text-white shadow-card">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">{leadProfile.eyebrow}</div>
              <h2 className="mt-3 font-display text-[20px] font-extrabold leading-tight">{leadProfile.title}</h2>
              <p className="mt-3 text-[13px] leading-6 text-steel-300">{leadProfile.description}</p>
              <Link href="#intent-lead-form" className="mt-5 inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-amber-400 px-4 text-center text-[13px] font-extrabold text-steel-900 transition hover:bg-amber-300">{leadProfile.cta}</Link>
              <TrackedArticleLink
                href={`/c/${article.categorySlug}`}
                event="CATEGORY_CLICK_FROM_ARTICLE"
                articleId={article.id}
                category={article.categorySlug}
                className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-steel-600 px-4 text-center text-[13px] font-bold text-white transition hover:border-amber-300 hover:text-amber-300"
              >
                Смотреть каталог
              </TrackedArticleLink>
              <TrackedArticleLink
                href="/c/stanki-sverlilnye/magnitnye"
                event="CATEGORY_CLICK_FROM_ARTICLE"
                articleId={article.id}
                category={article.categorySlug}
                className="mt-2 inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-steel-600 px-4 text-center text-[13px] font-bold text-white transition hover:border-amber-300 hover:text-amber-300"
              >
                Магнитные станки
              </TrackedArticleLink>
            </section>
          </aside>
        </div>

        {relatedArticles.length > 0 && (
          <section className="border-t border-steel-200 bg-white">
            <div className="mx-auto max-w-[1160px] px-4 py-12 sm:px-6">
              <h2 className="font-display text-[27px] font-extrabold tracking-tight text-steel-900">Материалы по теме</h2>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {relatedArticles.map((related) => (
                  <Link key={related.slug} href={`/articles/${related.slug}`} className="rounded-[12px] border border-steel-200 p-5 transition hover:border-amber-300 hover:shadow-soft">
                    <span className="font-display text-[18px] font-extrabold text-steel-900">{related.title}</span>
                    <span className="mt-2 line-clamp-2 block text-[13px] leading-6 text-steel-600">{related.excerpt}</span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
    </>
  );
}

function SourceMarks({ refs, numbers }: { refs: string[]; numbers: Map<string, number> }) {
  const known = refs.map((ref) => numbers.get(ref)).filter((value): value is number => value !== undefined);
  if (!known.length) return null;
  return <>{known.map((number) => <sup key={number} className="ml-1"><a href={`#source-${number}`} className="font-bold text-cobalt-700">[{number}]</a></sup>)}</>;
}

function ContentBlock({ block, sourceNumbers }: { block: ArticleBlock; sourceNumbers: Map<string, number> }) {
  if (block.type === "paragraph") return <p>{block.text}<SourceMarks refs={block.sourceRefs} numbers={sourceNumbers} /></p>;
  if (block.type === "note") return <div className="rounded-[10px] border-l-4 border-cobalt-500 bg-cobalt-50 px-5 py-4 text-steel-800">{block.text}<SourceMarks refs={block.sourceRefs} numbers={sourceNumbers} /></div>;
  if (block.type === "list") return (
    <div>
      <ul className="space-y-2 pl-5">
        {block.items.map((item) => <li key={item} className="list-disc pl-1">{item}</li>)}
      </ul>
      <SourceMarks refs={block.sourceRefs} numbers={sourceNumbers} />
    </div>
  );
  return (
    <div className="overflow-x-auto rounded-[12px] border border-steel-200">
      <table className="w-full min-w-[560px] border-collapse text-left text-[13px]">
        <caption className="border-b border-steel-200 bg-steel-50 px-4 py-3 text-left font-bold text-steel-900">{block.caption}<SourceMarks refs={block.sourceRefs} numbers={sourceNumbers} /></caption>
        <thead><tr>{block.columns.map((column) => <th key={column} className="border-b border-steel-200 bg-white px-4 py-3 font-bold text-steel-900">{column}</th>)}</tr></thead>
        <tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex} className="border-b border-steel-100 last:border-0">{row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`} className="px-4 py-3 align-top text-steel-700">{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function ArticleMedia({ image, priority = false }: { image: PublishedArticleImage; priority?: boolean }) {
  const avif = image.variants.filter((variant) => variant.mime === "image/avif").sort((left, right) => left.width - right.width);
  const webp = image.variants.filter((variant) => variant.mime === "image/webp").sort((left, right) => left.width - right.width);
  const jpeg = image.variants.filter((variant) => variant.mime === "image/jpeg").sort((left, right) => left.width - right.width);
  const png = image.variants.filter((variant) => variant.mime === "image/png").sort((left, right) => left.width - right.width);
  const fallback = png.at(-1) ?? jpeg.at(-1) ?? webp.at(-1) ?? avif.at(-1);
  if (!fallback) return null;
  const srcSet = (variants: PublishedArticleImage["variants"]) => variants.map((variant) => `${variant.url} ${variant.width}w`).join(", ");
  const isDiagram = image.aiGenerated || new Set(["DIAGRAM", "COMPARISON"]).has(image.slotType);
  return (
    <figure className={`mt-8 overflow-hidden rounded-[14px] border ${isDiagram ? "border-cobalt-200 bg-cobalt-50/40" : "border-steel-200 bg-white"}`}>
      <picture>
        {avif.length > 0 && <source type="image/avif" srcSet={srcSet(avif)} sizes="(max-width: 820px) 100vw, 760px" />}
        {webp.length > 0 && <source type="image/webp" srcSet={srcSet(webp)} sizes="(max-width: 820px) 100vw, 760px" />}
        {avif.length > 0 || webp.length > 0 ? (
          <img
            src={fallback.url}
            alt={image.alt}
            width={fallback.width}
            height={fallback.height}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            decoding="async"
            className="h-auto w-full object-contain"
          />
        ) : (
          <Image
            src={fallback.url}
            alt={image.alt}
            width={fallback.width}
            height={fallback.height}
            priority={priority}
            sizes="(max-width: 820px) 100vw, 760px"
            className="h-auto w-full object-contain"
          />
        )}
      </picture>
      {(image.caption || image.attribution || image.disclosure) && (
        <figcaption className="border-t border-inherit px-4 py-3 text-[12px] leading-5 text-steel-600 sm:px-5">
          {image.caption && <span>{image.caption}</span>}
          {image.disclosure && <span className="mt-1 block font-bold text-cobalt-800">{image.disclosure}</span>}
          {image.attribution && <span className="mt-1 block text-[11px] text-steel-500">Источник изображения: {image.attribution}</span>}
        </figcaption>
      )}
    </figure>
  );
}

function structuredImageUrl(image: PublishedArticleImage): string | undefined {
  const variant = image.variants
    .filter((item) => item.mime === "image/webp")
    .sort((left, right) => right.width - left.width)[0]
    ?? image.variants.slice().sort((left, right) => right.width - left.width)[0];
  return variant ? absoluteUrl(variant.url) : undefined;
}
