const PROFILES = Object.freeze({
  MAGNETIC_DRILL_SELECTION: {
    key: "MAGNETIC_DRILL_SELECTION",
    ctaKey: "select_3_magnetic_drills",
    leadType: "equipment_selection",
    eyebrow: "Инженерный подбор",
    title: "Подобрать 3 подходящих станка",
    description: "Укажите задачу и известные ограничения — инженер сопоставит их с доступными моделями.",
    cta: "Подобрать 3 подходящих станка",
    success: "Параметры приняты. Инженер подготовит подходящие варианты.",
    questions: [
      { name: "task", label: "Что нужно выполнить?", placeholder: "Например, отверстие Ø35 мм в стали" },
      { name: "constraints", label: "Какие ограничения важны?", placeholder: "Глубина, масса, питание, условия работы" },
    ],
  },
  EQUIPMENT_SELECTION: {
    key: "EQUIPMENT_SELECTION",
    ctaKey: "select_3_models",
    leadType: "equipment_selection",
    eyebrow: "Инженерный подбор",
    title: "Подобрать 3 подходящие модели",
    description: "Опишите задачу и известные параметры — инженер подготовит короткий список оборудования.",
    cta: "Подобрать 3 подходящие модели",
    success: "Параметры приняты. Инженер подготовит подходящие варианты.",
    questions: [
      { name: "task", label: "Задача", placeholder: "Что и в каких условиях требуется сделать" },
      { name: "constraints", label: "Ключевые параметры", placeholder: "Размер, материал, производительность или ограничения" },
    ],
  },
  CUTTER_SELECTION: {
    key: "CUTTER_SELECTION",
    ctaKey: "select_annular_cutter",
    leadType: "equipment_selection",
    eyebrow: "Подбор оснастки",
    title: "Подобрать корончатое сверло",
    description: "Диаметр, материал и глубина помогут проверить тип коронки и хвостовик.",
    cta: "Подобрать корончатое сверло",
    success: "Параметры приняты. Инженер проверит подходящую коронку и хвостовик.",
    questions: [
      { name: "hole", label: "Отверстие", placeholder: "Диаметр и глубина" },
      { name: "material", label: "Материал и станок", placeholder: "Материал детали и модель станка, если известна" },
    ],
  },
  KIT_CALCULATION: {
    key: "KIT_CALCULATION",
    ctaKey: "calculate_kit",
    leadType: "content_request",
    eyebrow: "Расчёт комплекта",
    title: "Получить расчёт комплекта",
    description: "Соберём оборудование и оснастку под задачу без неподтверждённых замен.",
    cta: "Получить расчёт комплекта",
    success: "Запрос принят. Инженер проверит состав и подготовит расчёт комплекта.",
    questions: [
      { name: "task", label: "Задача или оборудование", placeholder: "Что нужно укомплектовать" },
      { name: "quantity", label: "Количество и срок", placeholder: "Сколько комплектов и когда нужны" },
    ],
  },
  COMPATIBILITY_CHECK: {
    key: "COMPATIBILITY_CHECK",
    ctaKey: "check_compatibility",
    leadType: "content_request",
    eyebrow: "Проверка совместимости",
    title: "Проверить совместимость",
    description: "Укажите обе позиции — инженер сверит подтверждённые характеристики и ограничения.",
    cta: "Проверить совместимость",
    success: "Запрос принят. Инженер проверит совместимость указанных позиций.",
    questions: [
      { name: "equipment", label: "Оборудование", placeholder: "Модель или артикул" },
      { name: "accessory", label: "Оснастка", placeholder: "Модель, размер или хвостовик" },
    ],
  },
  COMMERCIAL_OFFER: {
    key: "COMMERCIAL_OFFER",
    ctaKey: "request_commercial_offer",
    leadType: "content_request",
    eyebrow: "Коммерческое предложение",
    title: "Получить коммерческое предложение",
    description: "Передайте состав запроса — менеджер проверит цены, наличие и сроки поставки.",
    cta: "Получить коммерческое предложение",
    success: "Запрос принят. Менеджер подготовит коммерческое предложение.",
    questions: [
      { name: "request", label: "Что требуется?", placeholder: "Оборудование, оснастка или список позиций" },
      { name: "quantity", label: "Количество и срок", placeholder: "Объём и желаемая дата поставки" },
    ],
  },
});

