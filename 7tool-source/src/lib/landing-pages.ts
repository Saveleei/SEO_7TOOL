import type { Product, ProductParam } from "./catalog";
import type { SelectionField } from "./category-content";
import { contentForCategory } from "./category-content";
import { categories } from "./data";
import { allSubcategoryDefinitions, matchesSubcategory } from "./subcategories";

export type LandingScenario = "product" | "solution";

export type LandingQuickTask = {
  label: string;
  questionName?: string;
  value: string;
};

export type LandingIntent = {
  slug: string;
  label: string;
  h1: string;
  offer: string;
  description: string;
  scenario: LandingScenario;
  advantages: string[];
  questions: SelectionField[];
  faq: Array<{ question: string; answer: string }>;
  subcategorySlug?: string;
  matches?: string[];
  requiredParams?: string[];
  quickTasks?: LandingQuickTask[];
  metaTitle?: string;
  metaDescription?: string;
  keywords?: string[];
  seoHeading?: string;
  seoText?: string[];
};

export type LandingCategory = {
  slug: string;
  active: boolean;
  label: string;
  defaultIntent: string;
  intents: LandingIntent[];
};

export type LandingSeoAction = "CREATE" | "KEEP" | "MERGE" | "NOINDEX" | "CANONICALIZE" | "REJECT";
export type LandingSeoDecision = {
  action: LandingSeoAction;
  indexable: boolean;
  canonicalPath: string;
  reason: string;
};

// Индексация включается только после ручной проверки независимого спроса,
// контента и SERP-intent. Пустой allowlist — безопасное исходное состояние.
const REVIEWED_INDEXABLE_LANDINGS = new Set<string>();

const unknown = "Не знаю — нужна помощь инженера";
const commonFaq = [
  {
    question: "Цены и наличие на странице актуальны?",
    answer: "Карточки формируются из каталога 7TOOL. Перед выставлением счёта менеджер подтверждает конкретный вариант, остаток и срок поставки.",
  },
  {
    question: "Где находится товар и когда его отгрузят?",
    answer: "Товары в наличии находятся на складах в Москве и Санкт-Петербурге. После поступления оплаты отгружаем в тот же день транспортной компанией или нашей машиной.",
  },
  {
    question: "Какие документы входят в поставку?",
    answer: "Полный пакет: счёт-фактура с НДС, паспорт изделия, сертификат ТР ТС, при необходимости — оригинал сертификата производителя. Документы отправляем оригиналом по почте или ЭДО.",
  },
  {
    question: "Как убедиться, что модель подойдёт под задачу?",
    answer: "Инженер сверит рабочие параметры, материал, режим эксплуатации и совместимость оснастки. В предложение включим только подходящие варианты и отдельно отметим различия.",
  },
  {
    question: "Можно получить несколько вариантов для сравнения?",
    answer: "Да. Подготовим 3–5 моделей в разных ценовых диапазонах, укажем ключевые характеристики, наличие, срок поставки и комплектацию.",
  },
  {
    question: "Как доставляете оборудование по России?",
    answer: "Отправляем проверенными транспортными компаниями, а по согласованным направлениям — нашей машиной. Способ, стоимость и срок доставки фиксируем до оплаты.",
  },
];

