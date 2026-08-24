const SCHEMA = "https://schema.org";

const AVAILABILITY = new Set([
  `${SCHEMA}/InStock`,
  `${SCHEMA}/LimitedAvailability`,
  `${SCHEMA}/PreOrder`,
  `${SCHEMA}/BackOrder`,
  `${SCHEMA}/OutOfStock`,
  `${SCHEMA}/SoldOut`,
  `${SCHEMA}/Discontinued`,
]);
const ITEM_CONDITIONS = new Set([
  `${SCHEMA}/NewCondition`,
  `${SCHEMA}/UsedCondition`,
  `${SCHEMA}/RefurbishedCondition`,
  `${SCHEMA}/DamagedCondition`,
]);
const RETURN_CATEGORIES = new Set([
  `${SCHEMA}/MerchantReturnFiniteReturnWindow`,
  `${SCHEMA}/MerchantReturnNotPermitted`,
  `${SCHEMA}/MerchantReturnUnlimitedWindow`,
]);
const RETURN_METHODS = new Set([
  `${SCHEMA}/ReturnByMail`,
  `${SCHEMA}/ReturnInStore`,
  `${SCHEMA}/ReturnAtKiosk`,
]);
const RETURN_FEES = new Set([
  `${SCHEMA}/FreeReturn`,
  `${SCHEMA}/ReturnFeesCustomerResponsibility`,
  `${SCHEMA}/ReturnShippingFees`,
]);

function text(value, maximum = 2_000) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maximum) : undefined;
}

function httpUrl(value) {
  const candidate = text(value, 2_000);
  if (!candidate) return undefined;
  try {
    const parsed = new URL(candidate);
    return /^(?:https?:)$/.test(parsed.protocol) ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

function country(value) {
  const normalized = text(value, 2)?.toUpperCase();
  return normalized && /^[A-Z]{2}$/.test(normalized) ? normalized : undefined;
}

function currency(value) {
  const normalized = text(value, 3)?.toUpperCase();
  return normalized && /^[A-Z]{3}$/.test(normalized) ? normalized : undefined;
}

function finiteNumber(value, { minimum = Number.NEGATIVE_INFINITY, integer = false } = {}) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum) return undefined;
  return integer && !Number.isInteger(value) ? undefined : value;
}

function isoDate(value) {
  if (typeof value !== "string" && typeof value !== "number" && !(value instanceof Date)) return undefined;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

function uniqueUrls(values, maximum = 12) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map(httpUrl).filter(Boolean))).slice(0, maximum);
}

function compact(value) {
  if (Array.isArray(value)) {
    const items = value.map(compact).filter((item) => item !== undefined);
    return items.length ? items : undefined;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value)
      .map(([key, item]) => [key, compact(item)])
      .filter(([, item]) => item !== undefined);
    return entries.length ? Object.fromEntries(entries) : undefined;
  }
  if (value === undefined || value === null || value === "") return undefined;
  return value;
}

export function safeJsonLd(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function buildBreadcrumbList(items, id) {
  const normalized = (Array.isArray(items) ? items : [])
    .map((item) => ({ name: text(item?.name, 300), item: httpUrl(item?.url) }))
    .filter((item) => item.name && item.item);
  if (normalized.length < 2) return null;
  return compact({
    "@context": SCHEMA,
    "@type": "BreadcrumbList",
    "@id": httpUrl(id),
    itemListElement: normalized.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.item,
    })),
  });
}

