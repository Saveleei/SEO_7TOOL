import { getFeedCategory, getFeedCategoryProducts, getFeedProductBySlug, getFeedProductImage, getPublishedFeedCategorySlugs, type FeedProduct } from "./feedCatalog.ts";

export type ProductionSubcategory = {
  slug: string;
  label: string;
  href: string;
  count?: number;
  image?: string;
};

export type ProductionCategoryGroup = {
  id: string;
  slug: string;
  title: string;
  accent: string;
  image: string;
  href: string;
  featured?: boolean;
  productCount?: number;
  representativeProductSlug?: string;
  representativeImage?: string;
  subcategories: ProductionSubcategory[];
};

const definitions: ProductionCategoryGroup[] = [
  { id:"01", slug:"drilling", title:"Сверление и резьба", accent:"От отверстия к готовому комплекту", image:"/category/stanki-sverlilnye.webp", href:"/catalog/task/drilling", featured:true, representativeProductSlug:"magnitnyy-sverlilnyy-stanok-lenz-steyr-35", subcategories:[
    { slug:"stanki-sverlilnye", label:"Сверлильные станки", href:"/catalog/category/stanki-sverlilnye" },
    { slug:"koronchatye-sverla", label:"Корончатые свёрла", href:"/catalog/category/koronchatye-sverla" },
    { slug:"sverla-i-zenkovki", label:"Свёрла и зенковки", href:"/catalog/category/sverla-i-zenkovki" },
    { slug:"rezbonareznye-manipulyatory", label:"Резьбонарезные манипуляторы", href:"/catalog/category/rezbonareznye-manipulyatory" },
    { slug:"metchiki", label:"Метчики", href:"/catalog/category/metchiki" },
    { slug:"almaznoe-burenie", label:"Алмазное бурение", href:"/catalog/category/almaznoe-burenie" },
  ]},
  { id:"02", slug:"edge", title:"Обработка кромки", accent:"По заготовке и геометрии фаски", image:"/category/kromkorezy-po-listu.webp", href:"/catalog/task/edge", featured:true, representativeProductSlug:"ruchnaya-mashina-dlya-snyatiya-faski-s-trub-tvr-270", subcategories:[
    { slug:"kromkorezy-po-listu", label:"Кромкорезы по листу", href:"/catalog/category/kromkorezy-po-listu" },
    { slug:"kromkorezy-dlya-trub", label:"Кромкорезы для труб", href:"/catalog/category/kromkorezy-dlya-trub" },
    { slug:"borfrezy", label:"Борфрезы", href:"/catalog/category/borfrezy" },
  ]},
  { id:"03", slug:"cutting", title:"Резка металла", accent:"По материалу, профилю и резу", image:"/category/truborezy.webp", href:"/catalog/task/cutting", featured:true, representativeProductSlug:"elektricheskiy-truborez-dlya-stalnyh-i-plastikovyh-trub-liden-roar-250", subcategories:[
    { slug:"truborezy", label:"Труборезы", href:"/catalog/category/truborezy" },
    { slug:"karetki-termicheskoy-rezki", label:"Каретки термической резки", href:"/catalog/category/karetki-termicheskoy-rezki" },
    { slug:"stanki-lazernoy-rezki", label:"Лазерные станки", href:"/catalog/category/stanki-lazernoy-rezki" },
    { slug:"lentochnopilnye-stanki", label:"Ленточнопильные станки", href:"/catalog/category/lentochnopilnye-stanki" },
    { slug:"disko-otreznye-stanki", label:"Диско-отрезные станки", href:"/catalog/category/disko-otreznye-stanki" },
    { slug:"pilnye-diski", label:"Пильные диски", href:"/catalog/category/pilnye-diski" },
  ]},
  { id:"04", slug:"welding", title:"Сварка и автоматизация", accent:"По процессу, изделию и шву", image:"/category/karetki-svarochnye.webp", href:"/catalog/task/welding", featured:true, representativeProductSlug:"svarochnyy-traktor-rail-bull-2", subcategories:[
    { slug:"karetki-svarochnye", label:"Сварочные каретки", href:"/catalog/category/karetki-svarochnye" },
    { slug:"svarochnye-roboty", label:"Сварочные роботы", href:"/catalog/category/svarochnye-roboty" },
    { slug:"svarochnye-vrashchateli-i-pozitsionery", label:"Вращатели и позиционеры", href:"/catalog/category/svarochnye-vrashchateli-i-pozitsionery" },
  ]},
  { id:"05", slug:"tooling", title:"Оснастка и расходные материалы", accent:"По станку, операции и совместимости", image:"/category/koronchatye-sverla.webp", href:"/catalog/task/tooling", representativeProductSlug:"sverla-koronchatye-lzhs", subcategories:[
    { slug:"stanochnaya-osnastka", label:"Станочная оснастка", href:"/catalog/category/stanochnaya-osnastka" },
    { slug:"koronchatye-sverla", label:"Корончатые свёрла", href:"/catalog/category/koronchatye-sverla" },
    { slug:"sverla-i-zenkovki", label:"Свёрла и зенковки", href:"/catalog/category/sverla-i-zenkovki" },
    { slug:"metchiki", label:"Метчики", href:"/catalog/category/metchiki" },
    { slug:"sozh-i-sots", label:"СОЖ", href:"/catalog/category/sozh-i-sots" },
  ]},
  { id:"06", slug:"workplace", title:"Оснащение производства", accent:"Для участка и перемещения изделий", image:"/category/karetki-svarochnye.webp", href:"/catalog/task/workplace", representativeProductSlug:"porshnevoy-bezmaslyanyy-2-v-1-kompressor-dc990ad-10l", subcategories:[
    { slug:"kompressory", label:"Компрессоры", href:"/catalog/category/kompressory" },
    { slug:"zahvaty-dlya-gruzov", label:"Захваты для грузов", href:"/catalog/category/zahvaty-dlya-gruzov" },
    { slug:"magnitnaya-osnastka", label:"Магнитная оснастка", href:"/catalog/category/magnitnaya-osnastka" },
    { slug:"vibroopory", label:"Виброопоры", href:"/catalog/category/vibroopory" },
    { slug:"verstaki", label:"Верстаки", href:"/catalog/category/verstaki" },
    { slug:"shlifovalnoe-i-zatochnoe-oborudovanie", label:"Шлифовальное оборудование", href:"/catalog/category/shlifovalnoe-i-zatochnoe-oborudovanie" },
  ]},
];

