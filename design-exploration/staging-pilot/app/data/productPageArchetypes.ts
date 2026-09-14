import { getCategoryCardArchetype } from "./categoryCardArchetypes.mjs";

export type ProductPageArchetype = {
  id: "equipment" | "mobile-processing" | "dimensional-tooling" | "compatible-accessory" | "process-consumable" | "project-system";
  badge: string;
  routeTitle: string;
  routeLead: string;
  primaryAction: string;
  requestAction: string;
  fitAction: string;
  compareAction: string;
  quoteProof: string;
  decisionEyebrow: string;
  decisionTitle: string;
  decisionIntro: string;
  engineerEyebrow: string;
  decisionFallback: string;
  recommendationJumpLabel: string;
  recommendationTitle: string;
  recommendationIntro: string;
  compatibilityTitle: string;
  kitTitle: string;
  alternativesTitle: string;
  comparisonTitle: string;
  comparisonDescription: string;
  comparisonKeepAction: string;
  supplyTitle: string;
  supplyIntro: string;
  finalTitle: string;
  finalCopy: string;
  savedContextLabel: string;
};

export const productPageArchetypes: Record<ProductPageArchetype["id"], ProductPageArchetype> = {
  equipment: {
    id:"equipment",
    badge:"Промышленное оборудование",
    routeTitle:"Путь к обоснованному выбору",
    routeLead:"Сначала рабочая задача, затем исполнение и условия поставки.",
    primaryAction:"Добавить оборудование в КП",
    requestAction:"Открыть запрос КП",
    fitAction:"Проверить под задачу",
    compareAction:"Сравнить модели",
    quoteProof:"В КП попадут модель, выбранное исполнение, количество и контекст задачи.",
    decisionEyebrow:"Проверка применимости",
    decisionTitle:"Сначала рабочий диапазон и условия, затем модель",
    decisionIntro:"Ключевые параметры взяты из выбранного исполнения. Инженер дополнительно проверит установку, режим работы и оснастку.",
    engineerEyebrow:"Инженерная проверка",
    decisionFallback:"Сопоставьте этот параметр с рабочей задачей и условиями эксплуатации.",
    recommendationJumpLabel:"Оснастка и аналоги",
    recommendationTitle:"Оснастка, комплект и альтернативы",
    recommendationIntro:"Помогаем проверить рабочую связку, собрать комплект и сравнить оборудование без возврата в категорию.",
    compatibilityTitle:"Оснастка для выбранного исполнения",
    kitTitle:"Что потребуется для запуска",
    alternativesTitle:"Модели для сравнения",
    comparisonTitle:"Оборудование для той же рабочей задачи",
    comparisonDescription:"Текущая модель остаётся первой. Альтернативы сопоставлены по доступным рабочим параметрам; отсутствующие данные не дополнены предположениями.",
    comparisonKeepAction:"Оставить текущую модель",
    supplyTitle:"Комплектация, документы и условия поставки",
    supplyIntro:"Фиксируем подтверждённые данные отдельно от комплектации, документов и срока, которые требуют проверки перед счётом.",
    finalTitle:"Соберите оборудование и оснастку в одном запросе",
    finalCopy:"Модель, исполнение и количество сохраняются в черновике КП. Менеджер добавит подтверждённую комплектацию, срок и документы.",
    savedContextLabel:"Модель и исполнение уже сохранены",
  },
  "mobile-processing": {
    id:"mobile-processing",
    badge:"Оборудование для обработки",
    routeTitle:"Путь к подходящему диапазону",
    routeLead:"Размер заготовки и операция важнее названия модели.",
    primaryAction:"Добавить модель в КП",
    requestAction:"Открыть запрос КП",
    fitAction:"Проверить рабочий диапазон",
    compareAction:"Сравнить оборудование",
    quoteProof:"В КП попадут модель, рабочий диапазон выбранного исполнения и количество.",
    decisionEyebrow:"Проверка диапазона",
    decisionTitle:"Сверьте заготовку, операцию и способ установки",
    decisionIntro:"Параметры ниже относятся к выбранному исполнению. Доступ к детали, профиль обработки и комплект инструмента проверяются отдельно.",
    engineerEyebrow:"Проверка по детали",
    decisionFallback:"Сопоставьте этот предел с размером заготовки и требуемой операцией.",
    recommendationJumpLabel:"Комплект и аналоги",
    recommendationTitle:"Инструмент, комплект и альтернативы",
    recommendationIntro:"Показываем только проверяемые связи по параметрам фида; резцы и принадлежности без подтверждения не подставляем.",
    compatibilityTitle:"Оснастка для выбранной операции",
    kitTitle:"Что проверить для начала работы",
    alternativesTitle:"Альтернативы по рабочему диапазону",
    comparisonTitle:"Оборудование с сопоставимым рабочим диапазоном",
    comparisonDescription:"Сравнение строится по параметрам выбранного исполнения. Способ установки, профиль обработки и комплект резцов требуют инженерной проверки.",
    comparisonKeepAction:"Оставить выбранную модель",
    supplyTitle:"Комплектация, инструмент и документы",
    supplyIntro:"Модель и цена отделены от состава резцов, принадлежностей, документов и срока — их подтвердим перед счётом.",
    finalTitle:"Передайте модель и параметры заготовки одним запросом",
    finalCopy:"Выбранное исполнение и количество уже сохраняются в КП; в требованиях можно приложить размеры или описать профиль обработки.",
    savedContextLabel:"Диапазон и модель уже сохранены",
  },
  "dimensional-tooling": {
    id:"dimensional-tooling",
    badge:"Размерный режущий инструмент",
    routeTitle:"Путь к точному типоразмеру",
    routeLead:"Размер, материал детали и посадка проверяются до количества.",
    primaryAction:"Добавить типоразмер в КП",
    requestAction:"Открыть запрос КП",
    fitAction:"Проверить совместимость",
    compareAction:"Сравнить серии и размеры",
    quoteProof:"В КП попадут точный типоразмер, артикул выбранного исполнения и количество.",
    decisionEyebrow:"Проверка размера",
    decisionTitle:"Сверьте размер, материал и присоединение",
    decisionIntro:"Основные характеристики относятся к выбранному типоразмеру. Станок, режим резания и вспомогательная оснастка проверяются отдельно.",
    engineerEyebrow:"Проверка совместимости",
    decisionFallback:"Сопоставьте этот параметр с требуемым размером, материалом детали и вашим оборудованием.",
    recommendationJumpLabel:"Совместимость и аналоги",
    recommendationTitle:"Совместимое оборудование, комплект и аналоги",
    recommendationIntro:"Сохраняем выбранный размер и показываем только связи, которые можно обосновать параметрами фида.",
    compatibilityTitle:"Подходит к выбранному типоразмеру",
    kitTitle:"Что проверить вместе с инструментом",
    alternativesTitle:"Серии и исполнения для сравнения",
    comparisonTitle:"Инструмент того же размера для сравнения",
    comparisonDescription:"Выбранный типоразмер остаётся первым. Аналоги сопоставлены по доступным размерам и характеристикам; совместимость со станком проверяется отдельно.",
    comparisonKeepAction:"Оставить выбранный типоразмер",
    supplyTitle:"Типоразмер, упаковка и документы",
    supplyIntro:"Артикул и цена взяты из фида. Комплектность, упаковку, паспорт и срок подтверждаем отдельно перед счётом.",
    finalTitle:"Соберите нужные типоразмеры в одном запросе",
    finalCopy:"Каждый выбранный артикул и количество сохраняются в черновике КП — повторно перечислять размеры менеджеру не потребуется.",
    savedContextLabel:"Типоразмер и артикул уже сохранены",
  },
  "compatible-accessory": {
    id:"compatible-accessory",
    badge:"Промышленная оснастка",
    routeTitle:"Путь к совместимой оснастке",
    routeLead:"Сначала интерфейс и нагрузка, затем исполнение и количество.",
    primaryAction:"Добавить оснастку в КП",
    requestAction:"Открыть запрос КП",
    fitAction:"Проверить совместимость",
    compareAction:"Сравнить исполнения",
    quoteProof:"В КП попадут выбранное исполнение оснастки, артикул и количество.",
    decisionEyebrow:"Проверка совместимости",
    decisionTitle:"Сверьте интерфейс, рабочий размер и нагрузку",
    decisionIntro:"Характеристики ниже взяты из фида. Совместимость с вашим оборудованием подтверждается по модели, посадке и условиям работы.",
    engineerEyebrow:"Проверка по оборудованию",
    decisionFallback:"Сопоставьте параметр с интерфейсом, нагрузкой и ограничениями вашего оборудования.",
    recommendationJumpLabel:"Совместимость и аналоги",
    recommendationTitle:"Совместимость, комплект и альтернативы",
    recommendationIntro:"Не заявляем применимость без достаточных данных: сохраняем исполнение и передаём недостающие параметры инженеру.",
    compatibilityTitle:"Подходит к выбранной оснастке",
    kitTitle:"Что проверить перед установкой",
    alternativesTitle:"Исполнения для сравнения",
    comparisonTitle:"Оснастка с сопоставимыми параметрами",
    comparisonDescription:"Сравнение основано на доступных характеристиках. Посадка, крепёж и допустимая нагрузка требуют отдельного подтверждения.",
    comparisonKeepAction:"Оставить выбранную оснастку",
    supplyTitle:"Исполнение, крепёж и документы",
    supplyIntro:"Артикул и цена отделены от крепежа, переходников, документов и срока — эти данные подтвердим до выставления счёта.",
    finalTitle:"Сохраните оснастку и модель оборудования в одном запросе",
    finalCopy:"Исполнение и количество уже попадут в КП; модель оборудования можно указать в требованиях для проверки совместимости.",
    savedContextLabel:"Исполнение оснастки уже сохранено",
  },
  "process-consumable": {
    id:"process-consumable",
    badge:"Технологический материал",
    routeTitle:"Путь к подходящему материалу",
    routeLead:"Процесс и обрабатываемый материал определяют продукт и фасовку.",
    primaryAction:"Добавить фасовку в КП",
    requestAction:"Открыть запрос КП",
    fitAction:"Уточнить применение",
    compareAction:"Сравнить продукты",
    quoteProof:"В КП попадут выбранный продукт, фасовка, артикул и количество.",
    decisionEyebrow:"Проверка применения",
    decisionTitle:"Сверьте процесс, материал и требуемый объём",
    decisionIntro:"Характеристики относятся к выбранной фасовке. Совместимость с процессом и требования к эксплуатации уточняются отдельно.",
    engineerEyebrow:"Технологическая проверка",
    decisionFallback:"Сопоставьте параметр с вашим процессом, материалом и режимом применения.",
    recommendationJumpLabel:"Применение и аналоги",
    recommendationTitle:"Применение, расход и альтернативы",
    recommendationIntro:"Сохраняем выбранную фасовку и не заменяем технологическую проверку случайными товарными рекомендациями.",
    compatibilityTitle:"Подходит к выбранному применению",
    kitTitle:"Что проверить перед использованием",
    alternativesTitle:"Продукты для сравнения",
    comparisonTitle:"Технологические материалы для сравнения",
    comparisonDescription:"Сравнение основано на доступном составе и назначении. Режим применения и совместимость с процессом подтверждаются отдельно.",
    comparisonKeepAction:"Оставить выбранный продукт",
    supplyTitle:"Фасовка, документы и условия поставки",
    supplyIntro:"Цена относится к выбранной фасовке; паспорт, условия применения и срок подтверждаем перед счётом.",
    finalTitle:"Соберите продукты и фасовки в одном запросе",
    finalCopy:"Артикулы, фасовки и количество сохраняются в КП; требования к процессу можно передать одним сообщением.",
    savedContextLabel:"Продукт и фасовка уже сохранены",
  },
  "project-system": {
    id:"project-system",
    badge:"Проектное оборудование",
    routeTitle:"Путь к техническому расчёту",
    routeLead:"Исходные данные и производительность важнее готового артикула.",
    primaryAction:"Включить конфигурацию в расчёт",
    requestAction:"Открыть расчёт",
    fitAction:"Передать исходные данные",
    compareAction:"Сравнить конфигурации",
    quoteProof:"В расчёте сохранятся выбранная конфигурация, доступные параметры и количество.",
    decisionEyebrow:"Исходные данные проекта",
    decisionTitle:"Сначала задача и производительность, затем конфигурация",
    decisionIntro:"Параметры ниже описывают выбранное исполнение. Состав системы, интеграция и срок рассчитываются после уточнения проекта.",
    engineerEyebrow:"Проектная проверка",
    decisionFallback:"Сопоставьте параметр с производительностью, рабочей зоной и требованиями к интеграции.",
    recommendationJumpLabel:"Конфигурация и расчёт",
    recommendationTitle:"Конфигурация, состав проекта и альтернативы",
    recommendationIntro:"Сайт фиксирует исходное исполнение, но не выдаёт неполный проект за готовое коммерческое решение.",
    compatibilityTitle:"Связанные узлы и оборудование",
    kitTitle:"Что включить в технический расчёт",
    alternativesTitle:"Конфигурации для сравнения",
    comparisonTitle:"Конфигурации для одной производственной задачи",
    comparisonDescription:"Сравниваются только доступные параметры. Автоматизация, интеграция, обучение и пусконаладка рассчитываются после сбора исходных данных.",
    comparisonKeepAction:"Оставить выбранную конфигурацию",
    supplyTitle:"Состав проекта, документация и реализация",
    supplyIntro:"Каталожная конфигурация — отправная точка. Комплект проекта, документацию, этапы и срок подтвердим техническим предложением.",
    finalTitle:"Передайте конфигурацию и исходные данные одним запросом",
    finalCopy:"Выбранное исполнение сохраняется в расчёте; менеджер дополнит его составом проекта, этапами, документами и подтверждённым сроком.",
    savedContextLabel:"Исходная конфигурация уже сохранена",
  },
};

const cardToProductArchetype: Record<string, ProductPageArchetype["id"]> = {
  machine:"equipment",
  "mobile-processing":"mobile-processing",
  "precision-tooling":"dimensional-tooling",
  fixtures:"compatible-accessory",
  "process-supply":"process-consumable",
  "project-system":"project-system",
};

export function getProductPageArchetype(categorySlug: string): ProductPageArchetype {
  const cardArchetype = getCategoryCardArchetype(categorySlug);
  return productPageArchetypes[cardToProductArchetype[cardArchetype.id] ?? "equipment"];
}
