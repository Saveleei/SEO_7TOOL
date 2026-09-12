import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Breadcrumbs } from "../../ui/Breadcrumbs";
import { ManagerContactCard } from "../../ui/ManagerContactCard";
import { PilotFooter } from "../../ui/PilotFooter";
import { PilotHeader } from "../../ui/PilotHeader";
import { AddRequestButton } from "../../ui/RequestCart";
import { formatFeedPrice, getFeedCategory, getFeedProductBySlug, getFeedProductImage, getFeedProductPriceLabel } from "../../data/feedCatalog";
import { getProductionSubcategory } from "../../data/productionCategoryGroups";

type RouteProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { slug } = await params;
  const product = getFeedProductBySlug(slug);
  return {
    title: product ? `${product.title} — тестовый каталог 7TOOL` : "Товар — 7TOOL",
    description: product ? `${product.title}. Характеристики из каталога поставщика; цену, наличие и срок подтверждаем в КП.` : undefined,
    robots: { index: false, follow: false },
  };
}

export default async function FeedProductPage({ params }: RouteProps) {
  const { slug } = await params;
  const product = getFeedProductBySlug(slug);
  if (!product) return <div className="site-shell"><PilotHeader /><main className="inner-page"><section className="section"><div className="container empty-result"><b>Товар не найден в тестовом каталоге</b><p>Вернитесь в каталог или опишите задачу менеджеру.</p><Link href="/catalog">Открыть каталог →</Link></div></section></main><PilotFooter /></div>;

  const category = getFeedCategory(product.category);
  const productionEntry = getProductionSubcategory(product.category);
  const image = getFeedProductImage(product);
  const price = getFeedProductPriceLabel(product);
  const variants = product.variants.filter((variant) => variant.name || variant.sku).slice(0, 12);
  const subject = encodeURIComponent(`Запрос по товару: ${product.title}`);

  return <div className="site-shell"><PilotHeader /><main className="inner-page feed-product-page">
    <div className="container"><Breadcrumbs items={[{ label:"Главная", href:"/" }, { label:"Каталог", href:"/catalog" }, ...(productionEntry ? [{ label:productionEntry.group.title, href:productionEntry.group.href }] : []), { label:category?.title ?? product.category, href:`/catalog/category/${product.category}` }, { label:product.brand }]} /></div>

    <section className="section feed-product-main"><div className="container feed-product-detail">
      <div className="feed-detail-gallery">{image ? <Image src={image} alt={product.title} width={720} height={620} priority unoptimized /> : <span>Изображение уточняется</span>}<small>Фото из каталога поставщика</small></div>
      <div className="feed-detail-summary">
        <p className="product-code">{product.brand}{product.sku ? ` · ${product.sku}` : ""}</p>
        <h1>{product.title}</h1>
        <div className="feed-detail-state"><span>Условия поставки</span><b>Наличие и срок подтверждаем в КП</b><p>Остаток из тестового снимка не показываем как обещание клиенту.</p></div>
        <div className="feed-detail-price"><b>{price}</b><span>с НДС · по тестовым данным поставщика</span></div>
        {product.paramAxes.length > 0 && <div className="feed-axis-list"><span>Выбор исполнения:</span>{product.paramAxes.slice(0, 6).map((axis) => <b key={axis}>{axis}</b>)}</div>}
        <div className="feed-detail-actions"><AddRequestButton item={{ id:product.id, title:product.title, article:product.sku ? `Артикул ${product.sku}` : "Товарная группа", price }}>Добавить в запрос КП</AddRequestButton><a href={`mailto:info@7tool.ru?subject=${subject}`}>Задать вопрос по товару</a></div>
        <p className="feed-detail-note">Точный артикул вводить не требуется: выберите исполнение ниже или просто добавьте товарную группу и опишите задачу в комментарии.</p>
      </div>
    </div></section>

    <section className="section section-muted"><div className="container feed-variant-layout"><div>
      <div className="section-heading"><div><p className="eyebrow">Доступные исполнения</p><h2>{product.variants.length > 1 ? "Выберите подходящий вариант" : "Данные исполнения"}</h2></div><p>Показано до 12 вариантов. Цена относится к конкретному исполнению; доступность подтверждаем отдельно.</p></div>
      <div className="feed-variant-list">{variants.map((variant) => {
        const variantPrice = formatFeedPrice(variant.price) ?? "Цена по запросу";
        const params = variant.params.filter((parameter) => parameter.name !== "Бренд").slice(0, 4);
        return <article key={variant.id}><div><span>{variant.sku || "Исполнение"}</span><b>{variant.name || product.title}</b><p>{params.map((parameter) => `${parameter.name}: ${parameter.value}${parameter.unit ? ` ${parameter.unit}` : ""}`).join(" · ")}</p></div><div><b>{variantPrice}</b><small>условия уточняем</small></div><AddRequestButton item={{ id:variant.id, title:variant.name || product.title, article:variant.sku ? `Артикул ${variant.sku}` : "Исполнение", price:variantPrice }}>В запрос</AddRequestButton></article>;
      })}</div>
      {product.variants.length > variants.length && <p className="feed-variant-more">Остальные {product.variants.length - variants.length} исполнений появятся после подключения полнофункционального фильтра по параметрам.</p>}
      </div><aside><ManagerContactCard compact /></aside></div></section>

    <section className="section"><div className="container product-next-step"><div><p className="eyebrow">Короткий путь к решению</p><h2>Не нужно разбираться во всех артикулах</h2><p>Сообщите операцию, материал и размеры. Инженер сопоставит исполнения и вернёт подтверждённые цену, наличие и срок.</p></div><Link className="button button-orange" href={`/#quick-order`}>Описать производственную задачу</Link></div></section>
  </main><PilotFooter /></div>;
}
