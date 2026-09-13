import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "../../ui/Breadcrumbs";
import { ContactRequestDialog } from "../../ui/ContactRequestDialog";
import { FeedProductGallery } from "../../ui/FeedProductGallery";
import { FeedProductPurchase } from "../../ui/FeedProductPurchase";
import { ManagerContactCard } from "../../ui/ManagerContactCard";
import { PilotFooter } from "../../ui/PilotFooter";
import { PilotHeader } from "../../ui/PilotHeader";
import { ProductRecommendationSystem } from "../../ui/ProductRecommendationSystem";
import { AddRequestButton, RequestCartButton } from "../../ui/RequestCart";
import { formatFeedPrice, getFeedCategory, getFeedParameterLabel, getFeedProductAlternatives, getFeedProductBySlug, getFeedProductImage, getFeedProductPriceLabel, getFeedVariantSpecs, type FeedParameter, type FeedVariant } from "../../data/feedCatalog";
import { getProductionSubcategory } from "../../data/productionCategoryGroups";
import { getCategoryExpertProfile } from "../../data/categoryExpertProfiles.mjs";
import { getProductVariantChoices, getVariantChoicePresentation, sortVariantsForChoice } from "../../data/variantPresentation";

type RouteProps = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params, searchParams }: RouteProps): Promise<Metadata> {
  const { slug } = await params;
  const rawSearchParams = await searchParams;
  const product = getFeedProductBySlug(slug);
  const selectedVariantId = typeof rawSearchParams.variant === "string" ? rawSearchParams.variant : "";
  const selectedVariant = product?.variants.find((variant) => variant.id === selectedVariantId);
  const selectedChoice = product && selectedVariant ? getVariantChoicePresentation(product, selectedVariant) : undefined;
  return {
    title: product ? `${product.title}${selectedChoice ? `, ${selectedChoice.label}` : ""} — тестовый каталог 7TOOL` : "Товар — 7TOOL",
    description: product ? `${product.title}${selectedChoice ? `, ${selectedChoice.label}` : ""}. Характеристики из каталога поставщика; цену, наличие и срок подтверждаем в КП.` : undefined,
    robots: { index:false, follow:false },
  };
}

