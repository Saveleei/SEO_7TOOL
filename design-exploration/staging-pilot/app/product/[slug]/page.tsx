import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "../../ui/Breadcrumbs";
import { ContactRequestDialog } from "../../ui/ContactRequestDialog";
import { FeedProductGallery } from "../../ui/FeedProductGallery";
import { FeedProductPurchase } from "../../ui/FeedProductPurchase";
import { ManagerContactCard } from "../../ui/ManagerContactCard";
import { PilotFooter } from "../../ui/PilotFooter";
import { PilotHeader } from "../../ui/PilotHeader";
import { ProductRecommendationSystem } from "../../ui/ProductRecommendationSystem";
import { JsonLd } from "../../ui/JsonLd";
import { AddRequestButton, RequestCartButton } from "../../ui/RequestCart";
import { SocialShareButton } from "../../ui/SocialShareButton";
import { formatFeedPrice, getFeedCatalogRevision, getFeedCategory, getFeedParameterLabel, getFeedProductAlternatives, getFeedProductImage, getFeedProductPriceLabel, getFeedProductRouteBySlug, getFeedVariantSpecs, type FeedParameter, type FeedVariant } from "../../data/feedCatalog";
import { getProductionSubcategory } from "../../data/productionCategoryGroups";
import { getCategoryExpertProfile } from "../../data/categoryExpertProfiles.mjs";
import { getProductPageArchetype } from "../../data/productPageArchetypes";
import { getProductVariantChoice, getProductVariantChoicePage, getVariantChoicePresentation, selectDefaultVariant, sortVariantsForChoice } from "../../data/variantPresentation";
import { getVariantShippingPromise } from "../../data/shippingPromise.mjs";
import { canonicalUrl, createPublicMetadata, hasSearchParameters } from "../../data/seo";
import { buildProductSeoKeywords } from "../../data/seoKeywords";
import { requestedSocialCardSharePath, socialCardMetadataImage, socialCardSharePath } from "../../data/socialCards";
import { getCatalogBlockingProductIds } from "../../data/catalogQuality";
import { publicBrandPath, publicCategoryPath, publicProductPath } from "../../data/publicUrls";
import { getLegacyRetainedProduct } from "../../data/legacyRetainedProducts";
import { LegacyRetainedProductPage } from "../../ui/LegacyRetainedProductPage";

type RouteProps = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata({ params, searchParams }: RouteProps): Promise<Metadata> {
  const { slug } = await params;
  const rawSearchParams = await searchParams;
  const route = getFeedProductRouteBySlug(slug);
  const product = route?.product;
  const retainedProduct = product ? undefined : getLegacyRetainedProduct(slug);
  const dataConflict = Boolean(product && getCatalogBlockingProductIds().has(product.id));
  const selectedVariantId = typeof rawSearchParams.variant === "string" ? rawSearchParams.variant : "";
  const selectedVariant = route?.variant ?? product?.variants.find((variant) => variant.id === selectedVariantId);
  const selectedChoice = product && selectedVariant ? getVariantChoicePresentation(product, selectedVariant) : undefined;
  const productTitle = product ? `${product.title}${selectedChoice ? `, ${selectedChoice.label}` : ""}` : retainedProduct?.title;
  const pagePath = product ? publicProductPath(product, route?.variant) : `/p/${slug}`;
  return createPublicMetadata({
    title:product ? `${productTitle} — цена и характеристики | 7TOOL` : retainedProduct ? `${productTitle} — поставка или замена | 7TOOL` : "Товар — 7TOOL",
    description:product ? `${product.title}${selectedChoice ? `, ${selectedChoice.label}` : ""}. Характеристики выбранного исполнения, цена с НДС и запрос коммерческого предложения.` : retainedProduct ? `${retainedProduct.title}. Проверка актуальной поставки или подбор подтверждённой замены у 7TOOL.` : "Карточка промышленного оборудования 7TOOL.",
    path:pagePath,
    indexable:Boolean(product || retainedProduct) && !dataConflict && !hasSearchParameters(rawSearchParams),
    image:productTitle ? socialCardMetadataImage("product", `${productTitle} — фото товара на карточке 7TOOL`, slug) : undefined,
    socialPath:requestedSocialCardSharePath(pagePath, firstValue(rawSearchParams.share), "product", slug),
    keywords:buildProductSeoKeywords({
      title:product?.title ?? retainedProduct?.title,
      brand:product?.brand,
      sku:selectedVariant?.sku ?? product?.sku,
      variant:selectedChoice?.label,
    }),
  });
}