export function buildOfferShippingDetails(policy) {
  if (!policy || policy.verified !== true) return undefined;
  const addressCountry = country(policy.addressCountry);
  const priceCurrency = currency(policy.priceCurrency);
  const shippingRate = finiteNumber(policy.shippingRate, { minimum: 0 });
  if (!addressCountry || !priceCurrency || shippingRate === undefined) return undefined;
  const handlingMinimum = finiteNumber(policy.handlingMinimumDays, { minimum: 0, integer: true });
  const handlingMaximum = finiteNumber(policy.handlingMaximumDays, { minimum: 0, integer: true });
  const transitMinimum = finiteNumber(policy.transitMinimumDays, { minimum: 0, integer: true });
  const transitMaximum = finiteNumber(policy.transitMaximumDays, { minimum: 0, integer: true });
  const hasDeliveryWindow = handlingMinimum !== undefined && handlingMaximum !== undefined
    && transitMinimum !== undefined && transitMaximum !== undefined
    && handlingMinimum <= handlingMaximum && transitMinimum <= transitMaximum;
  return compact({
    "@type": "OfferShippingDetails",
    shippingRate: { "@type": "MonetaryAmount", value: shippingRate, currency: priceCurrency },
    shippingDestination: { "@type": "DefinedRegion", addressCountry },
    deliveryTime: hasDeliveryWindow ? {
      "@type": "ShippingDeliveryTime",
      handlingTime: { "@type": "QuantitativeValue", minValue: handlingMinimum, maxValue: handlingMaximum, unitCode: "DAY" },
      transitTime: { "@type": "QuantitativeValue", minValue: transitMinimum, maxValue: transitMaximum, unitCode: "DAY" },
    } : undefined,
  });
}

export function buildMerchantReturnPolicy(policy) {
  if (!policy || policy.verified !== true) return undefined;
  const applicableCountry = country(policy.applicableCountry);
  const returnPolicyCategory = RETURN_CATEGORIES.has(policy.returnPolicyCategory) ? policy.returnPolicyCategory : undefined;
  if (!applicableCountry || !returnPolicyCategory) return undefined;
  const merchantReturnDays = finiteNumber(policy.merchantReturnDays, { minimum: 0, integer: true });
  if (returnPolicyCategory === `${SCHEMA}/MerchantReturnFiniteReturnWindow` && merchantReturnDays === undefined) return undefined;
  return compact({
    "@type": "MerchantReturnPolicy",
    applicableCountry,
    returnPolicyCategory,
    merchantReturnDays: returnPolicyCategory === `${SCHEMA}/MerchantReturnFiniteReturnWindow` ? merchantReturnDays : undefined,
    returnMethod: RETURN_METHODS.has(policy.returnMethod) ? policy.returnMethod : undefined,
    returnFees: RETURN_FEES.has(policy.returnFees) ? policy.returnFees : undefined,
  });
}

function buildOffer(input, fallback) {
  const price = finiteNumber(input?.price, { minimum: Number.EPSILON });
  const priceCurrency = currency(input?.priceCurrency);
  if (price === undefined || !priceCurrency) return undefined;
  const availability = AVAILABILITY.has(input?.availability) ? input.availability : undefined;
  const itemCondition = ITEM_CONDITIONS.has(input?.itemCondition) ? input.itemCondition : undefined;
  return compact({
    "@type": "Offer",
    url: httpUrl(input?.url) ?? fallback.url,
    price,
    priceCurrency,
    availability,
    itemCondition,
    sku: text(input?.sku ?? fallback.sku, 200),
    seller: fallback.sellerId ? { "@id": fallback.sellerId } : undefined,
    shippingDetails: buildOfferShippingDetails(input?.shippingDetails),
    hasMerchantReturnPolicy: buildMerchantReturnPolicy(input?.returnPolicy),
  });
}

function gtin(value) {
  const digits = text(value, 100)?.replace(/\D/g, "") ?? "";
  if (digits.length === 8) return { gtin8: digits };
  if (digits.length === 12) return { gtin12: digits };
  if (digits.length === 13) return { gtin13: digits };
  if (digits.length === 14) return { gtin14: digits };
  return {};
}