export default async function FeedProductPage({ params, searchParams }: RouteProps) {
  const { slug } = await params;
  const rawSearchParams = await searchParams;
  const product = getFeedProductBySlug(slug);
  if (!product) return <div className="site-shell"><PilotHeader /><main className="inner-page"><section className="section"><div className="container empty-result"><b>Товар не найден в тестовом каталоге</b><p>Вернитесь в каталог или опишите задачу менеджеру.</p><Link href="/catalog">Открыть каталог →</Link></div></section></main><PilotFooter /></div>;

  const category = getFeedCategory(product.category);
  const productionEntry = getProductionSubcategory(product.category);
  const expertProfile = getCategoryExpertProfile(product.category);
  const selectedVariantId = typeof rawSearchParams.variant === "string" ? rawSearchParams.variant : "";
  const allVariants = sortVariantsForChoice(product, product.variants.filter((variant) => variant.name || variant.sku));
  const primaryVariant = allVariants.find((variant) => variant.id === selectedVariantId) ?? allVariants[0];
  const images = Array.from(new Set([...(primaryVariant?.images ?? []), ...product.images].filter(Boolean)));
  const keySpecs = primaryVariant ? getFeedVariantSpecs(product, primaryVariant).slice(0, 4) : [];
  const fullSpecs = primaryVariant?.params.filter((parameter) => !/^(бренд|производитель)$/i.test(parameter.name)) ?? [];
  const descriptionParagraphs = product.description?.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter((paragraph) => paragraph.length >= 60 && !paragraph.endsWith("?")).slice(0, 2) ?? [];
  const drillDescription = product.category === "stanki-sverlilnye" && primaryVariant ? buildDrillDescription(primaryVariant) : null;
  const allPurchaseVariants = getProductVariantChoices(product);
  const selectedPurchaseVariant = allPurchaseVariants.find((variant) => variant.id === primaryVariant?.id);
  const purchaseVariants = allPurchaseVariants.length > 12
    ? Array.from(new Map([...(selectedPurchaseVariant ? [selectedPurchaseVariant] : []), ...allPurchaseVariants.slice(0, 12)].map((variant) => [variant.id, variant])).values()).slice(0, 12)
    : allPurchaseVariants;
  const primaryPrice = formatFeedPrice(primaryVariant?.price) ?? getFeedProductPriceLabel(product);
  const primaryChoice = primaryVariant ? getVariantChoicePresentation(product, primaryVariant) : undefined;
  const selectedProductContext = [product.title, primaryChoice?.label, primaryVariant?.sku ? `артикул ${primaryVariant.sku}` : ""].filter(Boolean).join(", ");
  const alternatives = primaryVariant ? getFeedProductAlternatives(product, primaryVariant, 3) : [];

  return <div className="site-shell"><PilotHeader /><main className="inner-page feed-product-conversion-page">
    <div className="container"><Breadcrumbs items={[{ label:"Главная", href:"/" }, { label:"Каталог", href:"/catalog" }, ...(productionEntry ? [{ label:productionEntry.group.title, href:productionEntry.group.href }] : []), { label:category?.title ?? product.category, href:`/catalog/category/${product.category}` }, { label:product.brand }]} /></div>

    <section className="feed-conversion-main"><div className="container feed-conversion-layout">
      <FeedProductGallery images={images} title={product.title} />
      <div className="feed-conversion-summary"><p className="product-code">{product.brand}{primaryChoice ? ` · ${primaryChoice.label}` : ""}{primaryVariant?.sku ? ` · Артикул ${primaryVariant.sku}` : ""}</p><h1>{product.title}</h1><p className="feed-conversion-intro">{descriptionParagraphs[0] ?? "Параметры товара получены из фактического каталога поставщика. Точное исполнение, комплектацию и срок поставки подтвердит менеджер."}</p><div id="variants" className="feed-variant-card--selected"><FeedProductPurchase productId={product.id} productTitle={product.title} variants={purchaseVariants} totalVariantCount={allPurchaseVariants.length} variantsEndpoint={`/api/catalog-product-variants?product=${encodeURIComponent(product.slug)}`} selectedVariantId={primaryVariant?.id} hasComparableAlternatives={alternatives.length > 0} /></div><ManagerContactCard compact placement="product_manager" productId={product.id} /></div>
    </div></section>

    <nav className="product-jumpnav feed-conversion-jumpnav" aria-label="Разделы карточки"><div className="container"><a href="#decision">Подходит ли вам</a><a href="#specs">Характеристики</a><a href="#supply">Комплектация и документы</a><a href="#recommendations">Комплект и замены</a></div></nav>

    <section className="section feed-decision-section" id="decision"><div className="container"><div className="section-heading"><div><p className="eyebrow">Сначала решение, затем детали</p><h2>Когда стоит рассматривать это исполнение</h2></div><p>Вывод построен только по названию и характеристикам выбранного исполнения. Финальную применимость подтверждаем по вашей детали и режиму работы.</p></div><div className="feed-decision-grid">{keySpecs.slice(0, 3).map((spec, index) => <article key={spec.label}><span>0{index + 1}</span><div><b>{spec.value}</b><p>{decisionCopy(spec.label)}</p></div></article>)}<aside><span>Нужна инженерная проверка</span><h3>{expertProfile.criteriaTitle}</h3><p>{expertProfile.criteriaIntro}</p><ContactRequestDialog categoryTitle={selectedProductContext} buttonLabel="Проверить под мою задачу" /></aside></div>{(descriptionParagraphs.length > 0 || drillDescription) && <div className="feed-product-description"><span>Описание и применение</span><h3>Что подтверждено по этой модели</h3>{descriptionParagraphs.map((paragraph) => <p className="feed-product-description-lead" key={paragraph}>{paragraph}</p>)}{drillDescription && <div className="feed-product-description-grid"><article><b>Рабочий диапазон</b><p>{drillDescription.application}</p></article><article><b>Особенности исполнения</b><p>{drillDescription.configuration}</p></article><article><b>Перед заказом уточним</b><p>Материал и толщину детали, глубину отверстия, условия установки магнита, состав комплектации и необходимые документы.</p></article></div>}<small>Описание составлено по текущему товарному фиду. Отсутствующие параметры не дополнены предположениями.</small></div>}</div></section>

    <section className="section section-muted feed-specification-section" id="specs"><div className="container feed-specification-layout"><div><p className="eyebrow">Фактические характеристики</p><h2>{primaryChoice ? `Характеристики ${primaryChoice.label}` : "Выбранное исполнение"}</h2><dl className="spec-table feed-conversion-spec-table">{fullSpecs.map((parameter) => <div key={`${parameter.name}-${parameter.value}`}><dt>{getFeedParameterLabel(product, parameter.name)}</dt><dd>{formatParameter(parameter)}</dd></div>)}</dl><small className="feed-spec-source">Источник — текущий снимок товарного фида. Если параметр отсутствует, мы не дополняем его предположением.</small></div><aside className="feed-spec-checklist"><span>Перед выставлением счёта</span><h3>Что проверит инженер</h3><ol>{expertProfile.criteria.slice(0, 4).map((criterion: { title: string }) => <li key={criterion.title}>{criterion.title}</li>)}</ol><ContactRequestDialog categoryTitle={selectedProductContext} buttonLabel="Передать параметры" /></aside></div></section>

    <section className="section feed-supply-section" id="supply"><div className="container"><div className="section-heading"><div><p className="eyebrow">Без неподтверждённых обещаний</p><h2>Комплектация и документы</h2></div><p>В фиде нет состава поставки и файлов документов. Поэтому карточка показывает статус данных, а не выдуманный список.</p></div><div className="feed-supply-grid"><article><span>01</span><b>Точный артикул и цена</b><p>{primaryVariant?.sku ?? "Исполнение"} · {primaryPrice} · с НДС по данным поставщика.</p><strong>Есть в фиде</strong></article><article><span>02</span><b>Состав комплектации</b><p>Перечень принадлежностей запросим у поставщика и включим в КП.</p><strong>Требует подтверждения</strong></article><article><span>03</span><b>Паспорт и сертификаты</b><p>Файлы не подключены к текущему товарному фиду.</p><strong>Требует подтверждения</strong></article><article><span>04</span><b>Остаток и отгрузка</b><p>Статус фида проверим повторно перед оплатой и укажем дату в КП.</p><strong>Проверяем перед счётом</strong></article></div><div className="feed-supply-action"><div><b>Нужны документы до оформления?</b><p>Оставьте телефон — менеджер уточнит конкретный документ и свяжет запрос с этим артикулом.</p></div><ContactRequestDialog categoryTitle={`${selectedProductContext}: комплектация и документы`} buttonLabel="Запросить документы" /></div></div></section>

    {primaryVariant && <ProductRecommendationSystem product={product} variant={primaryVariant} selectedProductContext={selectedProductContext} criteria={expertProfile.criteria} alternatives={alternatives} />}

    <section className="request-section" id="request"><div className="container request-grid"><div><p className="eyebrow">Финальный шаг без повторного ввода</p><h2>Соберите выбранные позиции в одном запросе</h2><p>Точные артикулы и количество сохраняются в черновике КП. Менеджер добавит подтверждённый срок, комплектацию и документы.</p><Link href={`/catalog/category/${product.category}`}>← Вернуться к категории</Link></div><div className="request-unified-demo"><span>Единый запрос КП</span><b>Контекст товара уже сохранён</b><p>Откройте черновик, проверьте количество и добавьте требования к поставке.</p><RequestCartButton /></div></div></section>
  </main><PilotFooter />{primaryVariant && <nav className="product-mobile-buybar" aria-label="Быстрый запрос по товару"><div><span>{isConfirmedAvailable(primaryVariant) ? "В наличии по данным фида" : "Статус уточняется"}</span><b>{primaryPrice}</b></div><AddRequestButton item={{ id:`variant:${primaryVariant.id}`, title:primaryVariant.name || product.title, article:variantArticle(primaryVariant), price:primaryPrice, image:primaryVariant.images?.[0] ?? getFeedProductImage(product), href:`/product/${product.slug}?variant=${encodeURIComponent(primaryVariant.id)}` }}>Добавить в КП</AddRequestButton></nav>}</div>;
}