export default async function FeedProductPage({ params, searchParams }: RouteProps) {
  const { slug } = await params;
  const rawSearchParams = await searchParams;
  const route = getFeedProductRouteBySlug(slug);
  if (!route) {
    const retainedProduct = getLegacyRetainedProduct(slug);
    if (retainedProduct) return <LegacyRetainedProductPage product={retainedProduct} />;
    notFound();
  }
  const { product } = route;
  const dataConflict = getCatalogBlockingProductIds().has(product.id);

  const category = getFeedCategory(product.category);
  const productionEntry = getProductionSubcategory(product.category);
  const expertProfile = getCategoryExpertProfile(product.category);
  const pageArchetype = getProductPageArchetype(product.category);
  const selectedVariantId = route.variant?.id ?? (typeof rawSearchParams.variant === "string" ? rawSearchParams.variant : "");
  const allVariants = sortVariantsForChoice(product, product.variants.filter((variant) => variant.name || variant.sku));
  const primaryVariant = allVariants.find((variant) => variant.id === selectedVariantId) ?? selectDefaultVariant(product, allVariants);
  const hasExactVariantImage = Boolean(primaryVariant && primaryVariant.images?.[0]);
  const images = Array.from(new Set([...(primaryVariant?.images ?? []), ...product.images, getFeedProductImage(product)].filter((image): image is string => Boolean(image))));
  const keySpecs = primaryVariant ? getFeedVariantSpecs(product, primaryVariant).slice(0, 4) : [];
  const fullSpecs = primaryVariant?.params.filter((parameter) => !/^(бренд|производитель)$/i.test(parameter.name)) ?? [];
  const descriptionParagraphs = product.description?.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter((paragraph) => paragraph.length >= 60 && !paragraph.endsWith("?")).slice(0, 2) ?? [];
  const drillDescription = product.category === "stanki-sverlilnye" && primaryVariant ? buildDrillDescription(primaryVariant) : null;
  const initialPurchasePage = getProductVariantChoicePage(product, { limit:24 });
  const selectedPurchaseVariant = primaryVariant ? getProductVariantChoice(product, primaryVariant.id) : undefined;
  const initialPurchaseVariants = selectedPurchaseVariant && !initialPurchasePage.variants.some((variant) => variant.id === selectedPurchaseVariant.id)
    ? [selectedPurchaseVariant, ...initialPurchasePage.variants]
    : initialPurchasePage.variants;
  const variantsEndpoint = `/api/catalog-product-variants?product=${encodeURIComponent(product.slug)}&v=${encodeURIComponent(getFeedCatalogRevision())}`;
  const primaryPrice = formatFeedPrice(primaryVariant?.price) ?? getFeedProductPriceLabel(product);
  const primaryShipping = getVariantShippingPromise(primaryVariant);
  const primaryChoice = primaryVariant ? getVariantChoicePresentation(product, primaryVariant) : undefined;
  const selectedProductContext = [product.title, primaryChoice?.label, primaryVariant?.sku ? `артикул ${primaryVariant.sku}` : ""].filter(Boolean).join(", ");
  const alternatives = primaryVariant ? getFeedProductAlternatives(product, primaryVariant, 3) : [];
  const productUrl = canonicalUrl(publicProductPath(product, route.variant));
  const sharePath = socialCardSharePath(publicProductPath(product, route.variant), "product", slug);
  const verifiedOffer = primaryVariant && typeof primaryVariant.price === "number" && primaryVariant.price > 0 && primaryShipping.available
    ? { "@type":"Offer", url:productUrl, priceCurrency:"RUB", price:primaryVariant.price, availability:"https://schema.org/InStock", seller:{ "@id":"https://7tool.ru/#organization" } }
    : undefined;
  const productStructuredData = {
    "@context":"https://schema.org",
    "@type":"Product",
    "@id":`${productUrl}#product`,
    name:product.title,
    url:productUrl,
    sku:primaryVariant?.sku || product.sku || undefined,
    brand:{ "@type":"Brand", name:product.brand },
    category:category?.title,
    image:images,
    description:(descriptionParagraphs[0] ?? `${product.title}. Характеристики выбранного исполнения из товарного каталога поставщика.`).slice(0, 500),
    additionalProperty:keySpecs.map((spec) => ({ "@type":"PropertyValue", name:spec.label, value:spec.value })),
    ...(verifiedOffer ? { offers:verifiedOffer } : {}),
  };

  return <div className="site-shell">{!dataConflict && <JsonLd data={productStructuredData} />}<PilotHeader /><main className="inner-page feed-product-conversion-page" data-product-archetype={pageArchetype.id}>
    <div className="container"><Breadcrumbs items={[{ label:"Главная", href:"/" }, { label:"Каталог", href:"/catalog" }, ...(productionEntry ? [{ label:productionEntry.group.title, href:productionEntry.group.href }] : []), { label:category?.title ?? product.category, href:publicCategoryPath(product.category) }, ...(product.brand && product.brand !== "—" ? [{ label:product.brand, href:publicBrandPath(product.brand) }] : []), { label:product.title }]} /></div>

    {dataConflict && <div className="container"><div className="product-data-conflict" role="alert"><b>Характеристики требуют проверки</b><p>Название и числовые параметры выбранного товара противоречат друг другу в исходном каталоге. До подтверждения поставщиком страница исключена из поискового индекса и товарной разметки; менеджер проверит точное исполнение перед КП.</p></div></div>}

    <section className="feed-conversion-main"><div className="container feed-conversion-layout">
      <FeedProductGallery images={images} title={product.title} exactVariantImage={hasExactVariantImage} selectedVariantLabel={primaryChoice?.label} />
      <div className="feed-conversion-summary"><p className="product-code">{product.brand}{primaryChoice ? ` · ${primaryChoice.label}` : ""}{primaryVariant?.sku ? ` · Артикул ${primaryVariant.sku}` : ""}</p><h1>{product.title}</h1><p className="feed-conversion-intro">{descriptionParagraphs[0] ?? "Параметры товара получены из фактического каталога поставщика. Точное исполнение, комплектацию и срок поставки подтвердит менеджер."}</p><SocialShareButton path={sharePath} title={product.title} /><div className="feed-product-buying-route" aria-label={pageArchetype.routeTitle}><div><span>{pageArchetype.badge}</span><b>{pageArchetype.routeTitle}</b><small>{pageArchetype.routeLead}</small></div><ol>{expertProfile.criteria.slice(0, 3).map((criterion: { title: string }, index: number) => <li key={criterion.title}><span>0{index + 1}</span>{criterion.title}</li>)}</ol><a href="#decision">Как проверить →</a></div><div id="variants" className="feed-variant-card--selected"><FeedProductPurchase productId={product.id} productSlug={product.slug} productTitle={product.title} productBrand={product.brand} categorySlug={product.category} variants={initialPurchaseVariants} totalVariantCount={initialPurchasePage.totalVariantCount} availableVariantCount={initialPurchasePage.availableVariantCount} initialNextOffset={initialPurchasePage.nextOffset} variantsEndpoint={variantsEndpoint} selectedVariantId={primaryVariant?.id} hasComparableAlternatives={alternatives.length > 0} /></div><ManagerContactCard compact placement="product_manager" productId={product.id} /></div>
    </div></section>

    <nav className="product-jumpnav feed-conversion-jumpnav" aria-label="Разделы карточки"><div className="container"><a href="#decision">Подходит ли вам</a><a href="#specs">Характеристики</a><a href="#supply">Комплектация и документы</a><a href="#recommendations">{pageArchetype.recommendationJumpLabel}</a></div></nav>

    <section className="section feed-decision-section" id="decision"><div className="container"><div className="section-heading"><div><p className="eyebrow">{pageArchetype.decisionEyebrow}</p><h2>{pageArchetype.decisionTitle}</h2></div><p>{pageArchetype.decisionIntro}</p></div><div className="feed-decision-grid">{keySpecs.slice(0, 3).map((spec, index) => <article key={spec.label}><span>0{index + 1}</span><div><small>{spec.label}</small><b>{spec.value}</b><p>{decisionCopy(spec.label, pageArchetype.decisionFallback)}</p></div></article>)}<aside><span>{pageArchetype.engineerEyebrow}</span><h3>{expertProfile.criteriaTitle}</h3><p>{expertProfile.criteriaIntro}</p><ContactRequestDialog categoryTitle={selectedProductContext} buttonLabel={pageArchetype.fitAction} /></aside></div>{(descriptionParagraphs.length > 0 || drillDescription) && <div className="feed-product-description"><span>Описание и применение</span><h3>Что подтверждено по этому товару</h3>{descriptionParagraphs.map((paragraph) => <p className="feed-product-description-lead" key={paragraph}>{paragraph}</p>)}{drillDescription && <div className="feed-product-description-grid"><article><b>Рабочий диапазон</b><p>{drillDescription.application}</p></article><article><b>Особенности исполнения</b><p>{drillDescription.configuration}</p></article><article><b>Перед заказом уточним</b><p>Материал и толщину детали, глубину отверстия, условия установки магнита, состав комплектации и необходимые документы.</p></article></div>}<small>Описание составлено по текущему товарному фиду. Отсутствующие параметры не дополнены предположениями.</small></div>}</div></section>

    <section className="section section-muted feed-specification-section" id="specs"><div className="container feed-specification-layout"><div><p className="eyebrow">Фактические характеристики</p><h2>{primaryChoice ? `Характеристики ${primaryChoice.label}` : "Выбранное исполнение"}</h2><dl className="spec-table feed-conversion-spec-table">{fullSpecs.map((parameter) => <div key={`${parameter.name}-${parameter.value}`}><dt>{getFeedParameterLabel(product, parameter.name)}</dt><dd>{formatParameter(parameter)}</dd></div>)}</dl><small className="feed-spec-source">Источник — текущий снимок товарного фида. Если параметр отсутствует, мы не дополняем его предположением.</small></div><aside className="feed-spec-checklist"><span>Перед выставлением счёта</span><h3>Что проверит инженер</h3><ol>{expertProfile.criteria.slice(0, 4).map((criterion: { title: string }) => <li key={criterion.title}>{criterion.title}</li>)}</ol><ContactRequestDialog categoryTitle={selectedProductContext} buttonLabel="Передать параметры" /></aside></div></section>

    <section className="section feed-supply-section" id="supply"><div className="container"><div className="section-heading"><div><p className="eyebrow">Без неподтверждённых обещаний</p><h2>{pageArchetype.supplyTitle}</h2></div><p>{pageArchetype.supplyIntro}</p></div><div className="feed-supply-grid"><article><span>01</span><b>Точный артикул и цена</b><p>{primaryVariant?.sku ?? "Исполнение"} · {primaryPrice} · с НДС по данным поставщика.</p><strong>Есть в фиде</strong></article><article><span>02</span><b>Состав комплектации</b><p>Перечень принадлежностей запросим у поставщика и включим в КП.</p><strong>Требует подтверждения</strong></article><article><span>03</span><b>Паспорт и сертификаты</b><p>Файлы не подключены к текущему товарному фиду.</p><strong>Требует подтверждения</strong></article><article><span>04</span><b>Остаток и отгрузка</b><p>{primaryShipping.detail}.</p><strong>{primaryShipping.label}</strong></article></div><div className="feed-supply-action"><div><b>Нужны документы до оформления?</b><p>Оставьте телефон — менеджер уточнит конкретный документ и свяжет запрос с этим артикулом.</p></div><ContactRequestDialog categoryTitle={`${selectedProductContext}: комплектация и документы`} buttonLabel="Запросить документы" /></div></div></section>

    {primaryVariant && <ProductRecommendationSystem product={product} variant={primaryVariant} selectedProductContext={selectedProductContext} criteria={expertProfile.criteria} alternatives={alternatives} pageArchetype={pageArchetype} />}

    <section className="request-section" id="request"><div className="container request-grid"><div><p className="eyebrow">Финальный шаг без повторного ввода</p><h2>{pageArchetype.finalTitle}</h2><p>{pageArchetype.finalCopy}</p><Link href={publicCategoryPath(product.category)}>← Вернуться к категории</Link></div><div className="request-unified-demo"><span>Единый запрос КП</span><b>{pageArchetype.savedContextLabel}</b><p>Откройте черновик, проверьте количество и добавьте требования к поставке.</p><RequestCartButton /></div></div></section>
  </main><PilotFooter />{primaryVariant && <nav className="product-mobile-buybar" aria-label="Быстрый запрос по товару"><div><span className={primaryShipping.available ? "is-available" : undefined}>{primaryShipping.label}</span><b>{primaryPrice}</b></div><AddRequestButton openWhenAdded item={{ id:`variant:${primaryVariant.id}`, title:primaryVariant.name || product.title, article:variantArticle(primaryVariant), price:primaryPrice, image:primaryVariant.images?.[0] ?? getFeedProductImage(product), href:publicProductPath(product, primaryVariant), shippingLabel:primaryShipping.label, shippingDetail:primaryShipping.detail }}>Добавить в КП</AddRequestButton></nav>}</div>;
}