const coreLandingCategories: LandingCategory[] = [
  {
    slug: "stanki-sverlilnye",
    active: true,
    label: "Сверлильные станки",
    defaultIntent: "magnitnye",
    intents: [
      {
        slug: "magnitnye",
        label: "Магнитные станки",
        h1: "Магнитные сверлильные станки по металлу",
        offer: "Подберём станок под диаметр, глубину отверстия и режим работы",
        description: "Сравните реальные модели, цены с НДС и доступность. Ответьте на три технических вопроса — инженер подготовит подходящие варианты.",
        scenario: "product",
        advantages: ["Актуальные варианты из каталога", "Проверка совместимости со сверлом и хвостовиком", "Поставка по России"],
        questions: [
          { name: "diameter", label: "Максимальный диаметр", placeholder: "Например, 35 мм" },
          { name: "depth", label: "Глубина сверления", placeholder: "Например, 50 мм" },
          { name: "operation", label: "Операция", options: ["Корончатое сверление", "Спиральное сверление", "Нарезание резьбы", unknown] },
        ],
        faq: commonFaq,
        subcategorySlug: "magnitnye",
      },
      {
        slug: "bezshchetochnye",
        label: "Безщёточные станки",
        h1: "Безщёточные магнитные сверлильные станки",
        offer: "Подбор безщёточного станка для интенсивной работы по металлу",
        description: "Соберём предложение по мощности, диаметру сверления и необходимым режимам без привязки к одному бренду.",
        scenario: "solution",
        advantages: ["Сравнение по техническим параметрам", "Проверка комплектации", "Цены для юридических лиц с НДС"],
        questions: [
          { name: "diameter", label: "Максимальный диаметр", placeholder: "мм" },
          { name: "load", label: "Режим работы", options: ["Периодически", "Каждую смену", "Серийная работа", unknown] },
          { name: "thread", label: "Нужен реверс/резьбонарезание?", options: ["Да", "Нет", unknown] },
        ],
        faq: commonFaq,
        subcategorySlug: "beschetochnye",
      },
    ],
  },
  {
    slug: "koronchatye-sverla",
    active: true,
    label: "Корончатые свёрла",
    defaultIntent: "hss",
    intents: [
      {
        slug: "hss",
        label: "HSS",
        h1: "Корончатые свёрла HSS по металлу",
        offer: "Подберём сверло по диаметру, глубине и материалу заготовки",
        description: "В выдаче — реальные серии и размеры из каталога. Менеджер проверит совместимость хвостовика и направляющего штифта.",
        scenario: "product",
        advantages: ["Размеры из актуального каталога", "Подбор под станок", "Счёт с НДС"],
        questions: [
          { name: "diameter", label: "Диаметр отверстия", placeholder: "мм" },
          { name: "depth", label: "Рабочая глубина", placeholder: "мм" },
          { name: "material", label: "Материал", options: ["Конструкционная сталь", "Нержавеющая сталь", "Алюминий", unknown] },
        ],
        faq: [
          { question: "Чем HSS-сверло отличается от TCT?", answer: "HSS — универсальный и ремонтопригодный вариант для широкого круга сталей. TCT чаще выбирают для высокой производительности и сложных материалов. Инженер сопоставит материал, станок и режим работы." },
          { question: "Какие параметры нужны для подбора HSS-сверла?", answer: "Достаточно указать диаметр и глубину отверстия, материал заготовки и, если известна, модель магнитного станка. Мы также проверим хвостовик и направляющий штифт." },
          ...commonFaq,
        ],
        subcategorySlug: "hss",
        quickTasks: [
          { label: "Для конструкционной стали", questionName: "material", value: "Конструкционная сталь" },
          { label: "Для нержавеющей стали", questionName: "material", value: "Нержавеющая сталь" },
          { label: "Для алюминия", questionName: "material", value: "Алюминий" },
          { label: "Нужен аналог имеющегося сверла", value: "Нужен аналог имеющегося сверла HSS" },
        ],
        metaTitle: "Корончатые свёрла HSS по металлу — купить",
        metaDescription: "Корончатые свёрла HSS для магнитных станков: подбор по диаметру, рабочей глубине, хвостовику и материалу. Цены с НДС, наличие, доставка по России.",
        keywords: ["корончатые свёрла HSS", "кольцевые фрезы HSS", "корончатое сверло HSS по металлу", "сверло HSS Weldon 19", "корончатые свёрла для магнитного станка"],
        seoHeading: "Как выбрать корончатое сверло HSS",
        seoText: [
          "Корончатые свёрла HSS применяют на магнитных сверлильных станках для получения отверстий в конструкционной и нержавеющей стали, алюминии и других металлах. При подборе важны диаметр, рабочая глубина, тип хвостовика и мощность станка.",
          "Для серийной работы дополнительно учитывают марку быстрорежущей стали, геометрию зубьев, необходимость покрытия и подачу охлаждающей жидкости. Инженер 7TOOL проверит совместимость сверла, направляющего штифта и станка до выставления счёта.",
        ],
      },
      {
        slug: "tct",
        label: "Твердосплавные TCT",
        h1: "Твердосплавные корончатые свёрла TCT",
        offer: "Подбор твердосплавной коронки под материал и режим обработки",
        description: "Сравним доступные диаметры и глубины, проверим хвостовик и подготовим предложение по подходящим сериям.",
        scenario: "product",
        advantages: ["Подбор по материалу", "Контроль совместимости", "Доставка по России"],
        questions: [
          { name: "diameter", label: "Диаметр отверстия", placeholder: "мм" },
          { name: "depth", label: "Глубина", placeholder: "мм" },
          { name: "material", label: "Материал", options: ["Конструкционная сталь", "Нержавеющая сталь", "Чугун", "Рельсовая сталь", "Слоистый материал", unknown] },
        ],
        faq: [
          { question: "Когда выбирают твердосплавное сверло TCT?", answer: "TCT выбирают для производительного сверления твёрдых, абразивных и сложных материалов. Окончательный выбор зависит от марки материала, жёсткости установки и режима резания." },
          { question: "Подойдёт ли TCT-сверло к моему магнитному станку?", answer: "Проверим тип хвостовика, допустимый диаметр, рабочую глубину, мощность и обороты станка, а также подберём направляющий штифт и охлаждение." },
          ...commonFaq,
        ],
        subcategorySlug: "tct",
        quickTasks: [
          { label: "Для конструкционной стали", questionName: "material", value: "Конструкционная сталь" },
          { label: "Для нержавеющей стали", questionName: "material", value: "Нержавеющая сталь" },
          { label: "Для рельсовой стали", questionName: "material", value: "Рельсовая сталь" },
          { label: "Для слоистого материала", questionName: "material", value: "Слоистый материал" },
        ],
        metaTitle: "Твердосплавные корончатые свёрла TCT — купить",
        metaDescription: "Корончатые свёрла TCT с твердосплавными напайками для магнитных станков. Подбор по материалу, диаметру и глубине, цены с НДС и доставка по России.",
        keywords: ["корончатые свёрла TCT", "твердосплавные корончатые свёрла", "кольцевая фреза TCT", "корончатое сверло с твердосплавными напайками", "TCT сверло для магнитного станка"],
        seoHeading: "Подбор твердосплавных корончатых свёрл TCT",
        seoText: [
          "Корончатые свёрла TCT оснащены твердосплавными напайками и предназначены для производительного сверления сталей и других материалов, где важны стойкость режущей части и стабильная скорость обработки. Выбор начинается с материала заготовки, диаметра и требуемой глубины отверстия.",
          "До заказа нужно сверить хвостовик с посадкой магнитного станка, рабочий диапазон машины, обороты и подачу охлаждения. Для рельсовой стали, слоистых и нестандартных материалов режим и серию сверла подтверждает инженер.",
        ],
      },
    ],
  },
  {
    slug: "borfrezy",
    active: true,
    label: "Борфрезы",
    defaultIntent: "po-materialu",
    intents: [
      {
        slug: "po-materialu",
        label: "По материалу",
        h1: "Твердосплавные борфрезы по металлу",
        offer: "Подберём насечку под сталь, нержавейку, чугун или алюминий",
        description: "Укажите материал, операцию и форму — получите релевантные позиции с актуальными ценами и остатками.",
        scenario: "product",
        advantages: ["Формы и насечки из реального каталога", "Подбор под материал", "Оплата по счёту с НДС"],
        questions: [
          { name: "material", label: "Материал", options: ["Сталь", "Нержавеющая сталь", "Чугун", "Алюминий", unknown] },
          { name: "operation", label: "Операция", options: ["Снять заусенцы", "Обработать кромку", "Зачистить сварной шов", "Выбрать материал", unknown] },
          { name: "tool", label: "Инструмент", options: ["Прямошлифовальная машина", "Пневмоинструмент", "Ручная машинка", unknown] },
        ],
        faq: commonFaq,
      },
      {
        slug: "po-forme",
        label: "По форме",
        h1: "Борфрезы разных форм для обработки металла",
        offer: "Подбор геометрии головки под участок обработки",
        description: "Сопоставим форму, диаметр головки и насечку с вашей операцией и материалом детали.",
        scenario: "solution",
        advantages: ["Формы A–N", "Подбор диаметра и хвостовика", "Проверка доступности"],
        questions: [
          { name: "shape", label: "Нужная форма", options: ["Цилиндр", "Сфера", "Овал", "Конус", unknown] },
          { name: "head", label: "Диаметр головки", placeholder: "мм" },
          { name: "material", label: "Материал", options: ["Сталь", "Нержавеющая сталь", "Чугун", "Алюминий", unknown] },
        ],
        faq: commonFaq,
      },
    ],
  },
  {
    slug: "kromkorezy-po-listu",
    active: true,
    label: "Кромкорезы по листу",
    defaultIntent: "mobilnye",
    intents: [
      {
        slug: "mobilnye",
        label: "Мобильные",
        h1: "Мобильные кромкорезы для листового металла",
        offer: "Подбор машины под ширину, угол фаски и толщину листа",
        description: "Сравним переносные модели по режиму работы, приводу и доступной геометрии фаски.",
        scenario: "solution",
        advantages: ["Подбор по параметрам фаски", "Проверка оснастки", "Коммерческое предложение с НДС"],
        questions: [
          { name: "thickness", label: "Толщина листа", placeholder: "мм" },
          { name: "bevel", label: "Ширина фаски", placeholder: "мм" },
          { name: "angle", label: "Угол фаски", placeholder: "градусы" },
        ],
        faq: commonFaq,
        subcategorySlug: "mobilnye",
      },
      {
        slug: "avtomaticheskie",
        label: "Автоматические",
        h1: "Автоматические кромкорезы по листу",
        offer: "Подбор автоматической машины для стабильной подготовки кромки",
        description: "Учитываем толщину и длину листа, геометрию фаски и требуемую производительность участка.",
        scenario: "solution",
        advantages: ["Расчёт под производственную задачу", "Проверка комплектации", "Поставка и документы"],
        questions: [
          { name: "thickness", label: "Толщина листа", placeholder: "мм" },
          { name: "bevel", label: "Фаска", placeholder: "ширина × угол" },
          { name: "volume", label: "Объём", options: ["Периодические работы", "Каждую смену", "Серийное производство", unknown] },
        ],
        faq: commonFaq,
        subcategorySlug: "avtomaticheskie",
      },
    ],
  },
  {
    slug: "kromkorezy-dlya-trub",
    active: true,
    label: "Кромкорезы для труб",
    defaultIntent: "po-diametru",
    intents: [
      {
        slug: "po-diametru",
        label: "По диаметру",
        h1: "Кромкорезы и фаскосниматели для труб",
        offer: "Подберём оборудование по диаметру, стенке и материалу трубы",
        description: "Получите подходящие варианты и проверку диапазона зажима, привода и требуемой подготовки кромки.",
        scenario: "product",
        advantages: ["Проверка рабочего диапазона", "Подбор резцов и оснастки", "Цены и сроки в одном предложении"],
        questions: [
          { name: "diameter", label: "Наружный диаметр", placeholder: "мм" },
          { name: "wall", label: "Толщина стенки", placeholder: "мм" },
          { name: "material", label: "Материал", options: ["Сталь", "Нержавеющая сталь", "Цветной металл", unknown] },
        ],
        faq: commonFaq,
      },
      {
        slug: "dlya-montazha",
        label: "Для монтажа",
        h1: "Переносные кромкорезы для монтажа труб",
        offer: "Подбор компактной машины под условия площадки и геометрию трубы",
        description: "Учитываем доступ к трубе, питание, массу оборудования и требуемую форму разделки кромки.",
        scenario: "solution",
        advantages: ["Подбор под условия доступа", "Проверка привода и оснастки", "Доставка до объекта"],
        questions: [
          { name: "diameter", label: "Диаметр трубы", placeholder: "мм" },
          { name: "access", label: "Условия доступа", options: ["Свободный доступ", "Траншея", "Цеховая линия", "Высотные работы", unknown] },
          { name: "power", label: "Доступное питание", options: ["220 В", "380 В", "Пневмолиния", unknown] },
        ],
        faq: commonFaq,
        matches: ["перенос", "ручн", "мобиль"],
      },
    ],
  },
];

