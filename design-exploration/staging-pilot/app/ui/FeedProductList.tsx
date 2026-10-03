"use client";

import type { FeedProductCardModel } from "../data/feedCatalog";
import { comparisonSelectionFromCard, useComparison } from "./Comparison";
import { FeedProductCard } from "./FeedProductCard";

export function FeedProductList({ products }: { products: FeedProductCardModel[] }) {
  const { hasProduct, toggle } = useComparison();
  return <div className="feed-product-grid">{products.map((product) => <FeedProductCard product={product} selected={hasProduct(product.id)} onCompare={() => toggle(comparisonSelectionFromCard(product), "category_card")} key={product.id} />)}</div>;
}
