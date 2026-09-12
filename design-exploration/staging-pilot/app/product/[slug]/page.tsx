import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Breadcrumbs } from "../../ui/Breadcrumbs";
import { ContactRequestDialog } from "../../ui/ContactRequestDialog";
import { FeedAvailability } from "../../ui/FeedAvailability";
import { FeedProductGallery } from "../../ui/FeedProductGallery";
import { FeedProductPurchase } from "../../ui/FeedProductPurchase";
import { ManagerContactCard } from "../../ui/ManagerContactCard";
import { PilotFooter } from "../../ui/PilotFooter";
import { PilotHeader } from "../../ui/PilotHeader";
import { AddRequestButton, RequestCartButton } from "../../ui/RequestCart";
import { formatFeedPrice, getFeedAccessoryRecommendations, getFeedCategory, getFeedProductAlternatives, getFeedProductBySlug, getFeedProductImage, getFeedProductPriceLabel, type FeedParameter, type FeedVariant } from "../../data/feedCatalog";
import { getProductionSubcategory } from "../../data/productionCategoryGroups";

type RouteProps = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { slug } = await params;
  const product = getFeedProductBySlug(slug);
  return {
    title: product ? `${product.title} — тестовый каталог 7TOOL` : "Товар — 7TOOL",
    description: product ? `${product.title}. Характеристики из каталога поставщика; цену, наличие и срок подтверждаем в КП.` : undefined,
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
  const selectedVariantId = typeof rawSearchParams.variant === "string" ? rawSearchParams.variant : "";
  const allVariants = product.variants.filter((variant) => variant.name || variant.sku);
  const primaryVariant = allVariants.find((variant) => variant.id === selectedVariantId) ?? allVariants[0];
  const variants = (primaryVariant ? [primaryVariant, ...allVariants.filter((variant) => variant.id !== primaryVariant.id)] : allVariants).slice(0, 12);
  const images = Array.from(new Set([...(primaryVariant?.images ?? []), ...product.images].filter(Boolean)));
  const accessories = product.category === "stanki-sverlilnye" ? getFeedAccessoryRecommendations(product, 3) : [];
  const alternatives = product.category === "stanki-sverlilnye" ? getFeedProductAlternatives(product, 3) : [];
  const keySpecs = primaryVariant ? pickKeySpecs(primaryVariant) : [];
  const fullSpecs = primaryVariant?.params.filter((parameter) => !/^(бренд|производитель)$/i.test(parameter.name)) ?? [];
  const descriptionParagraphs = product.description?.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter((paragraph) => paragraph.length >= 60 && !paragraph.endsWith("?")).slice(0, 2) ?? [];
  const drillDescription = product.category === "stanki-sverlilnye" && primaryVariant ? buildDrillDescription(primaryVariant) : null;
  const purchaseVariants = variants.map((variant) => ({ id:variant.id, sku:variant.sku, title:variant.name || product.title, price:formatFeedPrice(variant.price) ?? "Цена по запросу", available:isConfirmedAvailable(variant), keySpecs:pickKeySpecs(variant), image:variant.images[0] ?? getFeedProductImage(product), href:`/product/${product.slug}?variant=${encodeURIComponent(variant.id)}` }));
  const primaryPrice = formatFeedPrice(primaryVariant?.price) ?? getFeedProductPriceLabel(product);

  return <div className="site-shell"><PilotHeader /><main className="inner-page feed-product-conversion-page">
    <div className="container"><Breadcrumbs items={[{ label:"Главная", href:"/" }, { label:"Каталог", href:"/catalog" }, ...(productionEntry ? [{ label:productionEntry.group.title, href:productionEntry.group.href }] : []), { label:category?.title ?? product.category, href:`/catalog/category/${product.category}` }, { label:product.brand }]} /></div>

    <section className="feed-conversion-main"><div className="container feed-conversion-layout">
      <FeedProductGallery images={images} title={product.title} />
      <div className="feed-conversion-summary"><p className="product-code">{product.brand}{primaryVariant?.sku ? ` · Артикул ${primaryVariant.sku}` : ""}</p><h1>{product.title}</h1><p className="feed-conversion-intro">{descriptionParagraphs[0] ?? "Параметры товара получены из фактического каталога поставщика. Точное исполнение, комплектацию и срок поставки подтвердит менеджер."}</p><div id="variants" className="feed-variant-card--selected"><FeedProductPurchase productId={product.id} productTitle={product.title} variants={purchaseVariants} selectedVariantId={primaryVariant?.id} /></div><ManagerContactCard compact placement="product_manager" productId={product.id} /></div>
    </div></section>

    <nav className="product-jumpnav feed-conversion-jumpnav" aria-label="Разделы карточки"><div className="container"><a href="#decision">Подходит ли вам</a><a href="#specs">Характеристики</a><a href="#supply">Комплектация и документы</a>{accessories.length > 0 && <a href="#accessories">Оснастка</a>}{alternatives.length > 0 && <a href="#alternatives">Альтернативы</a>}</div></nav>

    <section className="section feed-decision-section" id="decision"><div className="container"><div className="section-heading"><div><p className="eyebrow">Сначала решение, затем детали</p><h2>Когда стоит рассматривать эту модель</h2></div><p>Вывод построен только по названию и характеристикам выбранного исполнения. Финальную применимость подтверждаем по вашей детали и режиму работы.</p></div><div className="feed-decision-grid">{keySpecs.slice(0, 3).map((spec, index) => <article key={spec.label}><span>0{index + 1}</span><div><b>{spec.value}</b><p>{decisionCopy(spec.label)}</p></div></article>)}<aside><span>Нужна инженерная проверка</span><h3>Сообщите материал, толщину и глубину отверстия</h3><p>Этих данных нет в карточке — без них нельзя надёжно подтвердить режим сверления и подобрать корончатое сверло.</p><ContactRequestDialog categoryTitle={product.title} buttonLabel="Проверить под мою задачу" /></aside></div>{(descriptionParagraphs.length > 0 || drillDescription) && <div className="feed-product-description"><span>Описание и применение</span><h3>Что подтверждено по этой модели</h3>{descriptionParagraphs.map((paragraph) => <p className="feed-product-description-lead" key={paragraph}>{paragraph}</p>)}{drillDescription && <div className="feed-product-description-grid"><article><b>Рабочий диапазон</b><p>{drillDescription.application}</p></article><article><b>Особенности исполнения</b><p>{drillDescription.configuration}</p></article><article><b>Перед заказом уточним</b><p>Материал и толщину детали, глубину отверстия, условия установки магнита, состав комплектации и необходимые документы.</p></article></div>}<small>Описание составлено по текущему товарному фиду. Отсутствующие параметры не дополнены предположениями.</small></div>}</div></section>

    <section className="section section-muted feed-specification-section" id="specs"><div className="container feed-specification-layout"><div><p className="eyebrow">Фактические характеристики</p><h2>{primaryVariant?.sku ? `Исполнение ${primaryVariant.sku}` : "Выбранное исполнение"}</h2><dl className="spec-table feed-conversion-spec-table">{fullSpecs.map((parameter) => <div key={`${parameter.name}-${parameter.value}`}><dt>{parameter.name}</dt><dd>{formatParameter(parameter)}</dd></div>)}</dl><small className="feed-spec-source">Источник — текущий снимок товарного фида. Если параметр отсутствует, мы не дополняем его предположением.</small></div><aside className="feed-spec-checklist"><span>Перед выставлением счёта</span><h3>Что проверит инженер</h3><ol><li>Диаметр, глубину и материал детали</li><li>Тип корончатого или спирального сверла</li><li>Поверхность и условия установки магнита</li><li>Комплектацию, остаток и дату отгрузки</li></ol><ContactRequestDialog categoryTitle={product.title} buttonLabel="Передать параметры" /></aside></div></section>

    <section className="section feed-supply-section" id="supply"><div className="container"><div className="section-heading"><div><p className="eyebrow">Без неподтверждённых обещаний</p><h2>Комплектация и документы</h2></div><p>В фиде нет состава поставки и файлов документов. Поэтому карточка показывает статус данных, а не выдуманный список.</p></div><div className="feed-supply-grid"><article><span>01</span><b>Точный артикул и цена</b><p>{primaryVariant?.sku ?? "Исполнение"} · {primaryPrice} · с НДС по данным поставщика.</p><strong>Есть в фиде</strong></article><article><span>02</span><b>Состав комплектации</b><p>Перечень принадлежностей запросим у поставщика и включим в КП.</p><strong>Требует подтверждения</strong></article><article><span>03</span><b>Паспорт и сертификаты</b><p>Файлы не подключены к текущему товарному фиду.</p><strong>Требует подтверждения</strong></article><article><span>04</span><b>Остаток и отгрузка</b><p>Статус фида проверим повторно перед оплатой и укажем дату в КП.</p><strong>Проверяем перед счётом</strong></article></div><div className="feed-supply-action"><div><b>Нужны документы до оформления?</b><p>Оставьте телефон — менеджер уточнит конкретный документ и свяжет запрос с этим артикулом.</p></div><ContactRequestDialog categoryTitle={`${product.title}: комплектация и документы`} buttonLabel="Запросить документы" /></div></div></section>

    {accessories.length > 0 && <section className="section section-muted feed-accessories-section" id="accessories"><div className="container"><div className="section-heading"><div><p className="eyebrow">Следующий товар в одной закупке</p><h2>Корончатые свёрла для предварительного подбора</h2></div><p>Отобраны реальные исполнения в наличии с хвостовиком, совпадающим с {findParameter(primaryVariant, "шпиндель") || "выбранным шпинделем"}, и диаметром в рабочем диапазоне станка.</p></div><div className="feed-accessory-grid">{accessories.map(({ product:accessory, variant, diameter, spindle, workingLength }) => { const accessoryPrice = formatFeedPrice(variant.price) ?? "Цена по запросу"; const accessoryHref = `/product/${accessory.slug}?variant=${encodeURIComponent(variant.id)}`; return <article key={variant.id}><Link className="feed-accessory-media" href={accessoryHref}><Image src={getFeedProductImage(accessory) ?? ""} alt={variant.name || accessory.title} width={180} height={150} unoptimized /></Link><div><span>Предварительно подходит по хвостовику и диаметру</span><h3><Link href={accessoryHref}>{variant.name || accessory.title}</Link></h3><p>Ø{diameter} мм · {spindle}{workingLength ? ` · рабочая длина ${workingLength}` : ""}</p><div><b>{accessoryPrice}</b><FeedAvailability available={isConfirmedAvailable(variant)} exact /></div><AddRequestButton item={{ id:`variant:${variant.id}`, title:variant.name || accessory.title, article:`Артикул ${variant.sku}`, price:accessoryPrice, image:getFeedProductImage(accessory), href:accessoryHref }}>Добавить в КП</AddRequestButton></div></article>; })}</div><p className="feed-accessory-disclaimer"><b>Важно:</b> совпадение хвостовика и диаметра — первый этап проверки. Рабочую длину, материал сверла и режим резания нужно подтвердить под вашу задачу.</p></div></section>}

    {alternatives.length > 0 && <section className="section feed-alternatives-section" id="alternatives"><div className="container"><div className="section-heading"><div><p className="eyebrow">Осознанная альтернатива</p><h2>Сравните, не возвращаясь в категорию</h2></div><p>Показаны реальные магнитные модели с близким шпинделем: ниже цена, наличие реверса или больший рабочий диаметр.</p></div><div className="feed-alternative-grid">{alternatives.map(({ product:alternative, variant, diameter, spindle, reverse, mass, reason }) => <article key={alternative.id}><Link href={`/product/${alternative.slug}`}><Image src={getFeedProductImage(alternative) ?? ""} alt={alternative.title} width={210} height={180} unoptimized /></Link><div><span>{reason}</span><h3><Link href={`/product/${alternative.slug}`}>{alternative.title}</Link></h3><dl><div><dt>Корончатое сверло</dt><dd>до Ø{diameter} мм</dd></div><div><dt>Шпиндель</dt><dd>{spindle || "—"}</dd></div><div><dt>Реверс</dt><dd>{reverse || "—"}</dd></div><div><dt>Масса</dt><dd>{mass || "—"}</dd></div></dl><div className="feed-alternative-commercial"><b>{getFeedProductPriceLabel(alternative)}</b><FeedAvailability available={isConfirmedAvailable(variant)} /></div><Link className="feed-alternative-link" href={`/product/${alternative.slug}`}>Открыть модель →</Link></div></article>)}</div></div></section>}

    <section className="request-section" id="request"><div className="container request-grid"><div><p className="eyebrow">Финальный шаг без повторного ввода</p><h2>Соберите станок и оснастку в одном запросе</h2><p>Точные артикулы и количество сохраняются в черновике КП. Менеджер добавит подтверждённый срок, комплектацию и документы.</p><Link href={`/catalog/category/${product.category}`}>← Вернуться к категории</Link></div><div className="request-unified-demo"><span>Единый запрос КП</span><b>Контекст товара уже сохранён</b><p>Откройте черновик, проверьте количество и добавьте требования к поставке.</p><RequestCartButton /></div></div></section>
  </main><PilotFooter />{primaryVariant && <nav className="product-mobile-buybar" aria-label="Быстрый запрос по товару"><div><span>{isConfirmedAvailable(primaryVariant) ? "В наличии по данным фида" : "Статус уточняется"}</span><b>{primaryPrice}</b></div><AddRequestButton item={{ id:`variant:${primaryVariant.id}`, title:primaryVariant.name || product.title, article:`Артикул ${primaryVariant.sku}`, price:primaryPrice, image:primaryVariant.images[0] ?? getFeedProductImage(product), href:`/product/${product.slug}?variant=${encodeURIComponent(primaryVariant.id)}` }}>Добавить в КП</AddRequestButton></nav>}</div>;
}

