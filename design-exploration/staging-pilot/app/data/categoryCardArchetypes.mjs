const archetype = (config) => Object.freeze(config);

export const categoryCardArchetypes = Object.freeze({
  machine: archetype({
    id:"machine",
    badge:"Промышленное оборудование",
    variantForms:["исполнение", "исполнения", "исполнений"],
    singleAction:"Добавить в КП",
    multipleAction:"Выбрать исполнение",
    detailAction:"Характеристики и документы",
    tableIdentity:"Модель оборудования",
    priceRequestNote:"Стоимость и комплектацию уточним в КП",
  }),
  "mobile-processing": archetype({
    id:"mobile-processing",
    badge:"Оборудование для обработки",
    variantForms:["исполнение", "исполнения", "исполнений"],
    singleAction:"Добавить в КП",
    multipleAction:"Выбрать исполнение",
    detailAction:"Диапазон и характеристики",
    tableIdentity:"Модель и рабочий диапазон",
    priceRequestNote:"Цену и комплект поставки уточним в КП",
  }),
  "precision-tooling": archetype({
    id:"precision-tooling",
    badge:"Режущий инструмент",
    variantForms:["типоразмер", "типоразмера", "типоразмеров"],
    singleAction:"Добавить позицию",
    multipleAction:"Выбрать типоразмер",
    detailAction:"Все размеры и характеристики",
    tableIdentity:"Серия и назначение",
    priceRequestNote:"Цена зависит от выбранного типоразмера",
  }),
  fixtures: archetype({
    id:"fixtures",
    badge:"Промышленная оснастка",
    variantForms:["исполнение", "исполнения", "исполнений"],
    singleAction:"Добавить в КП",
    multipleAction:"Выбрать исполнение",
    detailAction:"Совместимость и характеристики",
    tableIdentity:"Оснастка и совместимость",
    priceRequestNote:"Стоимость уточним для выбранного исполнения",
  }),
  "process-supply": archetype({
    id:"process-supply",
    badge:"Технологический материал",
    variantForms:["фасовка", "фасовки", "фасовок"],
    singleAction:"Добавить позицию",
    multipleAction:"Выбрать фасовку",
    detailAction:"Состав, применение и фасовка",
    tableIdentity:"Продукт и фасовка",
    priceRequestNote:"Цена зависит от фасовки и объёма заказа",
  }),
  "project-system": archetype({
    id:"project-system",
    badge:"Проектное оборудование",
    variantForms:["конфигурация", "конфигурации", "конфигураций"],
    singleAction:"Включить в расчёт",
    multipleAction:"Выбрать конфигурацию",
    detailAction:"Конфигурация и документация",
    tableIdentity:"Система и конфигурация",
    priceRequestNote:"Стоимость рассчитывается после уточнения задачи",
  }),
});

export const categoryCardArchetypeIds = Object.freeze({
  "stanki-sverlilnye":"machine",
  "koronchatye-sverla":"precision-tooling",
  "kromkorezy-po-listu":"mobile-processing",
  "kromkorezy-dlya-trub":"mobile-processing",
  "rezbonareznye-manipulyatory":"machine",
  borfrezy:"precision-tooling",
  truborezy:"mobile-processing",
  "karetki-svarochnye":"mobile-processing",
  "pilnye-diski":"precision-tooling",
  "karetki-termicheskoy-rezki":"mobile-processing",
  metchiki:"precision-tooling",
  "lentochnopilnye-stanki":"machine",
  "shlifovalnoe-i-zatochnoe-oborudovanie":"machine",
  "magnitnaya-osnastka":"fixtures",
  "almaznoe-burenie":"machine",
  "svarochnye-vrashchateli-i-pozitsionery":"project-system",
  "zahvaty-dlya-gruzov":"fixtures",
  "sozh-i-sots":"process-supply",
  "disko-otreznye-stanki":"machine",
  kompressory:"machine",
  "sverla-i-zenkovki":"precision-tooling",
  "stanki-lazernoy-rezki":"project-system",
  "svarochnye-roboty":"project-system",
  "stanochnaya-osnastka":"fixtures",
});

export function getCategoryCardArchetype(categorySlug, overrideId) {
  const id = overrideId ?? categoryCardArchetypeIds[categorySlug] ?? "machine";
  return categoryCardArchetypes[id];
}

export function getCategoryCardArchetypeSlugs() {
  return Object.keys(categoryCardArchetypeIds);
}

export function pluralizeCardVariants(count, forms) {
  const modulo100 = count % 100;
  const modulo10 = count % 10;
  const word = modulo100 >= 11 && modulo100 <= 14
    ? forms[2]
    : modulo10 === 1
      ? forms[0]
      : modulo10 >= 2 && modulo10 <= 4
        ? forms[1]
        : forms[2];
  return `${count} ${word}`;
}
