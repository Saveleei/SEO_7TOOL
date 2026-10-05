import catalogPresentation from "./generatedCatalogPresentation.json" with { type:"json" };

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
    { slug:"stanki-sverlilnye", label:"Сверлильные станки", href:"/c/stanki-sverlilnye" },
    { slug:"koronchatye-sverla", label:"Корончатые свёрла", href:"/c/koronchatye-sverla" },
    { slug:"sverla-i-zenkovki", label:"Свёрла и зенковки", href:"/c/sverla-i-zenkovki" },
    { slug:"rezbonareznye-manipulyatory", label:"Резьбонарезные манипуляторы", href:"/c/rezbonareznye-manipulyatory" },
    { slug:"metchiki", label:"Метчики", href:"/c/metchiki" },
    { slug:"almaznoe-burenie", label:"Алмазное бурение", href:"/c/almaznoe-burenie" },
  ]},
  { id:"02", slug:"edge", title:"Обработка кромки", accent:"По заготовке и геометрии фаски", image:"/category/kromkorezy-po-listu.webp", href:"/catalog/task/edge", featured:true, representativeProductSlug:"ruchnaya-mashina-dlya-snyatiya-faski-s-trub-tvr-270", subcategories:[
    { slug:"kromkorezy-po-listu", label:"Кромкорезы по листу", href:"/c/kromkorezy-po-listu" },
    { slug:"kromkorezy-dlya-trub", label:"Кромкорезы для труб", href:"/c/kromkorezy-dlya-trub" },
    { slug:"borfrezy", label:"Борфрезы", href:"/c/borfrezy" },
  ]},
  { id:"03", slug:"cutting", title:"Резка металла", accent:"По материалу, профилю и резу", image:"/category/truborezy.webp", href:"/catalog/task/cutting", featured:true, representativeProductSlug:"elektricheskiy-truborez-dlya-stalnyh-i-plastikovyh-trub-liden-roar-250", subcategories:[
    { slug:"truborezy", label:"Труборезы", href:"/c/truborezy" },
    { slug:"karetki-termicheskoy-rezki", label:"Каретки термической резки", href:"/c/karetki-termicheskoy-rezki" },
    { slug:"stanki-lazernoy-rezki", label:"Лазерные станки", href:"/c/stanki-lazernoy-rezki" },
    { slug:"lentochnopilnye-stanki", label:"Ленточнопильные станки", href:"/c/lentochnopilnye-stanki" },
    { slug:"disko-otreznye-stanki", label:"Диско-отрезные станки", href:"/c/disko-otreznye-stanki" },
    { slug:"pilnye-diski", label:"Пильные диски", href:"/c/pilnye-diski" },
  ]},
  { id:"04", slug:"welding", title:"Сварка и автоматизация", accent:"По процессу, изделию и шву", image:"/category/karetki-svarochnye.webp", href:"/catalog/task/welding", featured:true, representativeProductSlug:"svarochnyy-traktor-rail-bull-2", subcategories:[
    { slug:"karetki-svarochnye", label:"Сварочные каретки", href:"/c/karetki-svarochnye" },
    { slug:"svarochnye-roboty", label:"Сварочные роботы", href:"/c/svarochnye-roboty" },
    { slug:"svarochnye-vrashchateli-i-pozitsionery", label:"Вращатели и позиционеры", href:"/c/svarochnye-vrashchateli-i-pozitsionery" },
  ]},
  { id:"05", slug:"tooling", title:"Оснастка и расходные материалы", accent:"По станку, операции и совместимости", image:"/category/koronchatye-sverla.webp", href:"/catalog/task/tooling", representativeProductSlug:"sverla-koronchatye-lzhs", subcategories:[
    { slug:"stanochnaya-osnastka", label:"Станочная оснастка", href:"/c/stanochnaya-osnastka" },
    { slug:"koronchatye-sverla", label:"Корончатые свёрла", href:"/c/koronchatye-sverla" },
    { slug:"sverla-i-zenkovki", label:"Свёрла и зенковки", href:"/c/sverla-i-zenkovki" },
    { slug:"metchiki", label:"Метчики", href:"/c/metchiki" },
    { slug:"sozh-i-sots", label:"СОЖ", href:"/c/sozh-i-sots" },
  ]},
  { id:"06", slug:"workplace", title:"Оснащение производства", accent:"Для участка и перемещения изделий", image:"/category/karetki-svarochnye.webp", href:"/catalog/task/workplace", representativeProductSlug:"porshnevoy-bezmaslyanyy-2-v-1-kompressor-dc990ad-10l", subcategories:[
    { slug:"kompressory", label:"Компрессоры", href:"/c/kompressory" },
    { slug:"zahvaty-dlya-gruzov", label:"Захваты для грузов", href:"/c/zahvaty-dlya-gruzov" },
    { slug:"magnitnaya-osnastka", label:"Магнитная оснастка", href:"/c/magnitnaya-osnastka" },
    { slug:"vibroopory", label:"Виброопоры", href:"/c/vibroopory" },
    { slug:"verstaki", label:"Верстаки", href:"/c/verstaki" },
    { slug:"shlifovalnoe-i-zatochnoe-oborudovanie", label:"Шлифовальное оборудование", href:"/c/shlifovalnoe-i-zatochnoe-oborudovanie" },
  ]},
];