function formatParameter(parameter: FeedParameter): string { return `${parameter.value}${parameter.unit ? ` ${parameter.unit}` : ""}`; }
function findParameter(variant: FeedVariant | undefined, keyword: string): string { const parameter = variant?.params.find((item) => item.name.toLocaleLowerCase("ru-RU").includes(keyword.toLocaleLowerCase("ru-RU"))); return parameter ? formatParameter(parameter) : ""; }
function decisionCopy(label: string): string { const normalized = label.toLocaleLowerCase("ru-RU"); if (normalized.includes("корончат")) return "Предельный диаметр корончатого сверления — основной рабочий диапазон магнитного станка."; if (normalized.includes("спиральн")) return "Предельный диаметр спирального сверла указан отдельно и не заменяет диапазон корончатого сверления."; if (normalized.includes("диаметр")) return "Предельный рабочий размер по данным выбранного исполнения."; if (normalized.includes("шпиндель")) return "Именно по этому присоединению предварительно отобрана оснастка ниже."; if (normalized.includes("ход")) return "Сопоставьте ход с требуемой глубиной и доступным пространством над деталью."; if (normalized.includes("масса")) return "Учитывайте массу при переноске и работе на металлоконструкции."; return "Параметр выбранного исполнения из текущего товарного фида."; }
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
function isConfirmedAvailable(variant: FeedVariant): boolean { return variant.available && typeof variant.quantity === "number" && variant.quantity > 0; }
function variantArticle(variant: FeedVariant): string { return variant.sku ? `Артикул ${variant.sku}` : "Артикул не указан в фиде"; }
