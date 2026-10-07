"use client";

import { Fragment, type ReactNode } from "react";
import type { FeedProductCardModel } from "../data/feedCatalog";
import { comparisonSelectionFromCard, useComparison } from "./Comparison";
import { FeedProductCard } from "./FeedProductCard";

export function FeedProductList({ products, layout = "list", after }: { products: FeedProductCardModel[]; layout?: "list" | "grid"; after?: ReactNode }) {
  const { hasProduct, toggle } = useComparison();
  const insertionIndex = Math.min(2, products.length - 1);
  return <div className={`feed-product-grid feed-product-grid--${layout}`}>{products.map((product, index) => <Fragment key={product.id}>
    <FeedProductCard product={product} selected={hasProduct(product.id)} onCompare={() => toggle(comparisonSelectionFromCard(product), layout === "grid" ? "category_grid" : "category_card")} />
    {after && index === insertionIndex && <div className="category-feed-assistant">{after}</div>}
  </Fragment>)}</div>;
}