function formatParameter(parameter: FeedParameter): string { return `${parameter.value}${parameter.unit ? ` ${parameter.unit}` : ""}`; }
function findParameter(variant: FeedVariant | undefined, keyword: string): string { const parameter = variant?.params.find((item) => item.name.toLocaleLowerCase("ru-RU").includes(keyword.toLocaleLowerCase("ru-RU"))); return parameter ? formatParameter(parameter) : ""; }
function decisionCopy(label: string, fallback: string): string { const normalized = label.toLocaleLowerCase("ru-RU"); if (normalized.includes("корончат")) return "Предельный диаметр корончатого сверления — основной рабочий диапазон магнитного станка."; if (normalized.includes("спиральн")) return "Предельный диаметр спирального сверла указан отдельно и не заменяет диапазон корончатого сверления."; if (normalized.includes("диаметр")) return "Рабочий размер выбранного исполнения — сопоставьте его с требуемым отверстием или заготовкой."; if (normalized.includes("хвостовик") || normalized.includes("шпиндель")) return "По этому присоединению проверяется совместимость оборудования и оснастки."; if (normalized.includes("материал")) return "Сверьте материал инструмента или область применения с вашей заготовкой."; if (normalized.includes("ход") || normalized.includes("длина")) return "Сопоставьте рабочую длину с глубиной обработки и доступным пространством."; if (normalized.includes("масса")) return "Учитывайте массу при переноске и работе на металлоконструкции."; return fallback; }
function buildDrillDescription(variant: FeedVariant): { application: string; configuration: string } {
  const coreDiameter = findParameter(variant, "макс. диаметр корончатого");
  const holeDiameter = findParameter(variant, "макс. диаметр отверстия");
  const spindle = findParameter(variant, "шпиндель");
  const workingStroke = findParameter(variant, "рабочий ход");
  const mass = findParameter(variant, "масса");
  const reverse = findParameter(variant, "реверс");
  const rotatingBase = findParameter(variant, "поворотное основание");
  const application = [coreDiameter && `Корончатое сверление — до Ø${coreDiameter}.`, holeDiameter && `Спиральное сверление — до Ø${holeDiameter}.`, spindle && `Присоединение оснастки — ${spindle}.`].filter(Boolean).join(" ");
  const configuration = [workingStroke && `Рабочий ход — ${workingStroke}.`, mass && `Масса исполнения — ${mass}.`, reverse && `Реверс: ${reverse.toLocaleLowerCase("ru-RU")}.`, rotatingBase && `Поворотное основание: ${rotatingBase.toLocaleLowerCase("ru-RU")}.`].filter(Boolean).join(" ");
  return { application, configuration };
}
function variantArticle(variant: FeedVariant): string { return variant.sku ? `Артикул ${variant.sku}` : "Артикул не указан в фиде"; }
