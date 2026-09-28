const STALEX_HOST = "stalex.ru";
const STALEX_PATH_PREFIX = "/upload/";
const STALEX_IMAGE_PATH = /\.(?:jpe?g|png|webp)$/iu;

export function toSupplierImageProxyUrl(value) {
  const source = String(value || "").trim();
  if (!source) return source;
  try {
    const url = new URL(source);
    if (url.protocol !== "https:" || url.hostname !== STALEX_HOST) return source;
    const upstreamPath = sanitizeStalexImagePath(url.pathname);
    return upstreamPath ? `/api/supplier-images/stalex?path=${encodeURIComponent(upstreamPath)}` : source;
  } catch {
    return source;
  }
}

export function sanitizeStalexImagePath(value) {
  const candidate = String(value || "").trim();
  if (!candidate || candidate.length > 1_000) return null;
  if (!candidate.startsWith(STALEX_PATH_PREFIX) || candidate.includes("\\") || candidate.includes("\0")) return null;
  if (candidate.split("/").some((segment) => segment === "." || segment === "..")) return null;
  if (!STALEX_IMAGE_PATH.test(candidate)) return null;
  return candidate;
}

export function getStalexImageUpstreamUrl(value) {
  const path = sanitizeStalexImagePath(value);
  return path ? new URL(path, `https://${STALEX_HOST}`).toString() : null;
}

export function applySupplierImageProxy(snapshot) {
  return {
    ...snapshot,
    products:snapshot.products.map((product) => {
      if (product.sourceSupplier !== "stalex") return product;
      return {
        ...product,
        images:product.images.map(toSupplierImageProxyUrl),
        variants:product.variants.map((variant) => ({
          ...variant,
          images:variant.images?.map(toSupplierImageProxyUrl),
        })),
      };
    }),
  };
}
