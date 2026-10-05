const MAX_KEYWORDS = 6;
const MAX_KEYWORD_LENGTH = 120;
const MAX_KEYWORDS_LENGTH = 420;

type KeywordValue = string | null | undefined | false;

const categoryCoreTerms: Readonly<Record<string, readonly string[]>> = {
  "stanki-sverlilnye":["сверлильные станки по металлу", "сверлильные станки", "промышленные сверлильные станки", "станки для сверления металла"],
  "koronchatye-sverla":["корончатые свёрла по металлу", "корончатые свёрла", "кольцевые фрезы по металлу", "свёрла кольцевого типа"],
  "kromkorezy-po-listu":["кромкорезы для листового металла", "кромкорезы по листу", "фаскосниматели для листового металла", "оборудование для снятия фаски с листа"],
  "kromkorezy-dlya-trub":["фаскосниматели для труб", "кромкорезы для труб", "оборудование для снятия фаски с труб", "торцеватели труб"],
  "rezbonareznye-manipulyatory":["резьбонарезные манипуляторы", "машины для нарезания резьбы", "резьбонарезное оборудование", "манипуляторы для метчиков"],
  borfrezy:["твердосплавные борфрезы по металлу", "борфрезы", "шарошки твердосплавные", "ротационные напильники"],
  truborezy:["промышленные труборезы", "машины для резки труб", "оборудование для резки труб", "труборезные машины"],
  "karetki-svarochnye":["сварочные каретки", "сварочные тракторы", "каретки для автоматической сварки", "оборудование для механизации сварки"],
  "pilnye-diski":["пильные диски по металлу", "диски для резки металла", "дисковые пилы по металлу", "отрезные пильные диски"],
  "karetki-termicheskoy-rezki":["каретки термической резки", "каретки газовой резки", "машины термической резки", "оборудование для автоматической резки металла"],
  metchiki:["метчики для нарезания резьбы", "метчики по металлу", "машинные метчики", "резьбонарезной инструмент"],
  "lentochnopilnye-stanki":["ленточнопильные станки по металлу", "ленточные пилы по металлу", "станки для резки металла", "промышленные ленточнопильные станки"],
  "shlifovalnoe-i-zatochnoe-oborudovanie":["шлифовальное оборудование", "заточное оборудование", "шлифовальные и заточные станки", "оборудование для заточки инструмента"],
  "magnitnaya-osnastka":["магнитная оснастка", "магнитная оснастка для сварки", "магнитные приспособления для металлообработки", "магнитные угольники"],
  "almaznoe-burenie":["оборудование для алмазного бурения", "установки алмазного бурения", "алмазные коронки", "машины алмазного сверления"],
  "svarochnye-vrashchateli-i-pozitsionery":["сварочные вращатели", "сварочные позиционеры", "оборудование для вращения заготовок", "позиционеры для сварки"],
  "zahvaty-dlya-gruzov":["захваты для грузов", "магнитные захваты", "механические захваты", "грузозахватные приспособления"],
  "sozh-i-sots":["СОЖ для металлообработки", "смазочно-охлаждающие жидкости", "смазочно-охлаждающие технологические средства", "охлаждающие жидкости для станков"],
  "disko-otreznye-stanki":["дисковые отрезные станки по металлу", "дисковые пилы для металла", "отрезные станки", "станки для резки металла диском"],
  kompressory:["промышленные воздушные компрессоры", "воздушные компрессоры", "компрессорное оборудование", "компрессоры для производства"],
  "sverla-i-zenkovki":["свёрла по металлу", "зенковки по металлу", "свёрла и зенковки", "металлорежущий инструмент"],
  "stanki-lazernoy-rezki":["станки лазерной резки", "лазерные станки по металлу", "оборудование лазерной резки", "лазерные металлорежущие станки"],
  "svarochnye-roboty":["сварочные роботы", "роботизированная сварка", "роботизированные сварочные комплексы", "промышленные роботы для сварки"],
  "stanochnaya-osnastka":["станочная оснастка", "оснастка для металлообрабатывающих станков", "приспособления для станков", "инструментальная оснастка"],
};