// Пилот читает опубликованные категории из локального снимка нормализованного фида.
export const pilotFeedCategorySlugs = getPublishedFeedCategorySlugs();

export function getProductionCategoryGroups(activeCategorySlugs: string[]): ProductionCategoryGroup[] {
  const active = new Set(activeCategorySlugs);
  return definitions
    .map((group) => {
      const subcategories = group.subcategories.filter((subcategory) => active.has(subcategory.slug)).map((subcategory) => {
        const category = getFeedCategory(subcategory.slug);
        const representativeProduct = getFeedCategoryProducts(subcategory.slug, 1)[0];
        return {
          ...subcategory,
          count:category?.count ?? 0,
          image:representativeProduct ? getFeedProductImage(representativeProduct) : undefined,
        };
      });
      const representativeProduct = group.representativeProductSlug ? getFeedProductBySlug(group.representativeProductSlug) : undefined;
      return { ...group, subcategories, productCount:subcategories.reduce((total, subcategory) => total + (subcategory.count ?? 0), 0), representativeImage:representativeProduct ? getFeedProductImage(representativeProduct) : undefined };
    })
    .filter((group) => group.subcategories.length > 0);
}

export function getHomepageFeaturedProducts(): FeedProduct[] {
  return definitions.flatMap((group) => {
    const product = group.representativeProductSlug ? getFeedProductBySlug(group.representativeProductSlug) : undefined;
    return product ? [product] : [];
  });
}

export function getProductionCategoryGroup(slug: string): ProductionCategoryGroup | undefined {
  return getProductionCategoryGroups(pilotFeedCategorySlugs).find((group) => group.slug === slug);
}

export function getProductionSubcategory(slug: string): { group: ProductionCategoryGroup; subcategory: ProductionSubcategory } | undefined {
  for (const group of getProductionCategoryGroups(pilotFeedCategorySlugs)) {
    const subcategory = group.subcategories.find((item) => item.slug === slug);
    if (subcategory) return { group, subcategory };
  }
  return undefined;
}
