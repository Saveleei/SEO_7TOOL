import { getCatalogQualityReport } from "./catalogQuality.ts";
import { getCategoryExpertProfile } from "./categoryExpertProfiles.mjs";
import { getFeedCategoryPage, toFeedProductCardModel } from "./feedCatalog.ts";
import { publicProductPath } from "./publicUrls.ts";

export const launchCoreScopes = Object.freeze([
  { id:"magnetic-drills", title:"Магнитные сверлильные станки", slug:"stanki-sverlilnye", query:{ segment:"drill-magnetic" } },
  { id:"annular-cutters", title:"Корончатые сверла", slug:"koronchatye-sverla", query:{} },
  { id:"sheet-bevelers", title:"Кромкорезы по листу", slug:"kromkorezy-po-listu", query:{} },
  { id:"pipe-bevelers", title:"Кромкорезы для труб", slug:"kromkorezy-dlya-trub", query:{} },
  { id:"rotary-burrs", title:"Борфрезы", slug:"borfrezy", query:{} },
  { id:"tapping-arms", title:"Резьбонарезные манипуляторы", slug:"rezbonareznye-manipulyatory", query:{} },
  { id:"welding-carriages", title:"Сварочные каретки", slug:"karetki-svarochnye", query:{} },
  { id:"compressors", title:"Компрессоры", slug:"kompressory", query:{} },
]);

export function getLaunchCoreCatalogReport({ visibleLimit = 12 } = {}) {
  const quality = getCatalogQualityReport();
  const scopes = launchCoreScopes.map((scope) => auditScope(scope, quality, visibleLimit));
  return {
    scopeCount:scopes.length,
    blockingIssueCount:scopes.reduce((sum, scope) => sum + scope.blockers.length, 0),
    warningCount:scopes.reduce((sum, scope) => sum + scope.warnings.length, 0),
    scopes,
  };
}

function auditScope(scope, quality, visibleLimit) {
  const page = getFeedCategoryPage(scope.slug, { ...scope.query, pageSize:Math.max(visibleLimit, 24) });
  const products = page.products.slice(0, visibleLimit);
  const cards = products.map((product) => toFeedProductCardModel(product));
  const productIds = new Set(products.map((product) => product.id));
  const p0Issues = quality.issues.filter((issue) => issue.priority === "p0" && productIds.has(issue.productId));
  const invalidProducts = products.filter((product) => !product.id || !product.slug || !product.title || product.variants.length === 0);
  const cardsWithoutImage = cards.filter((card) => !card.image);
  const cardsWithoutDecisionSpecs = cards.filter((card) => card.specs.length === 0);
  const unsafePrices = cards.filter((card) => !card.price || /(?:^|\s)0(?:[\s ]*₽|\s*$)/u.test(card.price));
  const variantChoices = cards.flatMap((card) => card.variants.map((variant) => ({ card, variant })));
  const productsById = new Map(products.map((product) => [product.id, product]));
  const invalidVariantLinks = variantChoices.filter(({ card, variant }) => {
    const product = productsById.get(card.id);
    const exactVariant = product?.variants.find((candidate) => candidate.id === variant.id);
    return !product || !exactVariant || variant.href !== `${publicProductPath(product, exactVariant)}#variants`;
  });
  const unsupportedTodayPromises = cards.filter((card) => /сегодня/iu.test(card.shippingPromise?.label ?? "") && !card.shippingPromise?.available);
  const profile = getCategoryExpertProfile(scope.slug);
  const blockers = [
    ...(page.total > 0 ? [] : ["В области запуска нет товаров."]),
    ...(invalidProducts.length ? [`${invalidProducts.length} видимых товаров без устойчивой идентичности или исполнений.`] : []),
    ...(p0Issues.length ? [`${p0Issues.length} P0-ошибок идентификации или диапазонов в видимой выдаче.`] : []),
    ...(invalidVariantLinks.length ? [`${invalidVariantLinks.length} ссылок исполнений не ведут на точный variant.`] : []),
    ...(unsupportedTodayPromises.length ? [`${unsupportedTodayPromises.length} неподтверждённых обещаний отгрузки сегодня.`] : []),
    ...(unsafePrices.length ? [`${unsafePrices.length} карточек с небезопасным ценовым состоянием.`] : []),
    ...(profile.criteria?.length >= 3 ? [] : ["Нет минимум трёх критериев принятия решения."]),
  ];
  const warnings = [
    ...(cardsWithoutImage.length ? [`${cardsWithoutImage.length} из ${cards.length} видимых карточек без подтверждённого изображения.`] : []),
    ...(cardsWithoutDecisionSpecs.length ? [`${cardsWithoutDecisionSpecs.length} из ${cards.length} видимых карточек без решающей характеристики.`] : []),
  ];

  return {
    ...scope,
    totalProducts:page.total,
    visibleProducts:cards.length,
    variantChoices:variantChoices.length,
    metrics:{
      imageCoverage:coverage(cards.length - cardsWithoutImage.length, cards.length),
      decisionSpecCoverage:coverage(cards.length - cardsWithoutDecisionSpecs.length, cards.length),
      pricedCardCoverage:coverage(cards.filter((card) => card.price !== "Цена по запросу").length, cards.length),
      exactVariantLinkCoverage:coverage(variantChoices.length - invalidVariantLinks.length, variantChoices.length),
    },
    blockers,
    warnings,
    gaps:{
      missingImages:cardsWithoutImage.map((card) => ({ slug:card.slug, title:card.title })),
      missingDecisionSpecs:cardsWithoutDecisionSpecs.map((card) => ({ slug:card.slug, title:card.title })),
      requestPrices:cards.filter((card) => card.price === "Цена по запросу").map((card) => ({ slug:card.slug, title:card.title })),
    },
    samples:cards.slice(0, 3).map((card) => ({
      slug:card.slug,
      title:card.title,
      price:card.price,
      variantCount:card.variantCount,
      specCount:card.specs.length,
      hasImage:Boolean(card.image),
      shipping:card.shippingPromise?.label ?? "",
    })),
  };
}

function coverage(covered, total) {
  return total > 0 ? Math.round(covered / total * 1000) / 10 : 0;
}
