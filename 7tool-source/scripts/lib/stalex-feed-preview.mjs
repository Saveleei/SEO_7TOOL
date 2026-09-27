import { decodeSupplierXml } from "./supplier-feed-parser.mjs";

const CONTACT_PATTERNS = [
  /(?:\+7|8)[\s()\-\d]{9,}/gu,
  /[\w.+-]+@(?:stalex|stm-ru)\.ru/giu,
  /https?:\/\/(?:www\.)?(?:stalex|stm-ru)\.ru\S*/giu,
  /(?:www\.)?(?:stalex|stm-ru)\.ru\S*/giu,
];

const SUPPLIER_PROMO_PATTERNS = [
  /ООО\s*[«"]?СТМ[»"]?/iu,
  /предлагает\s+купить/iu,
  /интернет[- ]магазин(?:е|а)?\s+STALEX/iu,
  /уточнить[^.]{0,160}(?:по телефону|можно по телефону)/iu,
];

const STOCK_PRESENT_ENUM = "f098c6a4e2a55abe1d1e19e26c21de84";
const WARRANTY_PROPERTY_ID = "449";
const RUB_PRICE_PROPERTY_ID = "184";
const OLD_PRICE_PROPERTY_ID = "200";
const STOCK_PROPERTY_ID = "171";
const STOCK_ENUM_PROPERTY_ID = "13";

function capture(body, tagName) {
  const match = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, "iu").exec(body);
  return match ? decodeSupplierXml(match[1]).trim() : "";
}

function finiteNumber(value) {
  const normalized = String(value ?? "").trim().replace(/\s+/gu, "").replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function booleanValue(value) {
  return String(value ?? "").trim().toLocaleLowerCase("ru") === "true";
}

function textOnly(value) {
  return decodeSupplierXml(String(value ?? ""))
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, " ")
    .replace(/<[^>]+>/gu, " ")
    .replace(/\u00a0/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

export function findSupplierContactLeaks(value) {
  const text = textOnly(value);
  const leaks = [];
  for (const pattern of CONTACT_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) leaks.push(match[0].trim());
  }
  for (const pattern of SUPPLIER_PROMO_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) leaks.push(`supplier-promo:${pattern.source}`);
  }
  return [...new Set(leaks)];
}