const genericQuestions: SelectionField[] = [
  { name: "task", label: "Что нужно сделать", placeholder: "Коротко опишите задачу" },
  { name: "workpiece", label: "Материал и размеры", placeholder: "Если известны" },
  { name: "load", label: "Режим работы", options: ["Периодически", "Каждую смену", "Серийно", unknown] },
];

function categoryLanding(slug: string, label: string): LandingCategory {
  const content = contentForCategory(slug, label);
  const h1 = content.h1.trim().length >= 20
    ? content.h1
    : `${content.h1} для промышленного применения`;
  const offer = content.selectionTitle.trim().length >= 20
    ? content.selectionTitle
    : `${content.selectionTitle} под параметры вашей задачи`;
  const description = content.intro.trim().length >= 40
    ? content.intro
    : `Подберём ${label.toLowerCase()} по рабочим параметрам, проверим доступность и подготовим коммерческое предложение.`;
  const questions = content.selectionFields.length >= 2
    ? content.selectionFields.slice(0, 3)
    : genericQuestions;
  const categoryFaq = content.faq.filter((item) => item.question && item.answer);
  return {
    slug,
    active: true,
    label,
    defaultIntent: "podbor",
    intents: [{
      slug: "podbor",
      label: "Подбор под задачу",
      h1,
      offer,
      description,
      scenario: "solution",
      advantages: ["Подбор по рабочим параметрам", "Актуальные цены и наличие", "КП со сроком поставки и НДС"],
      questions,
      faq: [...categoryFaq, ...commonFaq].filter((item, index, items) =>
        items.findIndex((candidate) => candidate.question === item.question) === index,
      ).slice(0, 8),
    }],
  };
}