const EXPLICIT_ALIASES = Object.freeze({
  MAGNETIC_DRILL_SELECTION: "MAGNETIC_DRILL_SELECTION",
  EQUIPMENT_SELECTION: "EQUIPMENT_SELECTION",
  CUTTER_SELECTION: "CUTTER_SELECTION",
  KIT_CALCULATION: "KIT_CALCULATION",
  COMPATIBILITY_CHECK: "COMPATIBILITY_CHECK",
  COMMERCIAL_OFFER: "COMMERCIAL_OFFER",
});

const CTA_KEYS = new Set([
  ...Object.values(PROFILES).map((profile) => profile.ctaKey),
  "contact_form", "cart_quote", "product_quote", "one_click", "price_match",
  "equipment_selection", "landing_quote", "content_request",
]);

function clean(value, max = 200) {
  return typeof value === "string" ? value.trim().replace(/\s+/gu, " ").slice(0, max) : "";
}

export function resolveLeadProfileKey(input = {}) {
  const explicit = EXPLICIT_ALIASES[clean(input.leadFormType, 80).toUpperCase()];
  if (explicit) return explicit;
  const toolType = clean(input.toolType, 80).toUpperCase();
  if (toolType === "COMPATIBILITY_TABLE") return "COMPATIBILITY_CHECK";
  if (toolType === "ANNULAR_CUTTER_RPM") return "KIT_CALCULATION";
  if (toolType === "MAGNETIC_DRILL_SELECTOR") return "MAGNETIC_DRILL_SELECTION";
  if (new Set(["BEVELER_SELECTOR", "PIPE_CUTTER_SELECTOR"]).has(toolType)) return "EQUIPMENT_SELECTION";
  const category = clean(input.categorySlug, 200).toLocaleLowerCase("ru");
  const intent = clean(input.intentClass, 80).toUpperCase();
  if (intent === "COMPATIBILITY") return "COMPATIBILITY_CHECK";
  if (category.includes("koron") || category.includes("сверл")) return "CUTTER_SELECTION";
  if (intent === "SELECTION" && category.includes("stanki-sverlilnye")) return "MAGNETIC_DRILL_SELECTION";
  if (intent === "SELECTION") return "EQUIPMENT_SELECTION";
  return "COMMERCIAL_OFFER";
}

export function isKnownLeadFormType(value) {
  return Boolean(EXPLICIT_ALIASES[clean(value, 80).toUpperCase()]);
}

export function getLeadProfile(input = {}) {
  return PROFILES[resolveLeadProfileKey(input)];
}

export function leadProfileByKey(key) {
  return PROFILES[clean(key, 80).toUpperCase()] ?? PROFILES.COMMERCIAL_OFFER;
}

export function normalizeLeadCtaKey(value, fallback = "content_request") {
  const candidate = clean(value, 100).toLocaleLowerCase("en-US");
  if (CTA_KEYS.has(candidate)) return candidate;
  const safeFallback = clean(fallback, 100).toLocaleLowerCase("en-US");
  return CTA_KEYS.has(safeFallback) ? safeFallback : "content_request";
}

export function deriveLeadSource(input = {}) {
  if (clean(input.yclid, 200)) return "yandex_ads";
  const utmSource = clean(input.utmSource, 200).toLocaleLowerCase("en-US").replace(/[^a-z0-9._-]+/gu, "-");
  if (utmSource) return `utm:${utmSource}`;
  const referrer = clean(input.referrer, 1000);
  if (!referrer) return "direct";
  try {
    const hostname = new URL(referrer).hostname.toLocaleLowerCase("en-US").replace(/^www\./u, "");
    if (!hostname || hostname === "7tool.ru") return "direct";
    if (/(?:^|\.)(?:yandex\.[a-z]+|google\.[a-z]+|bing\.com|mail\.ru)$/u.test(hostname)) return `organic:${hostname}`;
    return `referral:${hostname}`;
  } catch {
    return "direct";
  }
}