export function sanitizeStalexDescription(value) {
  let text = textOnly(value);
  for (const pattern of CONTACT_PATTERNS) {
    pattern.lastIndex = 0;
    text = text.replace(pattern, " ");
  }
  const sentences = text
    .split(/(?<=[.!?])\s+|\s*[\r\n]+\s*/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .filter((sentence) => !SUPPLIER_PROMO_PATTERNS.some((pattern) => {
      pattern.lastIndex = 0;
      return pattern.test(sentence);
    }));
  return sentences.join(" ").replace(/\s+/gu, " ").trim();
}

export function parseCommerceProperties(body) {
  const properties = new Map();
  for (const match of body.matchAll(/<ЗначенияСвойства(?:\s[^>]*)?>([\s\S]*?)<\/ЗначенияСвойства>/giu)) {
    const propertyBody = match[1];
    const id = capture(propertyBody, "Ид");
    if (!id) continue;
    const value = capture(propertyBody, "Значение");
    if (!properties.has(id)) properties.set(id, value);
  }
  return properties;
}

export function parseCommercePropertyDefinitions(xml) {
  const definitions = new Map();
  for (const match of xml.matchAll(/<Свойство(?:\s[^>]*)?>([\s\S]*?)<\/Свойство>/giu)) {
    const body = match[1];
    const id = capture(body, "Ид");
    if (!id || definitions.has(id)) continue;
    const values = new Map();
    for (const option of body.matchAll(/<Вариант(?:\s[^>]*)?>([\s\S]*?)<\/Вариант>/giu)) {
      const optionId = capture(option[1], "Ид");
      const optionValue = capture(option[1], "Значение");
      if (optionId) values.set(optionId, optionValue);
    }
    definitions.set(id, {
      id,
      name: capture(body, "Наименование"),
      code: capture(body, "БитриксКод"),
      values,
    });
  }
  return definitions;
}

export function parseCommerceGroups(xml) {
  const classifierStart = xml.indexOf("<Классификатор>");
  const classifierEnd = xml.indexOf("</Классификатор>", classifierStart);
  if (classifierStart < 0 || classifierEnd < 0) return [];
  const classifier = xml.slice(classifierStart, classifierEnd);
  const groupsStart = classifier.indexOf("<Группы>");
  const groupsEnd = classifier.lastIndexOf("</Группы>");
  if (groupsStart < 0 || groupsEnd < 0 || groupsEnd <= groupsStart) return [];
  const source = classifier.slice(groupsStart, groupsEnd + "</Группы>".length);
  const groups = [];
  const stack = [];
  const tokens = /<Группа(?:\s[^>]*)?>|<\/Группа>|<Ид(?:\s[^>]*)?>([\s\S]*?)<\/Ид>|<Наименование(?:\s[^>]*)?>([\s\S]*?)<\/Наименование>/giu;
  for (const token of source.matchAll(tokens)) {
    if (token[0].startsWith("<Группа")) {
      stack.push({ id: "", name: "", parentId: stack.at(-1)?.id || null, depth: stack.length });
      continue;
    }
    if (token[0] === "</Группа>") {
      const group = stack.pop();
      if (group?.id && group.name) groups.push(group);
      continue;
    }
    const current = stack.at(-1);
    if (!current) continue;
    if (token[1] !== undefined && !current.id) current.id = decodeSupplierXml(token[1]).trim();
    if (token[2] !== undefined && !current.name) current.name = decodeSupplierXml(token[2]).trim();
  }
  return groups;
}

export function parseCommerceOffers(xml) {
  const offers = [];
  for (const match of xml.matchAll(/<Предложение(?:\s[^>]*)?>([\s\S]*?)<\/Предложение>/giu)) {
    const body = match[1];
    const id = capture(body, "Ид");
    if (!id) continue;
    const groupBody = capture(body, "Группы");
    const groupIds = [...groupBody.matchAll(/<Ид(?:\s[^>]*)?>([\s\S]*?)<\/Ид>/giu)]
      .map((group) => decodeSupplierXml(group[1]).trim())
      .filter(Boolean);
    const properties = parseCommerceProperties(body);
    const preview = properties.get("CML2_PREVIEW_TEXT") || "";
    const detail = properties.get("CML2_DETAIL_TEXT") || "";
    const rawDescription = detail || preview;
    offers.push({
      id,
      name: capture(body, "Наименование"),
      groupIds,
      image: capture(body, "Картинка"),
      active: booleanValue(properties.get("CML2_ACTIVE")),
      properties,
      rawDescription,
      description: sanitizeStalexDescription(rawDescription),
      contactLeaks: findSupplierContactLeaks(rawDescription),
      quantity: finiteNumber(capture(body, "Количество")),
      basePrice: finiteNumber(capture(body, "ЦенаЗаЕдиницу")),
      baseCurrency: capture(body, "Валюта"),
    });
  }
  return offers;
}

function enumValue(definitions, propertyId, rawValue) {
  if (!rawValue) return null;
  return definitions.get(propertyId)?.values.get(rawValue) || rawValue;
}

function topGroup(groupId, groupById) {
  let current = groupById.get(groupId);
  const visited = new Set();
  while (current?.parentId && !visited.has(current.id)) {
    visited.add(current.id);
    current = groupById.get(current.parentId) || current;
    if (!current.parentId) break;
  }
  return current || null;
}

function categoryFor(catalogOffer, groupById, policy) {
  const topGroups = [];
  for (const groupId of catalogOffer?.groupIds || []) {
    const group = topGroup(groupId, groupById);
    if (group && !topGroups.some((candidate) => candidate.id === group.id)) topGroups.push(group);
  }
  const evaluated = topGroups.map((group) => ({
    id: group.id,
    name: group.name,
    ...(policy.topGroups?.[group.name] || { decision: "unmapped", rollout: "blocked" }),
  }));
  const functional = evaluated.filter((item) => item.decision !== "attribute-only");
  const chosen = functional[0] || evaluated[0] || { decision: "unmapped", rollout: "blocked", name: "Без категории" };
  return { chosen, topGroups: evaluated };
}

function availabilityFor(modification) {
  const stock = finiteNumber(modification.properties.get(STOCK_PROPERTY_ID));
  const quantity = modification.quantity;
  const enumPresent = modification.properties.get(STOCK_ENUM_PROPERTY_ID) === STOCK_PRESENT_ENUM;
  if ((stock ?? 0) > 0 && (quantity ?? 0) > 0) {
    return {
      code: "supplier-stock-confirm",
      label: "На складе поставщика · дату отгрузки подтвердим",
      stock,
      quantity,
      enumPresent,
      canPromiseToday: false,
    };
  }
  return {
    code: "lead-time-request",
    label: "Под заказ · срок уточним",
    stock,
    quantity,
    enumPresent,
    canPromiseToday: false,
  };
}

function issue(code, severity, message) {
  return { code, severity, message };
}

function countBy(items, selector) {
  const result = {};
  for (const item of items) {
    const key = selector(item) || "unknown";
    result[key] = (result[key] || 0) + 1;
  }
  return result;
}

export function buildStalexPreview({ catalogXml, modificationsXml, policy }) {
  if (!policy || policy.publicationEnabled !== false) {
    throw new Error("Stalex preview policy must explicitly disable publication");
  }
  const catalogDefinitions = parseCommercePropertyDefinitions(catalogXml);
  const modificationDefinitions = parseCommercePropertyDefinitions(modificationsXml);
  const groups = parseCommerceGroups(catalogXml);
  const groupById = new Map(groups.map((group) => [group.id, group]));
  const catalogOffers = parseCommerceOffers(catalogXml);
  const modifications = parseCommerceOffers(modificationsXml);
  const catalogById = new Map(catalogOffers.map((offer) => [offer.id, offer]));

  const records = modifications.map((modification) => {
    const linkId = modification.properties.get("CML2_LINK") || modification.id;
    const catalogOffer = catalogById.get(linkId) || null;
    const category = categoryFor(catalogOffer, groupById, policy);
    const priceRub = finiteNumber(modification.properties.get(RUB_PRICE_PROPERTY_ID));
    const oldPriceRub = finiteNumber(modification.properties.get(OLD_PRICE_PROPERTY_ID));
    const sourceWarranty = enumValue(catalogDefinitions, WARRANTY_PROPERTY_ID, catalogOffer?.properties.get(WARRANTY_PROPERTY_ID));
    const warrantyOverrideMonths = finiteNumber(policy.commercialGate?.warrantyOverrideMonths);
    const warranty = warrantyOverrideMonths ? `${warrantyOverrideMonths} месяцев` : sourceWarranty;
    const availability = availabilityFor(modification);
    const issues = [];
    if (!catalogOffer) issues.push(issue("MISSING_CATALOG_LINK", "P0", "Модификация не связана с полной карточкой товара."));
    if (!modification.active) issues.push(issue("INACTIVE_MODIFICATION", "P0", "Модификация неактивна в источнике."));
    if (!priceRub || priceRub <= 0) issues.push(issue("MISSING_RUB_PRICE", "P0", "Нет положительной розничной цены в рублях."));
    if (category.chosen.decision === "unmapped") issues.push(issue("UNMAPPED_TOP_GROUP", "P0", "Раздел поставщика не сопоставлен с каталогом 7TOOL."));
    if (category.chosen.decision === "review-later") issues.push(issue("CATEGORY_REQUIRES_REVIEW", "P1", "Направление отложено до экспертной настройки категории."));
    if (!catalogOffer?.image) issues.push(issue("MISSING_IMAGE", "P1", "У полной карточки отсутствует основное изображение."));
    if (!warranty) issues.push(issue("WARRANTY_UNRESOLVED", "P1", "Гарантия для модели не определена."));
    if (warrantyOverrideMonths && sourceWarranty !== warranty) {
      issues.push(issue("SOURCE_WARRANTY_OVERRIDDEN", "P2", `Исходное значение «${sourceWarranty || "не указано"}» заменено подтверждённым правилом 7TOOL: ${warranty}.`));
    }
    if (catalogOffer?.contactLeaks.length) issues.push(issue("SUPPLIER_CONTACT_IN_COPY", "P0", "Описание содержит контакты или продающий текст поставщика."));
    if (modification.baseCurrency && modification.baseCurrency !== "RUB") {
      issues.push(issue("NON_RUB_BASE_PRICE", "P1", `Базовое поле цены имеет валюту ${modification.baseCurrency}; используется только отдельное рублёвое поле.`));
    }
    if (availability.enumPresent && !((availability.stock ?? 0) > 0 && (availability.quantity ?? 0) > 0)) {
      issues.push(issue("STOCK_SIGNAL_CONFLICT", "P1", "Текстовый статус «есть» не подтверждён положительным числовым остатком."));
    }
    const dataPilotReady = !issues.some((current) => current.severity === "P0")
      && category.chosen.decision === "existing-category"
      && category.chosen.rollout === "P0";
    return {
      id: modification.id,
      catalogId: linkId,
      sku: modification.properties.get("22") || modification.properties.get("166") || null,
      name: modification.name || catalogOffer?.name || "",
      active: modification.active,
      priceRub,
      oldPriceRub: oldPriceRub && oldPriceRub > priceRub ? oldPriceRub : null,
      availability,
      warranty,
      sourceWarranty,
      warrantyOverrideApplied: Boolean(warrantyOverrideMonths && sourceWarranty !== warranty),
      image: catalogOffer?.image || null,
      category,
      descriptionPreview: catalogOffer?.description.slice(0, 320) || "",
      issues,
      dataPilotReady,
      storefrontPublishable: false,
    };
  });

  const issueCounts = {};
  for (const record of records) {
    for (const current of record.issues) issueCounts[current.code] = (issueCounts[current.code] || 0) + 1;
  }
  const categoryRows = new Map();
  for (const record of records) {
    const key = record.category.chosen.name;
    const row = categoryRows.get(key) || {
      sourceCategory: key,
      decision: record.category.chosen.decision,
      targetSlug: record.category.chosen.targetSlug || null,
      proposedSlug: record.category.chosen.proposedSlug || null,
      rollout: record.category.chosen.rollout,
      modifications: 0,
      dataPilotReady: 0,
    };
    row.modifications += 1;
    if (record.dataPilotReady) row.dataPilotReady += 1;
    categoryRows.set(key, row);
  }

  const feedWarrantyValues = countBy(records, (record) => record.sourceWarranty || "unresolved");
  const effectiveWarrantyValues = countBy(records, (record) => record.warranty || "unresolved");
  const warrantyOverrideMonths = finiteNumber(policy.commercialGate?.warrantyOverrideMonths);

  return {
    mode: "preview-only",
    publicationEnabled: false,
    generatedAt: new Date().toISOString(),
    commercialGate: {
      ready: false,
      requiredConfirmations: policy.commercialGate?.requiredConfirmations || [],
      warrantyConflict: false,
      warrantyOverrideMonths,
      warrantyOverrideSource: policy.commercialGate?.warrantyOverrideSource || null,
      feedWarrantyValues,
      effectiveWarrantyValues,
    },
    summary: {
      catalogOffers: catalogOffers.length,
      activeCatalogOffers: catalogOffers.filter((offer) => offer.active).length,
      modifications: modifications.length,
      activeModifications: modifications.filter((offer) => offer.active).length,
      groups: groups.length,
      topGroups: groups.filter((group) => !group.parentId).length,
      withRublePrice: records.filter((record) => (record.priceRub ?? 0) > 0).length,
      supplierStockConfirmed: records.filter((record) => record.availability.code === "supplier-stock-confirm").length,
      missingCatalogLinks: records.filter((record) => record.issues.some((current) => current.code === "MISSING_CATALOG_LINK")).length,
      dataPilotReady: records.filter((record) => record.dataPilotReady).length,
      storefrontPublishable: 0,
      issueCounts,
    },
    categories: [...categoryRows.values()].sort((a, b) => {
      const rollout = String(a.rollout).localeCompare(String(b.rollout), "ru");
      return rollout || a.sourceCategory.localeCompare(b.sourceCategory, "ru");
    }),
    samples: {
      ready: records.filter((record) => record.dataPilotReady).slice(0, 20),
      blocked: records.filter((record) => record.issues.some((current) => current.severity === "P0")).slice(0, 30),
    },
    sourceSchema: {
      catalogProperties: catalogDefinitions.size,
      modificationProperties: modificationDefinitions.size,
    },
  };
}