function usableOptions(question: SelectionField): string[] {
  return (question.options || []).filter((option) => !/^не знаю/i.test(option.trim()));
}

/**
 * Быстрые задачи строятся из той же короткой формы: выбранное значение можно
 * сразу подставить в соответствующее поле, не создавая лишних SEO-дублей.
 */
export function quickTasksForLanding(intent: LandingIntent, categoryLabel: string): LandingQuickTask[] {
  if (intent.quickTasks && intent.quickTasks.length >= 3) return intent.quickTasks.slice(0, 5);
  const priority = ["task", "operation", "workpiece", "joint", "process", "purpose", "automation"];
  const rankedQuestions = intent.questions
    .map((question, index) => ({ question, index, rank: priority.indexOf(question.name) }))
    .sort((left, right) => (left.rank < 0 ? 99 : left.rank) - (right.rank < 0 ? 99 : right.rank) || left.index - right.index)
    .map(({ question }) => question);
  const optionTasks = rankedQuestions.flatMap((question) =>
    usableOptions(question).map((value) => ({ label: value, questionName: question.name, value })),
  );
  if (optionTasks.length >= 3) return optionTasks.slice(0, 5);
  const subject = categoryLabel.toLocaleLowerCase("ru");
  return [
    { label: "Подобрать по параметрам", value: `Подобрать ${subject} по параметрам` },
    { label: "Найти аналог", value: `Найти аналог: ${subject}` },
    { label: "Сравнить 3–5 моделей", value: `Сравнить 3–5 моделей: ${subject}` },
    { label: "Проверить наличие и срок", value: `Проверить наличие и срок: ${subject}` },
  ];
}