export function normalizeSeoKeywords(values: readonly KeywordValue[]): string[] {
  const result: string[] = [];
  const identities = new Set<string>();
  let totalLength = 0;

  for (const value of values) {
    if (typeof value !== "string") continue;
    const keyword = value
      .normalize("NFKC")
      .replace(/[\u0000-\u001f\u007f]+/gu, " ")
      .replace(/[,;|]+/gu, " ")
      .replace(/\s+/gu, " ")
      .trim();
    if (keyword.length < 2 || keyword.length > MAX_KEYWORD_LENGTH) continue;
    const identity = keyword.toLocaleLowerCase("ru-RU").replace(/ё/gu, "е");
    if (identities.has(identity)) continue;
    const nextTotalLength = totalLength + keyword.length + (result.length > 0 ? 2 : 0);
    if (result.length >= MAX_KEYWORDS || nextTotalLength > MAX_KEYWORDS_LENGTH) break;
    identities.add(identity);
    result.push(keyword);
    totalLength = nextTotalLength;
  }

  return result;
}

export function buildCategorySeoKeywords({
  slug,
  title,
  h1,
}: {
  slug: string;
  title?: string;
  h1?: string;
}): string[] {
  const primary = cleanLabel(h1) || cleanLabel(title);
  const coreTerms = categoryCoreTerms[slug] ?? [primary, cleanLabel(title)];
  return normalizeSeoKeywords([
    ...coreTerms,
    primary && `купить ${primary.toLocaleLowerCase("ru-RU")}`,
    primary && `${primary.toLocaleLowerCase("ru-RU")} цена`,
  ]);
}

export function buildSubcategorySeoKeywords({
  title,
  h1,
}: {
  title?: string;
  h1?: string;
}): string[] {
  const primary = cleanLabel(h1) || cleanLabel(title);
  const secondary = cleanLabel(title);
  return normalizeSeoKeywords([
    primary,
    secondary,
    primary && `купить ${primary.toLocaleLowerCase("ru-RU")}`,
    primary && `${primary.toLocaleLowerCase("ru-RU")} цена`,
  ]);
}

export function buildBrandSeoKeywords({
  brand,
  categories = [],
}: {
  brand?: string;
  categories?: readonly string[];
}): string[] {
  const cleanBrand = cleanLabel(brand);
  if (!cleanBrand || cleanBrand === "—") return [];
  return normalizeSeoKeywords([
    cleanBrand,
    `${cleanBrand} купить`,
    `оборудование ${cleanBrand}`,
    `инструмент ${cleanBrand}`,
    ...categories.slice(0, 2).map((category) => `${cleanLabel(category)} ${cleanBrand}`),
  ]);
}

export function buildProductSeoKeywords({
  title,
  brand,
  sku,
  variant,
}: {
  title?: string;
  brand?: string;
  sku?: string;
  variant?: string;
}): string[] {
  const cleanTitle = cleanLabel(title);
  const cleanBrand = cleanLabel(brand);
  const cleanSku = cleanLabel(sku);
  const cleanVariant = cleanLabel(variant);
  return normalizeSeoKeywords([
    cleanTitle,
    cleanBrand && cleanSku && `${cleanBrand} ${cleanSku}`,
    cleanSku,
    cleanTitle && cleanVariant && `${cleanTitle} ${cleanVariant}`,
    cleanTitle && `купить ${cleanTitle.toLocaleLowerCase("ru-RU")}`,
    cleanTitle && `${cleanTitle.toLocaleLowerCase("ru-RU")} цена`,
  ]);
}

export function buildTaskSeoKeywords({
  title,
  categories = [],
}: {
  title?: string;
  categories?: readonly string[];
}): string[] {
  const cleanTitle = cleanLabel(title);
  return normalizeSeoKeywords([
    cleanTitle,
    cleanTitle && `${cleanTitle} оборудование`,
    ...categories.slice(0, 4).map(cleanLabel),
  ]);
}

function cleanLabel(value: string | undefined): string {
  return String(value ?? "").replace(/\s+/gu, " ").trim();
}
