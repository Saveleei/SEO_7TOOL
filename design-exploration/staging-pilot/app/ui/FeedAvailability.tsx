type FeedAvailabilityProps = {
  available: boolean;
  count?: number;
  exact?: boolean;
};

export function FeedAvailability({ available, count, exact = false }: FeedAvailabilityProps) {
  const label = available
    ? typeof count === "number"
      ? `${count} ${variantWord(count)} в наличии`
      : exact ? "В наличии" : "Есть исполнения в наличии"
    : "Наличие и срок уточняем";

  return <span className="feed-availability-block">
    <span className={available ? "feed-availability feed-availability--positive" : "feed-availability"}>{label}</span>
    {available && <small>Остаток и срок подтвердим перед оплатой</small>}
  </span>;
}

function variantWord(count: number): string {
  const modulo100 = count % 100;
  const modulo10 = count % 10;
  if (modulo100 >= 11 && modulo100 <= 14) return "исполнений";
  if (modulo10 === 1) return "исполнение";
  if (modulo10 >= 2 && modulo10 <= 4) return "исполнения";
  return "исполнений";
}
