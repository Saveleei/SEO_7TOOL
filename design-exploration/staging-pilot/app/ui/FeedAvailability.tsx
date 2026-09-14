import type { FeedShippingPromise } from "../data/feedCatalog";

type FeedAvailabilityProps = {
  shippingPromise: FeedShippingPromise;
  count?: number;
  exact?: boolean;
};

export function FeedAvailability({ shippingPromise, count, exact = false }: FeedAvailabilityProps) {
  const label = shippingPromise.available
    ? typeof count === "number"
      ? `${count} ${variantWord(count)} в наличии · ${shippingPromise.shipmentLabel}`
      : exact ? shippingPromise.label : `Есть исполнения в наличии · ${shippingPromise.shipmentLabel}`
    : shippingPromise.label;

  return <div className="feed-availability-block">
    <span className={shippingPromise.available ? "feed-availability feed-availability--positive" : "feed-availability"}>{label}</span>
    <small>{shippingPromise.detail}</small>
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
