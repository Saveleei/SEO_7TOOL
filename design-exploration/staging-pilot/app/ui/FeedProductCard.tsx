import Image from "next/image";
import Link from "next/link";
import { FeedProduct, getFeedProductImage, getFeedProductPriceLabel } from "../data/feedCatalog";
import { AddRequestButton } from "./RequestCart";

export function FeedProductCard({ product }: { product: FeedProduct }) {
  const image = getFeedProductImage(product);
  const price = getFeedProductPriceLabel(product);
  const axes = product.paramAxes.slice(0, 3);

  return <article className="feed-product-card">
    <Link className="feed-product-media" href={`/product/${product.slug}`} aria-label={`Открыть ${product.title}`}>
      {image ? <Image src={image} alt={product.title} width={430} height={340} unoptimized /> : <span>Изображение уточняется</span>}
      <small>Данные из товарного фида</small>
    </Link>
    <div className="feed-product-copy">
      <span>{product.brand}{product.sku ? ` · ${product.sku}` : ""}</span>
      <h3><Link href={`/product/${product.slug}`}>{product.title}</Link></h3>
      {axes.length > 0 && <ul>{axes.map((axis) => <li key={axis}>{axis}</li>)}</ul>}
      <div className="feed-product-price"><b>{price}</b><small>с НДС · актуальность подтвердим в КП</small></div>
      <p>Наличие и срок поставки уточняем для выбранного исполнения.</p>
      <div className="feed-product-actions">
        <AddRequestButton item={{ id:product.id, title:product.title, article:product.sku ? `Артикул ${product.sku}` : "Товарная группа", price }}>В запрос КП</AddRequestButton>
        <Link href={`/product/${product.slug}`}>Характеристики</Link>
      </div>
    </div>
  </article>;
}