const coreSlugs = new Set(coreLandingCategories.map((category) => category.slug));

/**
 * Для ключевых направлений используются отдельные сценарии, для остальных —
 * тематическая форма и SEO-профиль категории. Новая опубликованная категория
 * из фида автоматически получает рабочий лендинг «Подбор под задачу».
 */
export const landingCategories: LandingCategory[] = [
  ...coreLandingCategories,
  ...categories
    .filter((category) => !coreSlugs.has(category.slug))
    .map((category) => categoryLanding(category.slug, category.title)),
];

export function findLandingCategory(slug: string): LandingCategory | undefined {
  return landingCategories.find((category) => category.active && category.slug === slug);
}

export function findLandingIntent(category: LandingCategory, slug?: string): LandingIntent | undefined {
  return category.intents.find((intent) => intent.slug === (slug || category.defaultIntent));
}

function searchableProductIdentity(product: Product): string {
  const params: ProductParam[] = product.variants.flatMap((variant) => variant.params);
  return [product.title, product.slug, product.brand, product.sku, ...product.variants.map((variant) => variant.name), ...params.flatMap((param) => [param.name, param.value])]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("ru");
}

export function productsForLanding(products: Product[], intent: LandingIntent): { products: Product[]; total: number; inStock: number } {
  const complete = products.filter((product) =>
    !product.draft &&
    product.title.length >= 8 &&
    !/^(?:товар|артикул|позиция)\b/i.test(product.title.replace(/^[\s\u200B-\u200D\uFEFF]+/, "")) &&
    product.variants.length > 0 &&
    (product.images.some(Boolean) || product.variants.some((variant) => variant.images?.some(Boolean))),
  );
  const subcategory = intent.subcategorySlug
    ? allSubcategoryDefinitions().find((definition) => definition.slug === intent.subcategorySlug && definition.categorySlug === complete[0]?.category)
    : undefined;
  const selected = intent.subcategorySlug
    ? subcategory
      ? complete.filter((product) => matchesSubcategory(product, subcategory))
      : []
    : intent.matches?.length
      ? complete.filter((product) => intent.matches!.some((token) => searchableProductIdentity(product).includes(token.toLocaleLowerCase("ru"))))
      : complete;
  return {
    products: selected.slice(0, 12),
    total: selected.length,
    inStock: selected.filter((product) => product.stock > 0).length,
  };
}