// This small build-time projection keeps the global header and homepage from
// ranking every product group on every server render. The generator is run by
// `npm run build` and its source hash is covered by regression tests.
export const pilotFeedCategorySlugs = catalogPresentation.publishedCategorySlugs;

export const homepageKeyCategorySlugs = [
  "stanki-sverlilnye",
  "koronchatye-sverla",
  "kromkorezy-dlya-trub",
  "kromkorezy-po-listu",
  "borfrezy",
  "rezbonareznye-manipulyatory",
] as const;

export function getProductionCategoryGroups(activeCategorySlugs: string[]): ProductionCategoryGroup[] {
  const active = new Set(activeCategorySlugs);
  return definitions
    .map((group) => {
      const subcategories = group.subcategories.filter((subcategory) => active.has(subcategory.slug)).map((subcategory) => {
        const category = catalogPresentation.categories[subcategory.slug as keyof typeof catalogPresentation.categories];
        return {
          ...subcategory,
          count:category?.count ?? 0,
          image:category?.image || undefined,
        };
      });
      const representativeImage = group.representativeProductSlug
        ? catalogPresentation.products[group.representativeProductSlug as keyof typeof catalogPresentation.products]?.image
        : undefined;
      return { ...group, subcategories, productCount:subcategories.reduce((total, subcategory) => total + (subcategory.count ?? 0), 0), representativeImage:representativeImage || undefined };
    })
    .filter((group) => group.subcategories.length > 0);
}

const canonicalCategoryOwner: Record<string, string> = {
  "koronchatye-sverla":"tooling",
  "sverla-i-zenkovki":"tooling",
  "metchiki":"tooling",
};

/**
 * The task selector intentionally cross-lists products under every relevant job.
 * The catalog itself needs a calmer, single-home taxonomy so buyers do not meet
 * the same category in several columns and wonder which link is authoritative.
 */
export function getCanonicalCatalogGroups(activeCategorySlugs: string[]): ProductionCategoryGroup[] {
  const seen = new Set<string>();
  return getProductionCategoryGroups(activeCategorySlugs)
    .map((group) => {
      const subcategories = group.subcategories.filter((subcategory) => {
        const explicitOwner = canonicalCategoryOwner[subcategory.slug];
        if (explicitOwner) return explicitOwner === group.slug;
        if (seen.has(subcategory.slug)) return false;
        seen.add(subcategory.slug);
        return true;
      });
      return {
        ...group,
        href:`/catalog#direction-${group.slug}`,
        subcategories,
        productCount:subcategories.reduce((total, subcategory) => total + (subcategory.count ?? 0), 0),
      };
    })
    .filter((group) => group.subcategories.length > 0);
}

export function getHomepageKeyCategories(): ProductionSubcategory[] {
  const categories = new Map(
    getProductionCategoryGroups(pilotFeedCategorySlugs)
      .flatMap((group) => group.subcategories)
      .map((subcategory) => [subcategory.slug, subcategory]),
  );
  return homepageKeyCategorySlugs.flatMap((slug) => {
    const category = categories.get(slug);
    return category ? [category] : [];
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