function buildProductVariant(input, group, sellerId, includeContext) {
  const url = httpUrl(input?.url);
  const name = text(input?.name, 500);
  if (!url || !name) return null;
  const brand = text(input.brand, 300);
  const properties = (Array.isArray(input.additionalProperty) ? input.additionalProperty : [])
    .map((property) => compact({
      "@type": "PropertyValue",
      name: text(property?.name, 300),
      value: text(property?.value, 500),
    }))
    .filter((property) => property?.name && property?.value);
  return compact({
    ...(includeContext ? { "@context": SCHEMA } : {}),
    "@type": "Product",
    "@id": `${url}#product`,
    url,
    name,
    description: text(input.description),
    sku: text(input.sku, 200),
    mpn: text(input.mpn, 200),
    ...gtin(input.gtin),
    image: uniqueUrls(input.images, 8),
    brand: brand ? { "@type": "Brand", name: brand } : undefined,
    category: text(input.category, 500),
    additionalProperty: properties,
    isVariantOf: group ? {
      "@type": "ProductGroup",
      "@id": `${group.url}#product-group`,
      name: group.name,
      productGroupID: group.id,
    } : undefined,
    offers: buildOffer(input.offer, { url, sku: input.sku, sellerId }),
  });
}

export function buildProductStructuredData(input) {
  const groupUrl = httpUrl(input?.group?.url);
  const groupName = text(input?.group?.name, 500);
  const groupId = text(input?.group?.id, 200);
  if (!groupUrl || !groupName || !groupId) return null;
  const sellerId = httpUrl(input.sellerId);
  const needsGroup = input.isGroup === true || (input.variants?.length ?? 0) > 1;
  const group = needsGroup ? { url: groupUrl, name: groupName, id: groupId } : null;
  const variants = (Array.isArray(input.variants) ? input.variants : [])
    .map((variant) => ({ raw: variant, entity: buildProductVariant(variant, group, sellerId, false) }))
    .filter((item) => item.entity);
  if (!variants.length) return null;

  const selected = input.selectedVariantId
    ? variants.find((item) => item.raw.id === input.selectedVariantId)
    : !needsGroup && variants.length === 1 ? variants[0] : undefined;
  if (selected) return buildProductVariant(selected.raw, group, sellerId, true);

  const pricedOffers = variants.map((item) => item.entity.offers).filter(Boolean);
  const currencies = new Set(pricedOffers.map((offer) => offer.priceCurrency));
  const prices = pricedOffers.map((offer) => offer.price).filter((price) => typeof price === "number");
  const brand = text(input.group.brand, 300);
  const variesBy = Array.from(new Set((Array.isArray(input.group.variesBy) ? input.group.variesBy : []).map(httpUrl).filter(Boolean)));
  return compact({
    "@context": SCHEMA,
    "@type": "ProductGroup",
    "@id": `${groupUrl}#product-group`,
    url: groupUrl,
    name: groupName,
    description: text(input.group.description),
    productGroupID: groupId,
    sku: text(input.group.sku, 200),
    brand: brand ? { "@type": "Brand", name: brand } : undefined,
    category: text(input.group.category, 500),
    image: uniqueUrls(input.group.images, 12),
    variesBy,
    hasVariant: variants.map((item) => item.entity),
    offers: prices.length && currencies.size === 1 ? {
      "@type": "AggregateOffer",
      url: groupUrl,
      priceCurrency: pricedOffers[0].priceCurrency,
      lowPrice: Math.min(...prices),
      highPrice: Math.max(...prices),
      offerCount: prices.length,
      seller: sellerId ? { "@id": sellerId } : undefined,
    } : undefined,
  });
}

export function buildArticleStructuredData(input) {
  const url = httpUrl(input?.url);
  const headline = text(input?.headline, 500);
  if (!url || !headline) return null;
  const author = text(input.author, 300);
  const reviewer = text(input.reviewer, 300);
  const publisherId = httpUrl(input.publisherId);
  const websiteId = httpUrl(input.websiteId);
  const keywords = Array.from(new Set((Array.isArray(input.keywords) ? input.keywords : []).map((item) => text(item, 200)).filter(Boolean))).slice(0, 30);
  return compact({
    "@context": SCHEMA,
    "@type": "Article",
    "@id": `${url}#article`,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    headline,
    description: text(input.description),
    image: uniqueUrls(input.images, 8),
    datePublished: isoDate(input.datePublished),
    dateModified: isoDate(input.dateModified),
    author: author ? { "@type": "Person", name: author } : undefined,
    reviewedBy: reviewer ? { "@type": "Person", name: reviewer } : undefined,
    publisher: publisherId ? { "@id": publisherId } : undefined,
    isPartOf: websiteId ? { "@id": websiteId } : undefined,
    inLanguage: text(input.inLanguage, 30) ?? "ru-RU",
    articleSection: text(input.articleSection, 300),
    keywords,
  });
}

