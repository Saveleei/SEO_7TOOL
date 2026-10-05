import Image from "next/image";
import Link from "next/link";
import type { LegacyRetainedProduct } from "../data/legacyRetainedProducts";
import { publicBrandPath, publicCategoryPath } from "../data/publicUrls";
import { canonicalUrl } from "../data/seo";
import { Breadcrumbs } from "./Breadcrumbs";
import { ContactRequestDialog } from "./ContactRequestDialog";
import { JsonLd } from "./JsonLd";
import { PilotFooter } from "./PilotFooter";
import { PilotHeader } from "./PilotHeader";

export function LegacyRetainedProductPage({ product }: { product: LegacyRetainedProduct }) {
  const productUrl = canonicalUrl(`/p/${product.slug}`);
  const structuredData = {
    "@context":"https://schema.org",
    "@type":"Product",
    "@id":`${productUrl}#product`,
    name:product.title,
    description:product.description,
    url:productUrl,
    sku:product.sku || undefined,
    brand:product.brand ? { "@type":"Brand", name:product.brand } : undefined,
    category:product.category,
    image:product.image ? [product.image] : undefined,
  };
  return <div className="site-shell"><JsonLd data={structuredData} /><PilotHeader /><main className="inner-page feed-product-conversion-page">
    <div className="container"><Breadcrumbs items={[{ label:"Главная", href:"/" }, { label:"Каталог", href:"/catalog" }, ...(product.categorySlug ? [{ label:product.category, href:publicCategoryPath(product.categorySlug) }] : []), ...(product.brand ? [{ label:product.brand, href:publicBrandPath(product.brand) }] : []), { label:product.title }]} /></div>
    <section className="feed-conversion-main"><div className="container feed-conversion-layout">
      <div className="feed-product-gallery">{product.image ? <Image src={product.image} alt={product.title} width={760} height={620} unoptimized priority /> : <div className="feed-product-gallery-empty">Фотография уточняется</div>}</div>
      <div className="feed-conversion-summary"><p className="product-code">{product.brand}{product.sku ? ` · Артикул ${product.sku}` : ""}</p><h1>{product.title}</h1><p className="feed-conversion-intro">{product.description}</p><div className="product-data-conflict" role="status"><b>Позиция сохранена для непрерывности каталога</b><p>Этот опубликованный адрес присутствует в действующем sitemap, но позиция отсутствует в текущем товарном фиде. Цена, наличие, характеристики и возможность поставки требуют отдельного подтверждения — устаревшие значения не показываются.</p></div><ContactRequestDialog categoryTitle={`${product.title}${product.sku ? `, артикул ${product.sku}` : ""}`} buttonLabel="Уточнить поставку или замену" /></div>
    </div></section>
    <section className="section section-muted"><div className="container public-info-two-column"><div><p className="eyebrow">Без потери старого адреса</p><h2>Что проверит менеджер</h2><p>Идентификацию модели, актуальный аналог при снятии позиции, совместимость, цену, наличие, документы и срок поставки.</p></div><div className="public-info-checklist">{product.groupPath && product.groupPath !== `/p/${product.slug}` && <p><b>Текущая товарная группа</b><span><Link href={product.groupPath}>Открыть основную страницу серии →</Link></span></p>}{product.categorySlug && <p><b>Актуальный раздел</b><span><Link href={publicCategoryPath(product.categorySlug)}>Смотреть товары категории «{product.category}» →</Link></span></p>}</div></div></section>
  </main><PilotFooter /></div>;
}