function formatParameter(parameter: FeedParameter): string { return `${parameter.value}${parameter.unit ? ` ${parameter.unit}` : ""}`; }
function findParameter(variant: FeedVariant | undefined, keyword: string): string { const parameter = variant?.params.find((item) => item.name.toLocaleLowerCase("ru-RU").includes(keyword.toLocaleLowerCase("ru-RU"))); return parameter ? formatParameter(parameter) : ""; }
function pickKeySpecs(variant: FeedVariant): Array<{ label: string; value: string }> { const priorities = ["макс. диаметр корончатого", "шпиндель", "рабочий ход", "масса", "реверс"]; return priorities.flatMap((keyword) => { const parameter = variant.params.find((item) => item.name.toLocaleLowerCase("ru-RU").includes(keyword)); return parameter ? [{ label:parameter.name, value:formatParameter(parameter) }] : []; }).slice(0, 4); }
function decisionCopy(label: string): string { const normalized = label.toLocaleLowerCase("ru-RU"); if (normalized.includes("диаметр")) return "Предельный размер корончатого сверла по данным выбранного исполнения."; if (normalized.includes("шпиндель")) return "Именно по этому присоединению предварительно отобрана оснастка ниже."; if (normalized.includes("ход")) return "Сопоставьте ход с требуемой глубиной и доступным пространством над деталью."; if (normalized.includes("масса")) return "Учитывайте массу при переноске и работе на металлоконструкции."; return "Параметр выбранного исполнения из текущего товарного фида."; }
function buildDrillDescription(variant: FeedVariant): { application: string; configuration: string } {
  const coreDiameter = findParameter(variant, "макс. диаметр корончатого");
  const holeDiameter = findParameter(variant, "макс. диаметр отверстия");
  const spindle = findParameter(variant, "шпиндель");
  const workingStroke = findParameter(variant, "рабочий ход");
  const mass = findParameter(variant, "масса");
  const reverse = findParameter(variant, "реверс");
  const rotatingBase = findParameter(variant, "поворотное основание");
  const application = [coreDiameter && `Корончатое сверление — до Ø${coreDiameter}.`, holeDiameter && `Максимальный диаметр отверстия — ${holeDiameter}.`, spindle && `Присоединение оснастки — ${spindle}.`].filter(Boolean).join(" ");
  const configuration = [workingStroke && `Рабочий ход — ${workingStroke}.`, mass && `Масса исполнения — ${mass}.`, reverse && `Реверс: ${reverse.toLocaleLowerCase("ru-RU")}.`, rotatingBase && `Поворотное основание: ${rotatingBase.toLocaleLowerCase("ru-RU")}.`].filter(Boolean).join(" ");
  return { application, configuration };
}
function isConfirmedAvailable(variant: FeedVariant): boolean { return variant.available && typeof variant.quantity === "number" && variant.quantity > 0; }
