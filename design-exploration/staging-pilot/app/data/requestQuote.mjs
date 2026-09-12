export function parseQuotePrice(value) {
  if (typeof value !== "string" || /^\s*(от|цена\s+по\s+запросу)/iu.test(value)) return null;
  const digits = value.replace(/[^\d]/gu, "");
  if (!digits) return null;
  const amount = Number(digits);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export function summarizeRequest(items) {
  let totalQuantity = 0;
  let pricedItems = 0;
  let estimatedTotal = 0;
  for (const item of Array.isArray(items) ? items : []) {
    const quantity = normalizeQuantity(item?.quantity);
    totalQuantity += quantity;
    const price = parseQuotePrice(item?.price);
    if (price !== null) {
      pricedItems += 1;
      estimatedTotal += price * quantity;
    }
  }
  return { totalQuantity, pricedItems, estimatedTotal, hasUnpricedItems:pricedItems < (Array.isArray(items) ? items.length : 0) };
}

export function sanitizeRequestItems(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || typeof item.id !== "string" || typeof item.title !== "string" || typeof item.article !== "string") return [];
    return [{
      id:item.id.slice(0, 160),
      title:item.title.slice(0, 300),
      article:item.article.slice(0, 160),
      price:typeof item.price === "string" ? item.price.slice(0, 80) : undefined,
      quantity:normalizeQuantity(item.quantity),
      image:typeof item.image === "string" && /^(https?:\/\/|\/)/u.test(item.image) ? item.image.slice(0, 1000) : undefined,
      href:typeof item.href === "string" && item.href.startsWith("/") ? item.href.slice(0, 500) : undefined,
    }];
  }).slice(0, 50);
}

export function createDraftNumber(now = new Date()) {
  const stamp = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("");
  return `7T-${stamp}-${String(now.getTime()).slice(-5)}`;
}

function normalizeQuantity(value) {
  const quantity = Number(value);
  return Number.isFinite(quantity) ? Math.min(999, Math.max(1, Math.round(quantity))) : 1;
}
