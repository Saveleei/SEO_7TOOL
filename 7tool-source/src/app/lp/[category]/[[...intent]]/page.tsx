/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { LandingLeadForm } from "@/components/landing/LandingLeadForm";
import { LandingProductCard } from "@/components/landing/LandingProductCard";
import { LandingQuoteBar } from "@/components/landing/LandingQuoteBar";
import { LandingQuickTasks } from "@/components/landing/LandingQuickTasks";
import { LandingTracker } from "@/components/landing/LandingTracker";
import { StructuredData } from "@/components/StructuredData";
import { contentForCategory } from "@/lib/category-content";
import { getPublicCategory } from "@/lib/categories-db";
import { getLandingContent, type LandingContent, type LandingImageBlock, type LandingProcessStep } from "@/lib/landing-content-db";
import { getProductsByCategory } from "@/lib/products-db";
import { findLandingCategory, findLandingIntent, landingPassesContentGate, landingSeoDecision, productsForLanding, quickTasksForLanding } from "@/lib/landing-pages";
import { indexableRobots, noIndexRobots, pageTitle } from "@/lib/seo-metadata";
import { absoluteUrl, company, phoneHref } from "@/lib/site-config";
import { categorySocialPreviewPath, socialPreviewImage } from "@/lib/social-preview";

type RouteProps = { params: Promise<{ category: string; intent?: string[] }> };

// Каталог и ручной контент читаются из SQLite на каждом запросе. Обновление
// фида меняет цены и наличие, но не перезаписывает таблицу landing_content.
export const dynamic = "force-dynamic";

function resolve(params: { category: string; intent?: string[] }) {
  if ((params.intent?.length ?? 0) > 1) return undefined;
  const category = findLandingCategory(params.category);
  if (!category) return undefined;
  const intent = findLandingIntent(category, params.intent?.[0]);
  if (!intent || !landingPassesContentGate(intent)) return undefined;
  return { category, intent };
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const selected = resolve(await params);
  if (!selected) return { title: "Страница не найдена", robots: { index: false, follow: false } };
  const content = getLandingContent(selected.category.slug, selected.intent.slug);
  const categorySeo = contentForCategory(selected.category.slug, selected.category.label);
  const categoryProducts = getProductsByCategory(selected.category.slug);
  const productCount = productsForLanding(categoryProducts, selected.intent).total;
  const decision = landingSeoDecision(selected.category, selected.intent, productCount);
  const canonical = decision.canonicalPath;
  const title = content.seo.metaTitle || selected.intent.metaTitle || `${content.hero.h1 || selected.intent.h1} — подбор, цены и наличие`;
  const description = content.seo.metaDescription || selected.intent.metaDescription || `${content.hero.description || selected.intent.description} Подбор по параметрам задачи, цены с НДС и доставка по России.`;
  const keywords = content.seo.keywords
    ? content.seo.keywords.split(",").map((item) => item.trim()).filter(Boolean)
    : selected.intent.keywords || categorySeo.keywords;
  const publicCategory = getPublicCategory(selected.category.slug);
  const firstProductImage = categoryProducts.find((product) => product.images?.[0])?.images?.[0];
  const image = socialPreviewImage(
    categorySocialPreviewPath(selected.category.slug, publicCategory?.coverImage, firstProductImage),
    publicCategory?.imageAlt || selected.category.label,
  );
  return {
    title: pageTitle(title),
    description,
    keywords,
    alternates: { canonical },
    robots: decision.indexable ? indexableRobots : noIndexRobots,
    openGraph: { type: "website", title, description, url: absoluteUrl(canonical), images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image.url] },
  };
}