export function landingPassesContentGate(intent: LandingIntent): boolean {
  return Boolean(
    intent.h1.length >= 20 &&
    intent.offer.length >= 20 &&
    intent.description.length >= 40 &&
    intent.advantages.length >= 3 &&
    intent.questions.length >= 2 &&
    intent.questions.length <= 3 &&
    intent.faq.length >= 2,
  );
}

/** Deterministic anti-cannibalization gate for programmatic landing pages. */
export function landingSeoDecision(
  category: LandingCategory,
  intent: LandingIntent,
  productCount: number,
): LandingSeoDecision {
  const key = `${category.slug}/${intent.slug}`;
  const closestCatalogPath = intent.subcategorySlug
    ? `/c/${category.slug}/${intent.subcategorySlug}`
    : `/c/${category.slug}`;
  if (!landingPassesContentGate(intent)) {
    return { action: "REJECT", indexable: false, canonicalPath: closestCatalogPath, reason: "content_gate_failed" };
  }
  if (intent.slug === "podbor") {
    return { action: "CANONICALIZE", indexable: false, canonicalPath: `/c/${category.slug}`, reason: "same_broad_selection_intent_as_category" };
  }
  if (productCount < 6) {
    return { action: "NOINDEX", indexable: false, canonicalPath: closestCatalogPath, reason: "insufficient_stable_assortment" };
  }
  if (!REVIEWED_INDEXABLE_LANDINGS.has(key)) {
    return { action: "NOINDEX", indexable: false, canonicalPath: closestCatalogPath, reason: "awaiting_editorial_and_serp_review" };
  }
  return { action: "KEEP", indexable: true, canonicalPath: `/lp/${key}`, reason: "reviewed_independent_intent" };
}
