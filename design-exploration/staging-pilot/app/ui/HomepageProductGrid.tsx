import Image from "next/image";
import Link from "next/link";
import type { FeedProductCardModel } from "../data/feedCatalog";
import { FeedAvailability } from "./FeedAvailability";
import { AddRequestButton } from "./RequestCart";

export function HomepageProductGrid({ products }: { products: FeedProductCardModel[] }) {
  return <div className="homepage-product-grid">
    {products.map((product) => {
      const directVariant = product.variantCount === 1 ? product.variants[0] : undefined;
      const productHref = `/product/${product.slug}`;
      return <article className="homepage-product-card" key={product.id}>
        <Link className="homepage-product-media" href={productHref} aria-label={`Открыть ${product.title}`}>
          {product.image ? <Image src={product.image} alt={product.title} width={360} height={230} unoptimized /> : <span>Изображение уточняется</span>}
        </Link>
        <div className="homepage-product-body">
          <div className="homepage-product-identity">
            <span>{product.cardArchetype.badge} · {product.brand}</span>
            <h3><Link href={productHref}>{product.title}</Link></h3>
            <small>{product.variantCount > 1 ? `${product.variantCount} исполнений в товарной группе` : "Одно исполнение"}</small>
          </div>
          {product.specs.length > 0 && <dl className="homepage-product-specs" aria-label="Основные характеристики">
            {product.specs.slice(0, 3).map((spec) => <div key={spec.label}><dt>{spec.label}</dt><dd>{spec.value}</dd></div>)}
          </dl>}
          <div className="homepage-product-commercial">
            <b>{product.price}</b>
            <FeedAvailability shippingPromise={product.shippingPromise} />
          </div>
          <div className="homepage-product-actions">
            {directVariant ? <AddRequestButton className="homepage-product-primary" item={{
              id:`variant:${directVariant.id}`,
              title:directVariant.title || product.title,
              article:directVariant.sku ? `Артикул ${directVariant.sku}` : "Артикул не указан в фиде",
              price:directVariant.price,
              image:directVariant.image ?? product.image,
              href:directVariant.href,
              shippingLabel:directVariant.shippingPromise.label,
              shippingDetail:directVariant.shippingPromise.detail,
            }}>Добавить в КП</AddRequestButton> : <Link className="homepage-product-primary" href={`${productHref}#variants`}>{product.cardArchetype.multipleAction}</Link>}
            <Link className="homepage-product-secondary" href={productHref}>{product.cardArchetype.detailAction}</Link>
          </div>
        </div>
      </article>;
    })}
  </div>;
}
