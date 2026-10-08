import type { FeedShippingPromise } from "../data/feedCatalog";

type FeedAvailabilityProps = {
  shippingPromise: FeedShippingPromise;
  count?: number;
  exact?: boolean;
  compact?: boolean;
};

export function FeedAvailability({ shippingPromise, count, exact = false, compact = false }: FeedAvailabilityProps) {
  const label = compact
    ? shippingPromise.available
      ? typeof count === "number" ? `В наличии: ${count}` : "В наличии"
      : "Наличие уточним"
    : shippingPromise.available
    ? typeof count === "number"
      ? `${count} ${variantWord(count)} в наличии · ${shippingPromise.shipmentLabel}`
      : exact ? shippingPromise.label : `В наличии · ${shippingPromise.shipmentLabel}`
    : shippingPromise.label;

  return <div className="feed-availability-block">
    <span className={shippingPromise.available ? "feed-availability feed-availability--positive" : "feed-availability"}>{label}</span>
    {!compact && <small>{shippingPromise.detail}</small>}
  </div>;
}

function variantWord(count: number): string {
  const modulo100 = count % 100;
  const modulo10 = count % 10;
  if (modulo100 >= 11 && modulo100 <= 14) return "исполнений";
  if (modulo10 === 1) return "исполнение";
  if (modulo10 >= 2 && modulo10 <= 4) return "исполнения";
  return "исполнений";
}