export function buildOrganizationStructuredData(input) {
  const id = httpUrl(input?.id);
  const url = httpUrl(input?.url);
  const name = text(input?.name, 300);
  if (!id || !url || !name) return null;
  const sameAs = uniqueUrls(input.sameAs, 20);
  const contactPoints = (Array.isArray(input.contactPoints) ? input.contactPoints : []).map((point) => compact({
    "@type": "ContactPoint",
    contactType: text(point?.contactType, 100),
    telephone: text(point?.telephone, 100),
    email: text(point?.email, 300),
    areaServed: text(point?.areaServed, 100),
    availableLanguage: Array.isArray(point?.availableLanguage) ? point.availableLanguage.map((item) => text(item, 30)).filter(Boolean) : undefined,
    hoursAvailable: point?.hoursAvailable ? compact({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: Array.isArray(point.hoursAvailable.dayOfWeek) ? point.hoursAvailable.dayOfWeek.map((item) => text(item, 30)).filter(Boolean) : undefined,
      opens: /^\d{2}:\d{2}$/.test(point.hoursAvailable.opens ?? "") ? point.hoursAvailable.opens : undefined,
      closes: /^\d{2}:\d{2}$/.test(point.hoursAvailable.closes ?? "") ? point.hoursAvailable.closes : undefined,
    }) : undefined,
  })).filter((point) => point?.contactType);
  return compact({
    "@context": SCHEMA,
    "@type": "Organization",
    "@id": id,
    name,
    legalName: text(input.legalName, 500),
    url,
    logo: httpUrl(input.logo),
    image: httpUrl(input.image),
    email: text(input.email, 300),
    telephone: text(input.telephone, 100),
    description: text(input.description),
    areaServed: text(input.areaServed, 100) ? { "@type": "Country", name: text(input.areaServed, 100) } : undefined,
    address: input.address ? compact({
      "@type": "PostalAddress",
      streetAddress: text(input.address.streetAddress, 500),
      addressLocality: text(input.address.addressLocality, 300),
      addressCountry: country(input.address.addressCountry),
    }) : undefined,
    contactPoint: contactPoints,
    sameAs,
    hasMerchantReturnPolicy: buildMerchantReturnPolicy(input.returnPolicy),
  });
}

export function buildWebsiteStructuredData(input) {
  const id = httpUrl(input?.id);
  const url = httpUrl(input?.url);
  const name = text(input?.name, 300);
  if (!id || !url || !name) return null;
  const publisherId = httpUrl(input.publisherId);
  return compact({
    "@context": SCHEMA,
    "@type": "WebSite",
    "@id": id,
    url,
    name,
    inLanguage: text(input.inLanguage, 30) ?? "ru-RU",
    publisher: publisherId ? { "@id": publisherId } : undefined,
  });
}

export function buildVideoObjectStructuredData(input) {
  const name = text(input?.name, 500);
  const description = text(input?.description);
  const thumbnailUrl = uniqueUrls(input?.thumbnailUrl, 8);
  const uploadDate = isoDate(input?.uploadDate);
  const contentUrl = httpUrl(input?.contentUrl);
  const embedUrl = httpUrl(input?.embedUrl);
  if (!name || !description || !thumbnailUrl.length || !uploadDate || (!contentUrl && !embedUrl)) return null;
  const duration = text(input.duration, 100);
  return compact({
    "@context": SCHEMA,
    "@type": "VideoObject",
    name,
    description,
    thumbnailUrl,
    uploadDate,
    duration: duration && /^P(?:\d+D)?T(?=\d)(?:\d+H)?(?:\d+M)?(?:\d+(?:\.\d+)?S)?$/.test(duration) ? duration : undefined,
    contentUrl,
    embedUrl,
  });
}
