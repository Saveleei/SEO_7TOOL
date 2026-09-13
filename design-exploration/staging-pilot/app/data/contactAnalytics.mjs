const SAFE_CONTEXT_FIELDS = ["placement", "product_id", "variant_id", "category"];

export function getContactChannel(href) {
  const value = String(href ?? "").trim();
  const normalized = value.toLocaleLowerCase("en-US");
  if (normalized.startsWith("tel:")) return "phone";
  if (normalized.startsWith("mailto:")) return "email";
  try {
    const url = new URL(value);
    if (url.hostname === "t.me" || url.hostname === "telegram.me") return "telegram";
    if (url.hostname === "max.ru") return "max";
  } catch {
    return null;
  }
  return null;
}

export function buildContactClickDetail({ href, pathname, search = "", context = {} }) {
  const channel = getContactChannel(href);
  if (!channel) return null;
  const pageType = classifyPageType(pathname);
  const detail = {
    event: channel === "phone" ? "PHONE_CLICK" : channel === "email" ? "EMAIL_CLICK" : "click_messenger",
    channel,
    page_type: pageType,
  };
  const routeIdentifier = getRouteIdentifier(pathname);
  if (pageType === "category" && routeIdentifier) detail.category = routeIdentifier;
  if (pageType === "product" && routeIdentifier) detail.product_id = routeIdentifier;
  if (pageType === "product") {
    const variantId = sanitizeContextValue(new URLSearchParams(String(search)).get("variant"));
    if (variantId) detail.variant_id = variantId;
  }
  for (const field of SAFE_CONTEXT_FIELDS) {
    const value = sanitizeContextValue(context[field]);
    if (value) detail[field] = value;
  }
  if (!detail.placement) detail.placement = "content_link";
  return detail;
}

function getRouteIdentifier(pathname) {
  const parts = String(pathname ?? "").split("/").filter(Boolean);
  return sanitizeContextValue(parts.at(-1));
}

function classifyPageType(pathname) {
  const value = String(pathname ?? "");
  if (value.startsWith("/product/")) return "product";
  if (value.startsWith("/catalog/category/")) return "category";
  if (value.startsWith("/catalog/task/")) return "task";
  if (value === "/catalog" || value.startsWith("/catalog/")) return "catalog";
  if (value.startsWith("/search")) return "search";
  if (value.startsWith("/test/")) return "staff";
  if (value === "/") return "home";
  return "other";
}

function sanitizeContextValue(value) {
  const normalized = String(value ?? "").trim().slice(0, 120);
  return /^[\p{L}\p{N}_.:-]+$/u.test(normalized) ? normalized : "";
}
