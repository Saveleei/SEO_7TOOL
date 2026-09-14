export type HomepageImageFit = "contain" | "cover";
export type HomepageImagePosition = "center" | "top" | "bottom" | "left" | "right";
export type HomepageTextSection = { eyebrow: string; title: string; intro: string };
export type HomepageMediaItem = {
  id: string;
  title: string;
  imageAlt: string;
  imageAssetId: string;
  imageFit: HomepageImageFit;
  imagePosition: HomepageImagePosition;
};
export type HomepageContentSettings = {
  revision: number;
  updatedAt: string;
  hero: HomepageTextSection;
  assortment: HomepageTextSection;
  categories: HomepageTextSection;
  tasks: HomepageTextSection;
  assortmentItems: HomepageMediaItem[];
  categoryItems: HomepageMediaItem[];
};

export const DEFAULT_HOMEPAGE_CONTENT_SETTINGS: HomepageContentSettings = Object.freeze({
  revision:0,
  updatedAt:"",
  hero:{
    eyebrow:"Сверление · резка · обработка кромки · сварка",
    title:"Промышленное оборудование и оснастка для металлообработки",
    intro:"Сверление, резка, обработка кромки, сварочная автоматизация и оснащение производства. Подберём исполнение и подтвердим цену, совместимость и срок поставки.",
  },
  assortment:{
    eyebrow:"Карта ассортимента",
    title:"Что поставляет 7TOOL",
    intro:"Выберите направление — внутри показаны категории, параметры и доступные исполнения.",
  },
  categories:{
    eyebrow:"Быстрый вход в каталог",
    title:"Основные разделы каталога",
    intro:"Выберите тип оборудования или оснастки — внутри доступны характеристики, исполнения и подбор по параметрам.",
  },
  tasks:{
    eyebrow:"Если не знаете раздел",
    title:"Начните с производственной задачи",
    intro:"Выберите ближайшую операцию. На следующем шаге увидите подходящие категории и сможете уточнить параметры без знания артикула.",
  },
  assortmentItems:[
    media("drilling", "Сверление и резьба", "Магнитный сверлильный станок и оснастка"),
    media("edge", "Обработка кромки", "Оборудование для обработки кромки металла"),
    media("cutting", "Резка металла", "Оборудование для резки металлических заготовок"),
    media("welding", "Сварка и автоматизация", "Оборудование для механизации сварочных работ"),
    media("tooling", "Оснастка и расходные материалы", "Оснастка для промышленного оборудования"),
    media("workplace", "Оснащение производства", "Оборудование для оснащения производственного участка"),
  ],
  categoryItems:[
    media("stanki-sverlilnye", "Магнитные сверлильные станки", "Магнитный сверлильный станок"),
    media("koronchatye-sverla", "Корончатые свёрла", "Корончатые свёрла по металлу"),
    media("kromkorezy-dlya-trub", "Кромкорезы для труб", "Кромкорез для обработки торцов труб"),
    media("kromkorezy-po-listu", "Кромкорезы по листу", "Кромкорез для листового металла"),
    media("borfrezy", "Борфрезы", "Твердосплавные борфрезы"),
    media("rezbonareznye-manipulyatory", "Резьбонарезные манипуляторы", "Резьбонарезной манипулятор"),
  ],
});

export function homepageAssetUrl(assetId: string): string {
  return `/api/homepage-content/assets/${assetId}`;
}

function media(id: string, title: string, imageAlt: string): HomepageMediaItem {
  return { id, title, imageAlt, imageAssetId:"", imageFit:"contain", imagePosition:"center" };
}
