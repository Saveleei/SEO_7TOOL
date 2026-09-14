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
      image:sanitizeImageSource(item.image),
      href:sanitizeProductHref(item.href),
      shippingLabel:sanitizeShippingText(item.shippingLabel),
      shippingDetail:sanitizeShippingText(item.shippingDetail),
    }];
  }).slice(0, 50);
}

export function sanitizeProductHref(value) {
  if (typeof value !== "string" || value.length > 500 || !value.startsWith("/") || value.startsWith("//")) return undefined;
  try {
    const base = "https://quote-draft.7tool.invalid";
    const url = new URL(value, base);
    if (url.origin !== base || !/^\/product\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\/?$/u.test(url.pathname)) return undefined;
    if ([...url.searchParams.keys()].some((key) => key !== "variant")) return undefined;
    const variant = url.searchParams.get("variant");
    if (variant !== null && !/^[A-Za-z0-9._:-]{1,160}$/u.test(variant)) return undefined;
    const pathname = url.pathname.replace(/\/$/u, "");
    const query = variant ? `?variant=${encodeURIComponent(variant)}` : "";
    const hash = url.hash === "#variants" ? "#variants" : "";
    return `${pathname}${query}${hash}`;
  } catch {
    return undefined;
  }
}

function sanitizeImageSource(value) {
  if (typeof value !== "string" || value.length > 1000) return undefined;
  if (/^\/(?!\/)[^\\]*$/u.test(value)) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function sanitizeShippingText(value) {
  return typeof value === "string" && value.length <= 160 ? value : undefined;
}

export function createDraftNumber(now = new Date()) {
  const stamp = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("");
  return `7T-${stamp}-${String(now.getTime()).slice(-5)}`;
}

function normalizeQuantity(value) {
  const quantity = Number(value);
  return Number.isFinite(quantity) ? Math.min(999, Math.max(1, Math.round(quantity))) : 1;
}
