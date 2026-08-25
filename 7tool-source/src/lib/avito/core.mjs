import { createHash } from "node:crypto";

const DEFAULT_FACTORS = Object.freeze({
  demand: 0.65,
  priceCompetitiveness: 0.65,
  upsellPotential: 0.7,
});

export function cleanText(value, maxLength = 20_000) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeHtml(value) {
  return escapeXml(value);
}

function cdata(value) {
  return `<![CDATA[${String(value ?? "").replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, Number(value)));
}

function configuredNumber(map, key, fallback) {
  const value = map?.[key];
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function normalizeSku(value) {
  return cleanText(value, 120).toLocaleUpperCase("ru-RU");
}

export function stableAvitoId(sourceId) {
  const source = cleanText(sourceId, 300);
  if (!source) throw new Error("AVITO_ID_SOURCE_REQUIRED");
  const readable = source.replace(/[^A-Za-z0-9_.:-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (readable && readable.length <= 80) return `7tool-${readable}`;
  return `7tool-${createHash("sha256").update(source).digest("hex").slice(0, 32)}`;
}

function stockStatus(offer) {
  if (offer.available === false) return "unavailable";
  if (Number(offer.quantity) > 0) return "in_stock";
  if (offer.available === true) return "order";
  return "unknown";
}

function normalizeParams(params) {
  const seen = new Set();
  const result = [];
  for (const item of Array.isArray(params) ? params : []) {
    const name = cleanText(item?.name, 160);
    const value = cleanText(item?.value, 500);
    const unit = cleanText(item?.unit, 40);
    const key = `${name.toLocaleLowerCase("ru-RU")}\u0000${value}\u0000${unit}`;
    if (!name || !value || seen.has(key)) continue;
    seen.add(key);
    result.push({ name, value, ...(unit ? { unit } : {}) });
  }
  return result;
}

export function normalizeSupplierOffer(offer, config, observedAt = new Date().toISOString()) {
  const sourceId = cleanText(offer?.id, 300);
  if (!sourceId) throw new Error("SUPPLIER_OFFER_ID_REQUIRED");
  const sku = normalizeSku(offer.sku || offer.vendorCode || sourceId);
  const categoryId = cleanText(offer.categoryId, 80);
  const mapping = config.categories?.[categoryId] ?? null;
  const images = unique((offer.pictures ?? offer.images ?? [])
    .map((value) => cleanText(value, 2_000))
    .filter((value) => {
      try { return new URL(value).protocol === "https:"; } catch { return false; }
    }))
    .slice(0, Number(config.images?.maxProductImages ?? 9));
  const price = Number(offer.price);
  const oldPrice = Number(offer.oldPrice);
  const quantity = Number.isFinite(Number(offer.quantity)) ? Math.max(0, Math.trunc(Number(offer.quantity))) : null;
  const internalGroup = (offer.params ?? []).find((item) => cleanText(item?.name).toLocaleLowerCase("ru-RU") === "внутренний id группы");
  return {
    id: stableAvitoId(sourceId),
    sourceId,
    familyId: cleanText(offer.groupId || internalGroup?.value || sourceId, 300),
    sku,
    brand: cleanText(offer.vendor || offer.brand, 160),
    title: cleanText(offer.name || sku, 500),
    categoryId,
    mapping,
    price: Number.isFinite(price) && price > 0 ? Math.round(price) : null,
    oldPrice: Number.isFinite(oldPrice) && oldPrice > price ? Math.round(oldPrice) : null,
    quantity,
    stockStatus: stockStatus(offer),
    stockObservedAt: observedAt,
    params: normalizeParams(offer.params),
    accessories: unique((offer.accessories ?? []).map((value) => cleanText(value, 300))).slice(0, 20),
    supplierDescription: cleanText(offer.description, 5_000),
    images,
    productUrl: cleanText(offer.productUrl, 2_000),
    carriedFromPrevious: false,
    missingRuns: 0,
  };
}

export function reconcileWithPrevious(currentProducts, previousState, config) {
  const byId = new Map(currentProducts.map((product) => [product.id, product]));
  const graceRuns = Math.max(0, Math.trunc(Number(config.safety?.missingProductGraceRuns ?? 1)));
  if (!previousState?.products || graceRuns === 0) return currentProducts;
  for (const previous of Object.values(previousState.products)) {
    if (!previous?.id || byId.has(previous.id)) continue;
    const missingRuns = Math.max(0, Number(previous.missingRuns ?? 0)) + 1;
    if (missingRuns > graceRuns || previous.stockStatus === "unavailable") continue;
    byId.set(previous.id, {
      ...previous,
      mapping: config.categories?.[previous.categoryId] ?? previous.mapping ?? null,
      stockStatus: "grace",
      carriedFromPrevious: true,
      missingRuns,
    });
  }
  return [...byId.values()];
}

function categoryMatches(values, product) {
  return (values ?? []).includes(product.categoryId) || (values ?? []).includes(product.mapping?.internalCategory);
}

function scoreContent(product) {
  const checks = [product.title, product.brand, product.sku, product.price, product.images.length, product.params.length];
  return clamp(checks.filter(Boolean).length / checks.length, 0.25, 1);
}

function overrideFor(config, bucket, product, fallback) {
  return configuredNumber(config.scoring?.[bucket], product.sku,
    configuredNumber(config.scoring?.[bucket], product.sourceId, fallback));
}

export function scoreProduct(product, config) {
  const reasons = [];
  const warnings = [];
  const selection = config.selection ?? {};
  const manualInclude = new Set((selection.includeSkus ?? []).map(normalizeSku));
  const manualExclude = new Set((selection.excludeSkus ?? []).map(normalizeSku));
  const pinned = new Set((selection.pinnedSkus ?? []).map(normalizeSku));
  const mapping = product.mapping;

  if (!mapping) reasons.push("category_not_mapped");
  else if (!mapping.schemaVerified && !config.avito?.allowUnverifiedSchema) reasons.push("avito_schema_not_verified");
  if (!product.price) reasons.push("invalid_price");
  if (product.images.length < Number(selection.minImages ?? 1)) reasons.push("insufficient_images");
  if (product.stockStatus === "unavailable") reasons.push("confirmed_unavailable");
  if (selection.requireConfirmedStock && !["in_stock", "grace"].includes(product.stockStatus)) reasons.push("not_confirmed_in_stock");
  if (product.stockStatus === "grace" && !config.safety?.allowGraceListings) reasons.push("grace_listing_disabled");
  if (manualExclude.has(product.sku)) reasons.push("manual_exclude");
  if ((selection.excludedBrands ?? []).map(normalizeSku).includes(normalizeSku(product.brand))) reasons.push("excluded_brand");
  if (categoryMatches(selection.excludedCategories, product)) reasons.push("excluded_category");

  const cost = configuredNumber(config.commercial?.costBySku, product.sku, NaN);
  const marginRate = Number.isFinite(cost) && product.price ? (product.price - cost) / product.price : null;
  if (marginRate != null && Number.isFinite(Number(selection.minMarginRate)) && marginRate < Number(selection.minMarginRate)) {
    reasons.push("margin_below_minimum");
  }
  if (marginRate == null) warnings.push("margin_unknown_neutral_score");

  const demand = clamp(overrideFor(config, "demandBySku", product, DEFAULT_FACTORS.demand), 0.05, 1);
  const stock = product.stockStatus === "in_stock" ? 1 : product.stockStatus === "grace" ? 0.72 : product.stockStatus === "order" ? 0.4 : 0.1;
  const margin = marginRate == null ? 0.65 : clamp((marginRate - 0.05) / 0.45, 0.1, 1);
  const priceCompetitiveness = clamp(overrideFor(config, "priceCompetitivenessBySku", product, DEFAULT_FACTORS.priceCompetitiveness), 0.05, 1);
  const contentQuality = scoreContent(product);
  const upsellPotential = clamp(overrideFor(config, "upsellBySku", product,
    categoryMatches(selection.priorityCategories, product) ? 0.9 : DEFAULT_FACTORS.upsellPotential), 0.05, 1);
  const shippingSpeed = product.stockStatus === "in_stock" ? 1 : product.stockStatus === "grace" ? 0.7 : 0.45;
  const factors = { demand, stock, margin, priceCompetitiveness, contentQuality, upsellPotential, shippingSpeed };
  const weights = config.scoring?.weights ?? {};
  const score = Object.entries(factors).reduce((total, [name, factor]) => total * Math.pow(factor, configuredNumber(weights, name, 1)), 1);
  const hardFailure = reasons.some((reason) => !["margin_below_minimum"].includes(reason));
  const included = !hardFailure && (manualInclude.has(product.sku) || score >= Number(selection.minScore ?? 0.04));
  if (!included && !reasons.length) reasons.push("score_below_minimum");
  return {
    score: Number(score.toFixed(6)),
    factors,
    marginRate,
    included,
    pinned: pinned.has(product.sku),
    manualInclude: manualInclude.has(product.sku),
    reasons,
    warnings,
  };
}

function truncateAtWord(value, maxLength) {
  const text = cleanText(value, maxLength + 200);
  if (text.length <= maxLength) return text;
  const shortened = text.slice(0, maxLength + 1).replace(/\s+\S*$/, "").trim();
  return shortened || text.slice(0, maxLength).trim();
}

function truncateMultiline(value, maxLength) {
  const text = String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (text.length <= maxLength) return text;
  const shortened = text.slice(0, maxLength + 1).replace(/\s+\S*$/u, "").trim();
  return shortened || text.slice(0, maxLength).trim();
}

function formatPrice(price) {
  return new Intl.NumberFormat("ru-RU").format(price).replace(/\u00a0/g, " ") + " ₽";
}

function parameterText(param) {
  return `${param.name}: ${param.value}${param.unit ? ` ${param.unit}` : ""}`;
}

function keyParams(product) {
  const wanted = (product.mapping?.keyParams ?? []).map((value) => cleanText(value).toLocaleLowerCase("ru-RU"));
  const ranked = [...product.params].sort((left, right) => {
    const leftIndex = wanted.indexOf(left.name.toLocaleLowerCase("ru-RU"));
    const rightIndex = wanted.indexOf(right.name.toLocaleLowerCase("ru-RU"));
    return (leftIndex < 0 ? 999 : leftIndex) - (rightIndex < 0 ? 999 : rightIndex);
  });
  return ranked.slice(0, Number(product.mapping?.maxDescriptionParams ?? 7));
}

export function buildListingTitle(product, config) {
  const maxLength = Number(config.content?.titleMaxLength ?? 50);
  let title = product.title;
  if (product.brand && !title.toLocaleLowerCase("ru-RU").includes(product.brand.toLocaleLowerCase("ru-RU"))) {
    title = `${title} ${product.brand}`;
  }
  if (product.sku && !title.toLocaleLowerCase("ru-RU").includes(product.sku.toLocaleLowerCase("ru-RU"))) {
    title = `${title} ${product.sku}`;
  }
  return truncateAtWord(title, maxLength);
}

export function buildListingDescription(product, config) {
  const company = config.company ?? {};
  const mapping = product.mapping ?? {};
  const status = product.stockStatus === "in_stock"
    ? `в наличии на складе в ${company.warehouseCityPrepositional ?? "Москве"}`
    : product.stockStatus === "grace"
      ? "— наличие подтверждаем перед оплатой"
      : "доступен под заказ";
  const first = `${product.title}${product.brand && !product.title.includes(product.brand) ? ` ${product.brand}` : ""} ${status}. Цена ${formatPrice(product.price)}${company.vatIncluded ? " с НДС" : ""}.`;
  const blocks = [first];
  if (mapping.useCase) blocks.push(cleanText(mapping.useCase, 800));
  const params = keyParams(product);
  if (params.length) blocks.push(`Основные характеристики:\n${params.map((item) => `• ${parameterText(item)}`).join("\n")}`);
  if (product.accessories.length) blocks.push(`Комплектация:\n${product.accessories.map((item) => `• ${item}`).join("\n")}`);
  const service = [];
  const warrantyMonths = mapping.warrantyMonths ?? (mapping.useCompanyWarranty ? company.warrantyMonths : null);
  if (warrantyMonths) service.push(`гарантия ${warrantyMonths} мес.`);
  if (company.vatIncluded) service.push("счёт и документы с НДС");
  if (company.deliveryText) service.push(cleanText(company.deliveryText, 300));
  if (company.legalEntityTerms) service.push(cleanText(company.legalEntityTerms, 300));
  if (service.length) blocks.push(`Условия покупки:\n${service.map((item) => `• ${item}`).join("\n")}`);
  const questions = mapping.qualificationQuestions ?? [];
  const cta = questions.length
    ? `Напишите ${questions.join(", ")} — инженер проверит применимость и подготовит предложение.`
    : "Напишите параметры вашей задачи — инженер проверит применимость и подготовит предложение.";
  blocks.push(cta);
  return truncateMultiline(blocks.join("\n\n"), Number(config.content?.descriptionMaxLength ?? 7_000));
}

function numericTokens(value) {
  return new Set(String(value ?? "").match(/\d+(?:[.,]\d+)?/g) ?? []);
}

export function validateGeneratedContent(product, draft, config) {
  const errors = [];
  const allowedWarranty = product.mapping?.warrantyMonths
    ?? (product.mapping?.useCompanyWarranty ? config.company?.warrantyMonths : null);
  const sourceValues = [
    product.title, product.brand, product.sku, product.price, product.oldPrice, product.quantity,
    ...product.params.flatMap((item) => [item.name, item.value, item.unit]),
    ...product.accessories,
    allowedWarranty,
    config.company?.deliveryText,
    config.company?.legalEntityTerms,
    product.mapping?.warrantyMonths,
    product.mapping?.useCase,
    ...(product.mapping?.qualificationQuestions ?? []),
    formatPrice(product.price),
  ];
  const allowedNumbers = new Set(sourceValues.flatMap((value) => [...numericTokens(value)]));
  for (const token of numericTokens(`${draft.title}\n${draft.description}`)) {
    if (!allowedNumbers.has(token)) errors.push(`unverified_number:${token}`);
  }
  if (product.brand && !`${draft.title} ${draft.description}`.toLocaleLowerCase("ru-RU").includes(product.brand.toLocaleLowerCase("ru-RU"))) {
    errors.push("brand_missing_or_changed");
  }
  if (/https?:\/\/|\bwww\./i.test(draft.description)) errors.push("external_link_in_description");
  if (/(?:лучший|лучшая|лучшее|лучшие|самая низкая цена)|№\s*1|гарантированно/iu.test(draft.description)) errors.push("unsupported_superlative");
  return { valid: errors.length === 0, errors };
}

function validHttpsUrl(value) {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}

function galleryImages(product, config) {
  const maxImages = Number(config.images?.maxAvitoImages ?? 10);
  const productImages = product.images.filter(validHttpsUrl);
  const generated = (config.images?.generatedBySku?.[product.sku] ?? []).filter(validHttpsUrl);
  const warehouse = config.images?.appendWarehouseProof
    ? (config.images?.warehouseProofUrls ?? []).filter(validHttpsUrl)
    : [];
  return unique([...productImages, ...generated, ...warehouse]).slice(0, maxImages);
}

export function buildListing(product, config) {
  const title = buildListingTitle(product, config);
  const description = buildListingDescription(product, config);
  const draftValidation = validateGeneratedContent(product, { title, description }, config);
  const listing = {
    id: product.id,
    sourceId: product.sourceId,
    sku: product.sku,
    categoryId: product.categoryId,
    title,
    description,
    price: product.price,
    images: galleryImages(product, config),
    address: cleanText(config.company?.warehouseAddress, 500),
    category: cleanText(product.mapping?.category, 200),
    goodsType: cleanText(product.mapping?.goodsType, 200),
    condition: cleanText(product.mapping?.condition, 100),
    adType: cleanText(product.mapping?.adType, 100),
    extraFields: product.mapping?.fields ?? {},
    score: product.selection.score,
    stockStatus: product.stockStatus,
    carriedFromPrevious: product.carriedFromPrevious,
    validation: draftValidation,
  };
  const errors = [...draftValidation.errors];
  if (!listing.address) errors.push("warehouse_address_required");
  if (!listing.category) errors.push("avito_category_required");
  if (!listing.images.length) errors.push("avito_images_required");
  if (!listing.price) errors.push("price_required");
  if (!listing.title) errors.push("title_required");
  if (!listing.description) errors.push("description_required");
  for (const field of product.mapping?.requiredFields ?? []) {
    const value = listing[field] ?? listing.extraFields?.[field];
    if (value == null || value === "") errors.push(`required_mapping_field_missing:${field}`);
  }
  listing.validation = { valid: errors.length === 0, errors };
  return listing;
}

function xmlTag(name, value, { raw = false } = {}) {
  if (value == null || value === "") return null;
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(name)) throw new Error(`INVALID_AVITO_FIELD_NAME:${name}`);
  return `    <${name}>${raw ? value : escapeXml(value)}</${name}>`;
}

export function renderAvitoXml(listings, config) {
  const ads = listings.map((listing) => {
    const fields = [
      xmlTag("Id", listing.id),
      config.company?.contactPhone ? xmlTag("ContactPhone", config.company.contactPhone) : null,
      xmlTag("Address", listing.address),
      xmlTag("Category", listing.category),
      listing.goodsType ? xmlTag("GoodsType", listing.goodsType) : null,
      listing.adType ? xmlTag("AdType", listing.adType) : null,
      listing.condition ? xmlTag("Condition", listing.condition) : null,
      ...Object.entries(config.avito?.commonFields ?? {}).map(([name, value]) => xmlTag(name, value)),
      ...Object.entries(listing.extraFields ?? {}).map(([name, value]) => xmlTag(name, value)),
      xmlTag("Title", listing.title),
      xmlTag("Description", cdata(listing.description), { raw: true }),
      xmlTag("Price", listing.price),
      `    <Images>\n${listing.images.map((url) => `      <Image url="${escapeXml(url)}" />`).join("\n")}\n    </Images>`,
    ].filter(Boolean);
    return `  <Ad>\n${fields.join("\n")}\n  </Ad>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Ads formatVersion="3" target="Avito.ru">\n${ads.join("\n")}\n</Ads>\n`;
}

export function validateAvitoXml(xml, expectedAds) {
  const errors = [];
  if (!xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')) errors.push("utf8_declaration_missing");
  if (!/<Ads formatVersion="3" target="Avito\.ru">/.test(xml)) errors.push("root_invalid");
  const opens = (xml.match(/<Ad>/g) ?? []).length;
  const closes = (xml.match(/<\/Ad>/g) ?? []).length;
  if (opens !== closes || opens !== expectedAds) errors.push(`ad_count_mismatch:${opens}:${closes}:${expectedAds}`);
  const ids = [...xml.matchAll(/<Id>([^<]+)<\/Id>/g)].map((match) => match[1]);
  if (ids.length !== new Set(ids).size) errors.push("duplicate_ids");
  if (/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[\da-f]+;)/i.test(xml.replace(/<!\[CDATA\[[\s\S]*?]]>/g, ""))) errors.push("unescaped_ampersand");
  return { valid: errors.length === 0, errors, ads: opens };
}

function sourceDropGuard(currentCount, previousState, config) {
  const minimum = Number(config.source?.minOffers ?? 1);
  if (currentCount < minimum) throw new Error(`AVITO_SOURCE_TOO_SMALL:${currentCount}/${minimum}`);
  const previousCount = Number(previousState?.sourceOfferCount ?? 0);
  const maxDrop = clamp(config.safety?.maxSourceDropRatio ?? 0.25, 0, 0.99);
  if (previousCount >= Number(config.safety?.dropGuardMinPreviousOffers ?? 20) && currentCount < previousCount * (1 - maxDrop)) {
    throw new Error(`AVITO_SOURCE_LARGE_DROP:${currentCount}/${previousCount}`);
  }
}

export function buildAvitoPipeline({ offers, config, previousState = null, generatedAt = new Date().toISOString() }) {
  sourceDropGuard(offers.length, previousState, config);
  const failures = [];
  const normalized = [];
  for (const offer of offers) {
    try { normalized.push(normalizeSupplierOffer(offer, config, generatedAt)); }
    catch (error) { failures.push({ sourceId: offer?.id ?? null, reasons: [error instanceof Error ? error.message : String(error)] }); }
  }
  const reconciled = reconcileWithPrevious(normalized, previousState, config);
  const evaluated = reconciled.map((product) => ({ ...product, selection: scoreProduct(product, config) }));
  const candidates = evaluated.filter((product) => product.selection.included)
    .sort((left, right) => Number(right.selection.pinned) - Number(left.selection.pinned)
      || Number(right.selection.manualInclude) - Number(left.selection.manualInclude)
      || right.selection.score - left.selection.score
      || left.id.localeCompare(right.id));
  const limit = Math.max(1, Math.trunc(Number(config.selection?.limit ?? 200)));
  const selectedProducts = [];
  const categoryCounts = new Map();
  const familyCounts = new Map();
  const selectionSkipReasons = new Map();
  for (const product of candidates) {
    if (selectedProducts.length >= limit) {
      selectionSkipReasons.set(product.id, "selection_limit");
      continue;
    }
    const categoryKey = product.categoryId || product.mapping?.internalCategory || "unknown";
    const categoryLimit = configuredNumber(config.selection?.categoryLimits, categoryKey, limit);
    const familyLimit = Math.max(1, Math.trunc(Number(config.selection?.maxPerFamily ?? limit)));
    const bypassMixCaps = product.selection.pinned || product.selection.manualInclude;
    if (!bypassMixCaps && (categoryCounts.get(categoryKey) ?? 0) >= categoryLimit) {
      selectionSkipReasons.set(product.id, "category_limit");
      continue;
    }
    if (!bypassMixCaps && (familyCounts.get(product.familyId) ?? 0) >= familyLimit) {
      selectionSkipReasons.set(product.id, "family_limit");
      continue;
    }
    selectedProducts.push(product);
    categoryCounts.set(categoryKey, (categoryCounts.get(categoryKey) ?? 0) + 1);
    familyCounts.set(product.familyId, (familyCounts.get(product.familyId) ?? 0) + 1);
  }
  const listings = [];
  for (const product of selectedProducts) {
    const listing = buildListing(product, config);
    if (listing.validation.valid) listings.push(listing);
    else failures.push({ sourceId: product.sourceId, sku: product.sku, reasons: listing.validation.errors });
  }
  const xml = renderAvitoXml(listings, config);
  const xmlValidation = validateAvitoXml(xml, listings.length);
  if (!xmlValidation.valid) throw new Error(`AVITO_XML_INVALID:${xmlValidation.errors.join(",")}`);
  const selectedIds = new Set(listings.map((listing) => listing.id));
  const excluded = evaluated.filter((product) => !selectedIds.has(product.id)).map((product) => ({
    id: product.id,
    sourceId: product.sourceId,
    sku: product.sku,
    title: product.title,
    score: product.selection.score,
    reasons: product.selection.included
      ? [selectionSkipReasons.get(product.id) ?? "listing_validation_failed"]
      : product.selection.reasons,
    warnings: product.selection.warnings,
  }));
  const report = {
    generatedAt,
    dryRun: true,
    sourceOffers: offers.length,
    normalized: evaluated.length,
    selected: listings.length,
    excluded: excluded.length,
    failed: failures.length,
    carriedFromPrevious: evaluated.filter((product) => product.carriedFromPrevious).length,
    selectedByCategory: Object.fromEntries([...categoryCounts.entries()].sort(([left], [right]) => left.localeCompare(right))),
    schemaWarnings: unique(evaluated.filter((product) => product.mapping && !product.mapping.schemaVerified).map((product) => product.categoryId)),
    xmlValidation,
    listings,
    exclusions: excluded,
    failures,
  };
  const state = {
    version: 1,
    generatedAt,
    sourceOfferCount: offers.length,
    products: Object.fromEntries(evaluated.map((product) => [product.id, {
      ...product,
      selection: undefined,
    }])),
  };
  return { xml, report, state, html: renderPreviewHtml(report, config) };
}

export function renderPreviewHtml(report, config) {
  const rows = report.listings.map((listing) => `
    <article class="card" data-status="selected" data-search="${escapeHtml(`${listing.sku} ${listing.title} ${listing.category}`.toLocaleLowerCase("ru-RU"))}">
      <img src="${escapeHtml(listing.images[0])}" alt="" loading="lazy">
      <div><span class="badge">selected · ${listing.score}</span><h2>${escapeHtml(listing.title)}</h2>
      <p><b>${escapeHtml(formatPrice(listing.price))}</b> · ${escapeHtml(listing.sku)} · ${escapeHtml(listing.stockStatus)}</p>
      <pre>${escapeHtml(listing.description)}</pre></div>
    </article>`).join("");
  const excluded = report.exclusions.map((item) => `
    <article class="card excluded" data-status="excluded" data-search="${escapeHtml(`${item.sku} ${item.title} ${item.reasons.join(" ")}`.toLocaleLowerCase("ru-RU"))}">
      <div><span class="badge">excluded · ${item.score}</span><h2>${escapeHtml(item.title)}</h2>
      <p>${escapeHtml(item.sku)} · ${escapeHtml(item.reasons.join(", "))}</p></div>
    </article>`).join("");
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
  <title>7TOOL · Avito preview</title><style>
  :root{font:15px system-ui;color:#18202b;background:#f4f6f8}body{margin:0}header{position:sticky;top:0;background:#101820;color:#fff;padding:18px 4vw;z-index:2}main{max-width:1200px;margin:24px auto;padding:0 20px}.stats{display:flex;gap:10px;flex-wrap:wrap}.stats b,.badge{background:#e8eef4;border-radius:999px;padding:6px 10px;color:#263849}header .stats b{background:#25384a;color:#fff}input,select{padding:10px;border-radius:8px;border:1px solid #ccd5de;margin:12px 8px 0 0}.card{display:grid;grid-template-columns:180px 1fr;gap:20px;background:#fff;border-radius:14px;margin:14px 0;padding:16px;box-shadow:0 2px 14px #18202b12}.card img{width:180px;height:150px;object-fit:contain;background:#f7f8fa}.excluded{border-left:5px solid #cf4c4c}h2{font-size:19px}pre{white-space:pre-wrap;font:14px/1.45 system-ui;color:#334;max-height:260px;overflow:auto}@media(max-width:650px){.card{grid-template-columns:1fr}.card img{width:100%}}
  </style></head><body><header><h1>7TOOL · предпросмотр Avito</h1><div class="stats"><b>Выбрано: ${report.selected}</b><b>Исключено: ${report.excluded}</b><b>Ошибок: ${report.failed}</b><b>Город: ${escapeHtml(config.company?.warehouseCity ?? "Москва")}</b></div>
  <input id="q" placeholder="SKU, название, причина"><select id="status"><option value="all">Все</option><option value="selected">Выбраны</option><option value="excluded">Исключены</option></select></header>
  <main>${rows}${excluded}</main><script>const q=document.querySelector('#q'),s=document.querySelector('#status'),cards=[...document.querySelectorAll('.card')];function f(){const v=q.value.toLowerCase(),st=s.value;for(const c of cards)c.hidden=!(c.dataset.search.includes(v)&&(st==='all'||c.dataset.status===st))}q.oninput=f;s.onchange=f;</script></body></html>`;
}