export default async function LandingPage({ params }: RouteProps) {
  const selected = resolve(await params);
  if (!selected) notFound();
  const publicCategory = getPublicCategory(selected.category.slug);
  if (!publicCategory) notFound();
  const listing = productsForLanding(getProductsByCategory(selected.category.slug), selected.intent);
  const seoDecision = landingSeoDecision(selected.category, selected.intent, listing.total);

  const content = getLandingContent(selected.category.slug, selected.intent.slug);
  const hero = {
    h1: content.hero.h1 || selected.intent.h1,
    offer: content.hero.offer || selected.intent.offer,
    description: content.hero.description || selected.intent.description,
    responsePromise: content.hero.responsePromise || "Пришлём 3–5 подходящих моделей с ценами, наличием и сроками в рабочее время.",
  };
  const proof = resolvedProof(content);
  const process = resolvedProcess(content);
  const cases = content.cases.items.filter((item) => item.title && (item.task || item.result));
  const faq = content.faq.some((item) => item.question && item.answer)
    ? content.faq.filter((item) => item.question && item.answer)
    : selected.intent.faq;
  const categorySeo = contentForCategory(selected.category.slug, publicCategory.title);
  const seoHeading = content.seo.heading || selected.intent.seoHeading || categorySeo.seoTitle;
  const seoParagraphs = (content.seo.text || selected.intent.seoText?.join("\n\n") || categorySeo.seoText.join("\n\n"))
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const quickTasks = quickTasksForLanding(selected.intent, selected.category.label);
  const canonical = absoluteUrl(seoDecision.canonicalPath);
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "7TOOL", item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: publicCategory.title, item: absoluteUrl(`/c/${selected.category.slug}`) },
      { "@type": "ListItem", position: 3, name: hero.h1, item: canonical },
    ],
  };
  const collectionLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: hero.h1,
    description: content.seo.metaDescription || hero.description,
    url: canonical,
    inLanguage: "ru-RU",
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: listing.products.length,
      itemListElement: listing.products.map((product, index) => ({
        "@type": "ListItem", position: index + 1, name: product.title, url: absoluteUrl(`/p/${product.slug}`),
      })),
    },
  };
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } })),
  };

  return (
    <>
      <StructuredData data={breadcrumbLd} />
      <StructuredData data={collectionLd} />
      <StructuredData data={faqLd} />
      <div className="min-h-screen bg-[#f7f8f9] pb-20 sm:pb-0">
      <LandingTracker category={selected.category.slug} intent={selected.intent.slug} />
      <LandingHeader />
      <main>
        <section className="relative overflow-hidden border-b border-steel-200 bg-white">
          <div className="absolute inset-0 bg-mesh-light opacity-80" />
          <div className="relative mx-auto grid max-w-[1180px] gap-8 px-4 py-8 sm:px-6 sm:py-12 lg:grid-cols-[1.15fr_.85fr] lg:items-start lg:py-16">
            <div>
              <nav aria-label="Хлебные крошки" className="text-[11px] font-semibold text-steel-500">
                <Link href="/" className="hover:text-amber-700">7TOOL</Link><span className="mx-2">/</span>
                <Link href={`/c/${selected.category.slug}`} className="hover:text-amber-700">{publicCategory.title}</Link>
              </nav>
              <div className="mt-5 inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.15em] text-amber-800">Подбор по задаче</div>
              <h1 className="mt-4 max-w-[760px] font-display text-[34px] font-black leading-[1.03] tracking-tight text-steel-900 sm:text-[46px] lg:text-[54px]">{hero.h1}</h1>
              <p className="mt-5 max-w-[700px] font-display text-[20px] font-extrabold leading-tight text-steel-800 sm:text-[24px]">{hero.offer}</p>
              <p className="mt-3 max-w-[680px] text-[15px] leading-relaxed text-steel-600">{hero.description}</p>
              <ul className="mt-6 grid gap-2 text-[13px] font-semibold text-steel-700 sm:grid-cols-3">
                {selected.intent.advantages.map((advantage) => <li key={advantage} className="flex gap-2"><span className="mt-0.5 text-amber-600">●</span><span>{advantage}</span></li>)}
              </ul>
              <div className="mt-7 flex flex-wrap gap-3">
                <a href="#request" className="inline-flex min-h-12 items-center justify-center rounded-lg bg-amber-400 px-5 text-sm font-extrabold text-steel-900 shadow-amber hover:bg-amber-300">Получить подбор и КП</a>
                <a href={phoneHref(company.primaryPhone)} className="inline-flex min-h-12 items-center justify-center rounded-lg border border-steel-300 bg-white px-5 text-sm font-extrabold text-steel-800 hover:border-amber-400">Позвонить</a>
              </div>
              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[11px] font-bold uppercase tracking-[0.08em] text-steel-500">
                <span>{listing.total.toLocaleString("ru-RU")} подходящих товарных групп</span>
                <span>{listing.inStock.toLocaleString("ru-RU")} с вариантами в наличии</span>
                <span>Данные каталога</span>
              </div>
            </div>
            <div id="request" className="mx-auto w-full max-w-[500px]">
              <LandingLeadForm category={selected.category.slug} intent={selected.intent.slug} title={hero.h1} questions={selected.intent.questions} responsePromise={hero.responsePromise} compact />
            </div>
          </div>
        </section>

        <section className="border-b border-steel-200 bg-white py-8">
          <div className="mx-auto max-w-[1180px] px-4 sm:px-6">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-amber-700">Быстрый выбор</div>
            <h2 className="mt-2 font-display text-[24px] font-black text-steel-900 sm:text-[30px]">Уточните сценарий задачи</h2>
            {selected.category.intents.length > 1 && <div className="mt-4"><div className="text-[11px] font-bold uppercase tracking-[0.1em] text-steel-500">Тип решения</div><div className="mt-2 flex flex-wrap gap-2">{selected.category.intents.map((intent) => <Link key={intent.slug} href={`/lp/${selected.category.slug}/${intent.slug}`} className={`inline-flex min-h-11 items-center rounded-lg border px-4 text-[13px] font-extrabold ${intent.slug === selected.intent.slug ? "border-amber-400 bg-amber-50 text-amber-900" : "border-steel-200 bg-white text-steel-700 hover:border-amber-300"}`}>{intent.label}</Link>)}</div></div>}
            <LandingQuickTasks category={selected.category.slug} intent={selected.intent.slug} tasks={quickTasks} />
            <Link href={`/c/${selected.category.slug}`} className="mt-4 inline-flex min-h-11 items-center rounded-lg border border-steel-300 bg-steel-50 px-4 text-[13px] font-extrabold text-steel-800 hover:border-amber-400 hover:bg-amber-50">Все товары категории →</Link>
          </div>
        </section>

        {listing.products.length > 0 ? <section className="py-10 sm:py-14">
          <div className="mx-auto max-w-[1180px] px-4 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div><div className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-amber-700">Подходящие позиции</div><h2 className="mt-2 font-display text-[26px] font-black text-steel-900 sm:text-[34px]">Подборка: {selected.intent.label}</h2><p className="mt-2 max-w-[700px] text-[13px] leading-relaxed text-steel-600">Показано до 12 из {listing.total.toLocaleString("ru-RU")} подходящих товарных групп. Добавьте интересующие модели в один запрос КП.</p></div>
              <Link href={`/c/${selected.category.slug}`} className="inline-flex min-h-11 items-center rounded-lg border border-steel-200 bg-white px-4 text-[12px] font-extrabold text-steel-700 hover:border-amber-300">Открыть всю категорию</Link>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
              {listing.products.map((product) => <LandingProductCard key={product.id} product={product} category={selected.category.slug} intent={selected.intent.slug} />)}
            </div>
            <div className="mt-8 flex flex-col items-center rounded-2xl border border-steel-200 bg-white px-5 py-6 text-center shadow-soft">
              <p className="text-[13px] text-steel-600">Нужен другой размер, бренд или исполнение? В полной категории доступны все опубликованные товары с фотографиями.</p>
              <Link href={`/c/${selected.category.slug}`} className="mt-4 inline-flex min-h-12 items-center justify-center rounded-lg bg-amber-400 px-6 text-sm font-extrabold text-steel-900 shadow-amber hover:bg-amber-300">Открыть всю категорию →</Link>
            </div>
          </div>
        </section> : <section className="py-10 sm:py-14">
          <div className="mx-auto max-w-[1180px] px-4 sm:px-6">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 sm:p-8">
              <div className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-amber-800">Честный каталог</div>
              <h2 className="mt-2 font-display text-[26px] font-black text-steel-900 sm:text-[34px]">Карточки без подтверждённых фотографий не публикуем</h2>
              <p className="mt-3 max-w-[760px] text-[14px] leading-relaxed text-steel-700">Подберём варианты по параметрам задачи и пришлём реальные фотографии, цены и сроки вместе с коммерческим предложением.</p>
              <a href="#request" className="mt-5 inline-flex min-h-12 items-center justify-center rounded-lg bg-amber-400 px-5 text-sm font-extrabold text-steel-900 hover:bg-amber-300">Запросить подбор</a>
            </div>
          </div>
        </section>}

        <section className="border-y border-steel-200 bg-steel-900 py-10 text-white sm:py-14">
          <div className="mx-auto max-w-[1180px] px-4 sm:px-6">
            <div className="max-w-[760px]"><div className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-amber-300">Почему 7TOOL</div><h2 className="mt-2 font-display text-[28px] font-black sm:text-[36px]">{proof.heading}</h2>{proof.intro && <p className="mt-3 text-sm leading-relaxed text-steel-300">{proof.intro}</p>}</div>
            <div className="mt-7 grid gap-5 lg:grid-cols-3">
              {proof.items.map((item, index) => (
                <article key={`${item.title}-${index}`} className="overflow-hidden rounded-2xl border border-white/15 bg-white/5">
                  {item.image ? <div className="aspect-[16/10] overflow-hidden bg-steel-900"><img src={item.image} alt={item.imageAlt || item.title} className="h-full w-full object-cover" loading="lazy" /></div> : <div className="flex aspect-[16/6] items-center justify-center bg-white/[.04]"><span className="flex h-14 w-14 items-center justify-center rounded-full border border-amber-300/40 bg-amber-300/10 font-display text-xl font-black text-amber-300">0{index + 1}</span></div>}
                  <div className="p-5"><h3 className="font-display text-xl font-extrabold text-amber-300">{item.title}</h3><p className="mt-2 text-sm leading-relaxed text-steel-200">{item.text}</p></div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white py-10 sm:py-14">
          <div className="mx-auto max-w-[1180px] px-4 sm:px-6">
            <div className="max-w-[760px]"><div className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-amber-700">Порядок работы</div><h2 className="mt-2 font-display text-[28px] font-black text-steel-900 sm:text-[36px]">{process.heading}</h2>{process.intro && <p className="mt-3 text-sm leading-relaxed text-steel-600">{process.intro}</p>}</div>
            <ol className="mt-7 grid gap-4 md:grid-cols-3">
              {process.steps.map((step, index) => <li key={`${step.title}-${index}`} className="rounded-2xl border border-steel-200 bg-steel-50 p-5"><div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-amber-700">Шаг {index + 1}</div><h3 className="mt-2 font-display text-[19px] font-extrabold text-steel-900">{step.title}</h3><p className="mt-2 text-[13px] leading-relaxed text-steel-600">{step.text}</p></li>)}
            </ol>
          </div>
        </section>

        {cases.length > 0 && (
          <section className="border-y border-steel-200 py-10 sm:py-14">
            <div className="mx-auto max-w-[1180px] px-4 sm:px-6"><div className="max-w-[760px]"><div className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-amber-700">Практика</div><h2 className="mt-2 font-display text-[28px] font-black text-steel-900">{content.cases.heading || "Примеры решённых задач"}</h2>{content.cases.intro && <p className="mt-3 text-sm leading-relaxed text-steel-600">{content.cases.intro}</p>}</div>
              <div className="mt-7 grid gap-5 lg:grid-cols-3">{cases.map((item, index) => <article key={`${item.title}-${index}`} className="overflow-hidden rounded-2xl border border-steel-200 bg-white shadow-soft">{item.image && <div className="aspect-[16/10] overflow-hidden bg-steel-100"><img src={item.image} alt={item.imageAlt || item.title} className="h-full w-full object-cover" loading="lazy" /></div>}<div className="p-5"><h3 className="font-display text-xl font-extrabold text-steel-900">{item.title}</h3>{item.task && <p className="mt-3 text-[13px] leading-relaxed text-steel-600"><strong className="text-steel-900">Задача:</strong> {item.task}</p>}{item.result && <p className="mt-2 text-[13px] leading-relaxed text-steel-600"><strong className="text-steel-900">Результат:</strong> {item.result}</p>}</div></article>)}</div>
            </div>
          </section>
        )}

        {seoParagraphs.length > 0 && (
          <section className="border-y border-steel-200 bg-steel-50 py-10 sm:py-14">
            <div className="mx-auto max-w-[980px] px-4 sm:px-6">
              <div className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-amber-700">Полезно перед выбором</div>
              <h2 className="mt-2 font-display text-[26px] font-black text-steel-900 sm:text-[32px]">{seoHeading}</h2>
              <div className="mt-4 space-y-3 text-[14px] leading-7 text-steel-700">
                {seoParagraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
            </div>
          </section>
        )}

        <section className="bg-white py-10 sm:py-14">
          <div className="mx-auto grid max-w-[1040px] gap-8 px-4 sm:px-6 lg:grid-cols-[.9fr_1.1fr]">
            <div><div className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-amber-700">Вопросы и ответы</div><h2 className="mt-2 font-display text-[28px] font-black text-steel-900">Перед запросом</h2><div className="mt-5 grid gap-3">{faq.map((item) => <details key={item.question} className="group rounded-xl border border-steel-200 bg-white p-4"><summary className="cursor-pointer font-display text-[15px] font-extrabold text-steel-900">{item.question}</summary><p className="mt-3 text-[13px] leading-relaxed text-steel-600">{item.answer}</p></details>)}</div></div>
            <div id="request-lower"><LandingLeadForm category={selected.category.slug} intent={selected.intent.slug} title={hero.h1} questions={selected.intent.questions} responsePromise={hero.responsePromise} /></div>
          </div>
        </section>
      </main>
      <footer className="border-t border-steel-200 bg-white py-7"><div className="mx-auto flex max-w-[1180px] flex-col gap-3 px-4 text-[12px] text-steel-600 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div><strong className="text-steel-900">7TOOL</strong> · {company.address}<div className="mt-1">{company.primaryPhone} · {company.email}</div></div><div className="flex gap-4"><Link href="/politika-konfidencialnosti" className="hover:text-amber-800">Конфиденциальность</Link><Link href={`/c/${selected.category.slug}`} className="hover:text-amber-800">Полный каталог</Link></div></div></footer>
      <LandingQuoteBar category={selected.category.slug} intent={selected.intent.slug} />
      <div className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-2 gap-2 border-t border-steel-200 bg-white p-2 shadow-elev sm:hidden"><a href={phoneHref(company.primaryPhone)} className="inline-flex min-h-12 items-center justify-center rounded-lg border border-steel-300 text-sm font-extrabold text-steel-800">Позвонить</a><a href="#request" className="inline-flex min-h-12 items-center justify-center rounded-lg bg-amber-400 text-sm font-extrabold text-steel-900">Получить КП</a></div>
      </div>
    </>
  );
}

function resolvedProof(content: LandingContent): { heading: string; intro: string; items: LandingImageBlock[] } {
  const defaults: LandingImageBlock[] = [
    { title: "Склад в Москве и Санкт-Петербурге", text: "Товар в наличии отгружаем в день оплаты транспортной компанией или нашей машиной.", image: "/site/why-stock.webp", imageAlt: "Склад промышленного оборудования 7TOOL" },
    { title: "Проверка инженером", text: "Сверяем параметры задачи, совместимость оборудования и оснастки, комплектацию и режим работы.", image: "/site/why-engineer.webp", imageAlt: "Инженер 7TOOL подбирает промышленное оборудование" },
    { title: "Полный пакет документов", text: "Счёт-фактура с НДС, паспорт изделия, сертификат ТР ТС; оригиналы — по почте или ЭДО.", image: "/site/why-documents.webp", imageAlt: "Документы на промышленное оборудование" },
  ];
  return {
    heading: content.proof.heading || "Поставляем оборудование, которое можно проверить до оплаты",
    intro: content.proof.intro || "Конкретные условия по выбранной модели фиксируем в коммерческом предложении.",
    items: defaults.map((fallback, index) => {
      const item = content.proof.items[index];
      return item && (item.title || item.text || item.image) ? { ...fallback, ...item, title: item.title || fallback.title, text: item.text || fallback.text } : fallback;
    }),
  };
}

function resolvedProcess(content: LandingContent): { heading: string; intro: string; steps: LandingProcessStep[] } {
  const defaults = [
    { title: "Опишите задачу", text: "Ответьте на три коротких технических вопроса — без длинного опросника." },
    { title: "Получите сравнение", text: "Инженер подготовит 3–5 подходящих моделей с ключевыми отличиями." },
    { title: "Согласуйте поставку", text: "Цена, наличие, комплектация, документы и срок будут зафиксированы в КП." },
  ];
  return {
    heading: content.process.heading || "От задачи до согласованного КП — три шага",
    intro: content.process.intro || "Запрос не является заказом и не обязывает к покупке.",
    steps: defaults.map((fallback, index) => {
      const step = content.process.steps[index];
      return step && (step.title || step.text) ? { title: step.title || fallback.title, text: step.text || fallback.text } : fallback;
    }),
  };
}
