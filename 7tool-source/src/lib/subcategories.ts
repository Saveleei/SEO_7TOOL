import { categories, products, subcategoryOverrides } from "./data";
import { cleanParamName, type Product } from "./catalog";
import type { SelectionField } from "./category-content";

type TitleRule = { field: "title"; pattern: string };
type BrandRule = { field: "brand"; values: string[] };
type ParamRule = { field: "param"; name: string; pattern?: string; values?: string[] };
type FeedCategoryRule = { field: "feedCategory"; values: string[] };
export type SubcategoryRule = TitleRule | BrandRule | ParamRule | FeedCategoryRule;

export type SubcategoryDefinition = {
  slug: string;
  categorySlug: string;
  title: string;
  h1?: string;
  shortDescription: string;
  intro: string;
  seoText: string;
  metaTitle: string;
  metaDescription: string;
  keywords?: string[];
  seoTitle?: string;
  faq?: { question: string; answer: string }[];
  selectionTitle?: string;
  selectionFields?: SelectionField[];
  relatedLinks?: { href: string; label: string }[];
  image?: string;
  imageAlt?: string;
  published: boolean;
  minProducts: number;
  match: "all" | "any";
  rules: SubcategoryRule[];
  sortOrder?: number;
  manualProductIds?: string[];
  formEnabled?: boolean;
  formPosition?: "after_subcategories" | "after_products";
};

export type ResolvedSubcategory = SubcategoryDefinition & {
  count: number;
  items: Product[];
  categoryTitle: string;
};

const baseDefinitions: SubcategoryDefinition[] = [
  define("borfrezy", "formy-a-d", "Борфрезы форм A–D", "Цилиндрические, сферические и радиусные формы для обработки пазов, кромок и поверхностей.", [
    paramValues("Форма", ["A", "B", "C", "D"]),
  ]),
  define("borfrezy", "formy-e-h", "Борфрезы форм E–H", "Овальные, параболические и пламеневидные формы для контурной обработки.", [
    paramValues("Форма", ["E", "F", "G", "H"]),
  ]),
  define("borfrezy", "formy-l-n", "Конусные борфрезы L–N", "Конусные формы для выборки материала, снятия заусенцев и обработки углов.", [
    paramValues("Форма", ["L", "M", "N"]),
  ]),
  define("borfrezy", "dlya-alyuminiya", "Борфрезы для алюминия", "Насечка, предназначенная для обработки алюминия и цветных металлов.", [
    paramPattern("Тип насечки", "алюмин"),
  ]),
  define("borfrezy", "melkaya-nasechka", "Борфрезы с мелкой насечкой", "Для чистовой обработки и контролируемого съёма материала.", [
    paramPattern("Тип насечки", "мелк"),
  ]),

  define("stanki-sverlilnye", "magnitnye", "Магнитные сверлильные станки", "Переносные машины на электромагнитном основании для работы на металлоконструкциях.", [
    title("магнит|электромагнит"),
  ]),
  define("stanki-sverlilnye", "stacionarnye", "Стационарные сверлильные станки", "Настольные, вертикально- и радиально-сверлильные модели для цеха.", [
    title("вертикально|радиально|настольн|колонн"),
  ]),
  define("stanki-sverlilnye", "reversivnye", "Сверлильные станки с реверсом", "Модели с реверсом для сверления и резьбонарезных операций.", [
    paramValues("Реверс", ["Да"]),
  ]),
  define("stanki-sverlilnye", "weldon-19", "Станки с хвостовиком Weldon 19", "Модели для работы корончатыми свёрлами с распространённым хвостовиком Weldon 19.", [
    paramPattern("Шпиндель", "Weldon 19"),
  ]),
  define("stanki-sverlilnye", "rezbonareznye", "Станки для нарезания резьбы", "Станки, в характеристиках которых предусмотрены резьбонарезные операции.", [
    title("резьбонарез|нарезания резьб"),
  ]),
  {
    ...define("stanki-sverlilnye", "beschetochnye", "Безщёточные сверлильные станки", "Модели с безщёточным приводом для стабильной работы под нагрузкой и сниженного обслуживания.", [
      paramPattern("Тип электродвигателя", "б[еи]с[щш]еточ"),
      title("б[еи]с[щш]еточ|brushless"),
    ]),
    minProducts: 1,
  },

  define("koronchatye-sverla", "hss", "Корончатые свёрла HSS", "Быстрорежущие корончатые свёрла для универсальных производственных задач.", [
    paramPattern("Материал режущей части", "HSS|HSSE|ASP"),
  ]),
  define("koronchatye-sverla", "tct", "Твердосплавные корончатые свёрла TCT", "Твердосплавные модели для производительного сверления конструкционных материалов.", [
    paramPattern("Материал режущей части", "Твердый сплав"),
  ]),
  define("koronchatye-sverla", "weldon-19", "Корончатые свёрла Weldon 19", "Свёрла с хвостовиком Weldon 19 и совместимыми посадками.", [
    paramPattern("Хвостовик", "Weldon 19"),
  ]),
  define("koronchatye-sverla", "glubina-do-55", "Свёрла глубиной до 55 мм", "Корончатые свёрла с рабочей длиной 55 мм и меньше.", [
    paramValues("Рабочая длина", ["8 мм", "25 мм", "30 мм", "35 мм", "40 мм", "50 мм", "55 мм"]),
  ]),
  define("koronchatye-sverla", "glubokoe-sverlenie", "Свёрла для глубокого сверления", "Корончатые свёрла с рабочей длиной от 80 до 150 мм.", [
    paramValues("Рабочая длина", ["80 мм", "110 мм", "150 мм"]),
  ]),
  define("koronchatye-sverla", "nabory", "Наборы корончатых свёрл", "Готовые комплекты свёрл и принадлежностей для типовых диаметров.", [
    title("набор"),
  ]),

  define("truborezy", "ruchnye", "Ручные труборезы", "Компактные модели для монтажных и ремонтных работ без электропривода.", [
    title("ручн"),
  ]),
  define("truborezy", "elektricheskie", "Электрические труборезы", "Механизированный рез труб на производстве и монтажной площадке.", [
    title("электрическ"),
  ]),
  define("truborezy", "orbitalnye", "Орбитальные труборезы", "Модели для точного перпендикулярного реза трубы по окружности.", [
    title("орбитал"),
  ]),
  define("truborezy", "razemnye", "Разъёмные труборезы", "Разъёмные машины для трубопроводов, которые нельзя обработать с торца.", [
    title("разъем|разъём"),
  ]),
  define("truborezy", "stacionarnye", "Стационарные труборезные станки", "Стационарное оборудование для повторяемого производственного реза.", [
    title("стационар|станок"),
  ]),

  define("kromkorezy-po-listu", "elektricheskie", "Электрические кромкорезы", "Переносные и стационарные модели с электрическим приводом.", [
    paramPattern("Привод", "Электро"),
  ]),
  define("kromkorezy-po-listu", "pnevmaticheskie", "Пневматические кромкорезы", "Оборудование с пневмоприводом для производственных участков.", [
    paramPattern("Привод", "Пневмо"),
  ]),
  define("kromkorezy-po-listu", "mobilnye", "Мобильные кромкорезы", "Переносные модели для обработки листа непосредственно у заготовки.", [
    paramValues("Тип", ["Мобильный"]),
  ]),
  define("kromkorezy-po-listu", "stacionarnye", "Стационарные кромкорезы", "Стационарные и настольные решения для серийной обработки.", [
    paramPattern("Тип", "Стационарный|Настольный"),
  ]),
  define("kromkorezy-po-listu", "kromkoskalyvayuschie", "Кромкоскалывающие машины", "Модели со скалывающим принципом формирования фаски.", [
    paramPattern("Тип обработки", "Кромкоскалывающие"),
  ]),
  define("kromkorezy-po-listu", "avtomaticheskie", "Автоматические кромкорезы по листу", "Самоходные и автоматические машины для серийного снятия фаски с листового металла.", [
    title("автомат|автоматической подачей"),
  ]),
  {
    ...define("kromkorezy-po-listu", "osnastka", "Оснастка для кромкорезов", "Направляющие, приспособления, зажимы, ролики и другая оснастка для комплектации кромкорезов.", [
      { field: "feedCategory", values: ["148"] },
    ]),
    minProducts: 1,
  },

  define("kromkorezy-dlya-trub", "vnutrennee-kreplenie", "Кромкорезы с внутренним креплением", "Машины, фиксируемые внутри трубы для обработки торца и фаски.", [
    paramValues("Способ крепления", ["Внутренний"]),
  ]),
  define("kromkorezy-dlya-trub", "vneshnee-kreplenie", "Кромкорезы с внешним креплением", "Разъёмные и наружные модели для работы по внешнему диаметру.", [
    paramValues("Способ крепления", ["Внешний"]),
  ]),
  define("kromkorezy-dlya-trub", "elektricheskie", "Электрические кромкорезы для труб", "Модели с электрическим приводом для цеха и монтажной площадки.", [
    paramPattern("Доступные приводы", "Электрический"),
  ]),
  define("kromkorezy-dlya-trub", "pnevmaticheskie", "Пневматические кромкорезы для труб", "Модели с пневматическим приводом для производственных условий.", [
    paramPattern("Доступные приводы", "Пневматический"),
  ]),
  define("kromkorezy-dlya-trub", "stacionarnye", "Стационарные кромкорезы для труб", "Стационарные модели для повторяемой обработки трубных торцов.", [
    paramValues("Тип", ["Стационарный"]),
  ]),

  define("rezbonareznye-manipulyatory", "elektricheskie", "Электрические резьбонарезные манипуляторы", "Шарнирные манипуляторы с электрическим приводом для резьбонарезных операций.", [
    title("электрическ"),
  ]),
  define("rezbonareznye-manipulyatory", "pnevmaticheskie", "Пневматические резьбонарезные манипуляторы", "Модели с пневматическим приводом для производственных участков.", [
    title("пневматическ"),
  ]),
  define("rezbonareznye-manipulyatory", "do-m16", "Манипуляторы до М16", "Модели для нарезания резьбы до М10, М12 или М16.", [
    paramValues("Макс. резьба", ["М10", "М12", "М16"]),
  ]),
  define("rezbonareznye-manipulyatory", "m24-m36", "Манипуляторы М24–М36", "Оборудование для резьбы среднего и крупного диапазона.", [
    paramValues("Макс. резьба", ["М24", "М30", "М36"]),
  ]),
  define("rezbonareznye-manipulyatory", "ot-m42", "Манипуляторы от М42", "Модели для крупной резьбы М42, М48, М56 и М64.", [
    paramValues("Макс. резьба", ["М42", "М48", "М56", "М64"]),
  ]),
  define("rezbonareznye-manipulyatory", "osnastka", "Оснастка для резьбонарезных манипуляторов", "Втулки, позиционеры, опоры, установочные пластины и верстаки для комплектации резьбонарезного участка.", [
    title("комплект|позиционер|втулк|пластин|верстак|опор|плит"),
  ]),

  define("karetki-svarochnye", "uglovye-shvy", "Каретки для угловых швов", "Каретки, поддерживающие сварочные положения PB/2F и PA/1F.", [
    paramPattern("Положения сварки", "PB/2F|PA/1F"),
  ]),
  define("karetki-svarochnye", "stykovye-shvy", "Каретки для стыковых швов", "Модели для прямолинейных стыковых соединений и положения PA/1G.", [
    paramPattern("Положения сварки", "PA/1G|стыковой"),
  ]),
  define("karetki-svarochnye", "vertikalnaya-svarka", "Каретки для вертикальной сварки", "Модели, поддерживающие вертикальные положения PF/3G и PF/3F.", [
    paramPattern("Положения сварки", "PF/3"),
  ]),
  define("karetki-svarochnye", "dlya-trub", "Сварочные каретки для труб", "Каретки для автоматизации стыковых и угловых швов на трубах.", [
    paramPattern("Положения сварки", "труб"),
  ]),
  define("karetki-svarochnye", "s-oscillyatorom", "Каретки с осциллятором", "Модели с поперечными колебаниями горелки для формирования шва.", [
    { field: "param", name: "Особенности", pattern: "осцилл|колеб" },
  ]),

  define("karetki-termicheskoy-rezki", "gazovye", "Газорезательные каретки", "Каретки и машины для механизированной газокислородной резки.", [
    paramPattern("Тип резки", "Газовая"),
  ]),
  define("karetki-termicheskoy-rezki", "plazmennye", "Плазменные каретки", "Модели, предназначенные для механизации плазменной резки.", [
    paramPattern("Тип резки", "Плазменная"),
  ]),
  define("karetki-termicheskoy-rezki", "pryamolineynye", "Каретки для прямолинейной резки", "Машины для ровного продольного реза листа и заготовок.", [
    paramPattern("Назначение", "Прямолинейная"),
  ]),
  define("karetki-termicheskoy-rezki", "dlya-trub", "Каретки для резки труб", "Оборудование для механизированного реза труб по окружности.", [
    title("труб"),
  ]),
  define("karetki-termicheskoy-rezki", "krugovye", "Каретки для круговой резки", "Машины для вырезания окружностей и радиусных элементов.", [
    paramPattern("Назначение", "Круговая"),
  ]),

  define("pilnye-diski", "dlya-stali", "Пильные диски для стали", "Диски для резки конструкционной стали, профиля и металлических заготовок.", [
    title("по стали|для стали|сталь"),
  ]),
  define("pilnye-diski", "dlya-nerzhaveyushchey-stali", "Пильные диски для нержавеющей стали", "Диски с геометрией и материалом режущей части для обработки нержавеющей стали.", [
    title("нержав"),
  ]),
  define("pilnye-diski", "dlya-alyuminiya-i-plastika", "Диски для алюминия и пластика", "Пильные диски для алюминия, цветных металлов, пластиков и профильных систем.", [
    title("алюмин|пластик"),
  ]),
  define("pilnye-diski", "dlya-drevesiny", "Пильные диски для древесины", "Диски для продольного, поперечного и форматного раскроя древесины и плитных материалов.", [
    title("дерев|древес|ламинат|МДФ|ДСП|фанер"),
  ]),
  define("pilnye-diski", "cermet", "Пильные диски CERMET", "Диски с металлокерамическими зубьями для производительной резки металлических заготовок.", [
    title("CERMET|кермет"),
  ]),
  define("pilnye-diski", "dry-cutter", "Пильные диски Dry Cutter", "Диски для сухой резки стали, нержавеющей стали и сэндвич-панелей.", [
    title("Dry.?Cutter"),
  ]),

  define("kompressory", "porshnevye", "Поршневые компрессоры", "Поршневые компрессоры для мастерских, производственных участков и периодической нагрузки.", [
    title("поршнев"),
  ]),
  define("kompressory", "vintovye", "Винтовые компрессоры", "Винтовые компрессоры для продолжительной промышленной эксплуатации.", [
    title("винтов"),
  ]),
  define("kompressory", "bezmaslyanye", "Безмасляные компрессоры", "Компрессоры для задач, где требуется воздух без масляных примесей.", [
    paramPattern("Тип смазки", "Безмаслян"),
  ]),
  define("kompressory", "s-resiverom", "Компрессоры с ресивером", "Готовые компрессорные установки с ресивером для стабилизации давления и запаса воздуха.", [
    paramPattern("Ресивер", "^(?!Нет$).+"),
  ]),
  define("kompressory", "220-v", "Компрессоры на 220 В", "Модели для подключения к однофазной сети 220 В.", [
    paramPattern("Параметры питания, В", "^220$"),
  ]),
  define("kompressory", "380-v", "Компрессоры на 380 В", "Промышленные модели для трёхфазной сети 380 В.", [
    paramPattern("Параметры питания, В", "^380$"),
  ]),
  define("kompressory", "s-osushitelem", "Компрессоры с осушителем", "Компрессорные установки с осушителем для подготовки сжатого воздуха.", [
    paramPattern("Осушитель", ".+"),
  ]),

  define("metchiki", "mashinnye", "Машинные метчики", "Метчики для механизированного нарезания резьбы на станках и резьбонарезных манипуляторах.", [
    title("машинн"),
  ]),
  define("metchiki", "ruchnye", "Ручные метчики", "Метчики для ручного нарезания и восстановления внутренней резьбы.", [
    title("ручн"),
  ]),
  define("metchiki", "dlya-skvoznyh-otverstiy", "Метчики для сквозных отверстий", "Геометрия для отвода стружки вперёд при обработке сквозных отверстий.", [
    title("сквозн"),
  ]),
  define("metchiki", "dlya-gluhih-otverstiy", "Метчики для глухих отверстий", "Метчики для управляемого отвода стружки при обработке глухих отверстий.", [
    title("глух"),
  ]),
  define("metchiki", "kombinirovannye", "Комбинированные метчики-свёрла", "Комбинированный инструмент для сверления и последующего нарезания резьбы за один установ.", [
    title("комбинирован"),
  ]),
  {
    ...define("metchiki", "tverdosplavnye", "Твердосплавные метчики", "Износостойкие метчики для закалённых сталей и сложных материалов.", [
      title("твердосплав"),
    ]),
    minProducts: 1,
  },
  define("metchiki", "dyuymovaya-rezba", "Метчики для дюймовой резьбы", "Метчики стандартов UNC и UNF для нарезания дюймовой резьбы.", [
    title("UNC|UNF|дюйм"),
  ]),

  define("lentochnopilnye-stanki", "avtomaticheskie", "Автоматические ленточнопильные станки", "Автоматические станки для серийной резки заготовок с минимальным участием оператора.", [
    title("(^|\\s)автоматическ"),
  ]),
  define("lentochnopilnye-stanki", "poluavtomaticheskie", "Полуавтоматические ленточнопильные станки", "Полуавтоматические модели для повторяемой производственной резки.", [
    title("полуавтоматическ"),
  ]),
  define("lentochnopilnye-stanki", "dvuhkolonnye", "Двухколонные ленточнопильные станки", "Жёсткие двухколонные станки для производительной резки крупного проката.", [
    paramPattern("Тип исполнения", "Двухколонное"),
  ]),
  define("lentochnopilnye-stanki", "mayatnikovye", "Маятниковые ленточнопильные станки", "Маятниковые станки для универсальной резки профиля и сплошных заготовок.", [
    paramPattern("Тип исполнения", "Маятниковое"),
  ]),
  define("lentochnopilnye-stanki", "osnastka", "Оснастка для ленточнопильных станков", "Рольганги, упоры, измерительные устройства, прижимы, щётки и принадлежности для станков.", [
    title("полотно|рольганг|измерительн|опор|упор|каретк|щетк|прижим|линии реза|устройств|регулятор"),
  ]),

  define("shlifovalnoe-i-zatochnoe-oborudovanie", "lentochnye", "Ленточно-шлифовальные станки", "Ленточные станки и гриндеры для зачистки, шлифования и обработки сварных швов.", [
    title("ленточн.*шлиф|шлиф.*ленточн|гриндер"),
  ]),
  define("shlifovalnoe-i-zatochnoe-oborudovanie", "dlya-sverl", "Станки для заточки свёрл", "Оборудование для восстановления геометрии спиральных и корончатых свёрл.", [
    title("заточ.*сверл|сверл.*заточ"),
  ]),
  define("shlifovalnoe-i-zatochnoe-oborudovanie", "dlya-pilnyh-diskov", "Станки для заточки пильных дисков", "Ручные, автоматические и ЧПУ-станки для заточки зубьев пильных дисков.", [
    title("заточ.*пильн.*диск|пильн.*диск.*заточ"),
  ]),
  define("shlifovalnoe-i-zatochnoe-oborudovanie", "universalnye-zatochnye", "Универсальные заточные станки", "Станки для заточки фрез, резцов и другого металлорежущего инструмента.", [
    title("универсальн.*заточ|заточ.*инструмент|заточ.*резц|заточ.*фрез"),
  ]),
  define("shlifovalnoe-i-zatochnoe-oborudovanie", "pnevmaticheskie", "Пневматические шлифовальные машины", "Компактные пневматические машины для зачистки и шлифования в производственных условиях.", [
    title("пневмат"),
  ]),

  define("magnitnaya-osnastka", "ugolniki-i-fiksatory", "Магнитные угольники и фиксаторы", "Оснастка для быстрой фиксации деталей при сборке и сварке.", [
    title("угольник|фиксатор"),
  ]),
  define("magnitnaya-osnastka", "plity-i-patrony", "Магнитные плиты и патроны", "Магнитные плиты и патроны для удержания заготовок на металлообрабатывающем оборудовании.", [
    title("плит|патрон"),
  ]),
  define("magnitnaya-osnastka", "dlya-trub", "Магнитная оснастка для труб", "Фиксаторы и угольники, рассчитанные на позиционирование труб и круглых деталей.", [
    paramValues("Подходит для труб", ["Да"]),
  ]),
  define("magnitnaya-osnastka", "reguliruemyy-ugol", "Оснастка с регулировкой угла", "Магнитные фиксаторы с регулируемым рабочим углом.", [
    paramValues("Регулировка угла", ["Да"]),
  ]),
  define("magnitnaya-osnastka", "struzhkosborniki", "Магнитные стружкосборники", "Приспособления для быстрого сбора металлической стружки с рабочей зоны.", [
    title("стружк"),
  ]),

  define("almaznoe-burenie", "ustanovki", "Установки алмазного бурения", "Оборудование для сверления отверстий в бетоне, кирпиче и железобетоне.", [
    title("установк"),
  ]),
  define("almaznoe-burenie", "koronki", "Алмазные коронки", "Коронки для установок алмазного бурения с подбором по диаметру, длине и хвостовику.", [
    title("коронк"),
  ]),
  define("almaznoe-burenie", "podrozetniki", "Коронки для подрозетников", "Алмазные коронки для сухого и мокрого сверления отверстий под подрозетники.", [
    title("подрозет"),
  ]),
  define("almaznoe-burenie", "dlya-zhelezobetona", "Алмазные коронки для железобетона", "Коронки для сверления армированного бетона и железобетонных конструкций.", [
    paramPattern("Материал", "железобет|армирован"),
  ]),

  define("svarochnye-vrashchateli-i-pozitsionery", "pozicionery", "Сварочные позиционеры", "Поворотные столы и позиционеры для установки изделия в удобное положение при сварке.", [
    title("позиционер"),
  ]),
  define("svarochnye-vrashchateli-i-pozitsionery", "vrashchateli", "Сварочные вращатели", "Роликовые вращатели для сварки обечаек, резервуаров и цилиндрических изделий.", [
    title("вращател"),
  ]),
  define("svarochnye-vrashchateli-i-pozitsionery", "samocentriruyushchiesya", "Самоцентрирующиеся вращатели", "Вращатели с автоматическим согласованием положения роликов под диаметр изделия.", [
    paramValues("Тип настройки роликов", ["Самоцентрирующийся"]),
  ]),
  define("svarochnye-vrashchateli-i-pozitsionery", "osnastka", "Оснастка для позиционеров и вращателей", "Патроны, держатели, пульты, ролики и приспособления для комплектации сварочного участка.", [
    title("патрон|держател|консол|педал|пульт|ролик|задн.*бабк|оснаст|прижим|направляющ|пинол"),
  ]),

  {
    ...define("zahvaty-dlya-gruzov", "akkumulyatornye", "Аккумуляторные электромагнитные захваты", "Автономные электромагнитные захваты с аккумуляторным питанием.", [
      title("аккумулятор|электромагнит"),
    ]),
    minProducts: 1,
  },
  {
    ...define("zahvaty-dlya-gruzov", "avtomaticheskie", "Автоматические магнитные захваты", "Захваты с автоматизированным включением и отключением груза.", [
      title("автомат"),
    ]),
    minProducts: 1,
  },
  define("zahvaty-dlya-gruzov", "ruchnye", "Ручные магнитные захваты", "Компактные ручные захваты для переноски и позиционирования листа и деталей.", [
    title("ручн"),
  ]),
  define("zahvaty-dlya-gruzov", "ot-1000-kg", "Захваты от 1000 кг", "Магнитные грузозахваты грузоподъёмностью от 1000 кг для тяжёлых заготовок.", [
    paramPattern("Грузоподъемность", "^(1000|1500|2000|3000|5000|6000|10000)"),
  ]),

  define("sozh-i-sots", "zhidkosti-i-koncentraty", "СОЖ и концентраты", "Смазочно-охлаждающие жидкости и концентраты для приготовления рабочих эмульсий.", [
    title("жидк|концентрат"),
  ]),
  define("sozh-i-sots", "masla", "Масла для металлообработки", "Масла для резьбонарезных, сверлильных и других операций обработки металла.", [
    title("масл"),
  ]),
  define("sozh-i-sots", "pasty-i-smazki", "Пасты и смазки", "Пастообразные и консистентные составы для резки и обслуживания оборудования.", [
    title("паст|смазк"),
  ]),
  define("sozh-i-sots", "sprei-i-pena", "Смазочные спреи и пена", "Готовые к применению аэрозольные и пенные составы для локальной подачи.", [
    title("спрей|пен"),
  ]),
  {
    ...define("sozh-i-sots", "vosk", "Смазочный воск", "Воск для сухой и малосмазочной обработки металла.", [
      title("воск"),
    ]),
    minProducts: 1,
  },

  define("disko-otreznye-stanki", "avtomaticheskie", "Автоматические дисковые станки", "Автоматические отрезные станки для серийного производства и пакетной резки.", [
    title("(^|\\s)автоматическ"),
  ]),
  define("disko-otreznye-stanki", "poluavtomaticheskie", "Полуавтоматические дисковые станки", "Полуавтоматические модели для повторяемого производственного реза.", [
    title("полуавтоматическ"),
  ]),
  define("disko-otreznye-stanki", "mayatnikovye", "Маятниковые дисковые станки", "Маятниковые станки для точной резки профиля и металлических заготовок.", [
    paramValues("Тип", ["Маятниковые"]),
  ]),
  define("disko-otreznye-stanki", "vertikalnye", "Вертикальные дисковые станки", "Станки с вертикальной кинематикой подачи пильного узла.", [
    paramValues("Тип", ["Вертикальные"]),
  ]),

  define("vibroopory", "reguliruemye", "Регулируемые виброопоры", "Регулируемые опоры для выравнивания и виброизоляции станков.", [
    title("регулируем"),
  ]),
  {
    ...define("vibroopory", "precizionnye", "Прецизионные виброопоры", "Высокоточные виброизолирующие опоры для чувствительного оборудования.", [
      title("прецизион"),
    ]),
    minProducts: 1,
  },

  define("verstaki", "razbornye", "Разборные промышленные верстаки", "Разборные верстаки для удобной доставки и организации производственного рабочего места.", [
    title("разборн"),
  ]),
  {
    ...define("verstaki", "reguliruemye", "Регулируемые верстаки", "Верстаки с регулировкой параметров рабочего места.", [
      title("регулируем"),
    ]),
    minProducts: 1,
  },
  {
    ...define("verstaki", "s-ekranom", "Верстаки с инструментальным экраном", "Комплектные рабочие места с экраном для размещения инструмента и принадлежностей.", [
      title("экран"),
    ]),
    minProducts: 1,
  },

  define("sverla-i-zenkovki", "tverdosplavnye-sverla", "Твердосплавные сверла", "Высокопроизводительные сверла для серийной обработки сталей, сплавов и сложных материалов.", [
    { field: "feedCategory", values: ["25"] },
  ]),
  define("sverla-i-zenkovki", "sverla-hss", "Спиральные сверла HSS", "Сверла из быстрорежущей стали для универсальных операций по металлу.", [
    { field: "feedCategory", values: ["26"] },
  ]),
  define("sverla-i-zenkovki", "stupenchatye-i-konicheskie", "Ступенчатые и конические сверла", "Инструмент для получения отверстий нескольких диаметров и обработки тонколистового металла.", [
    { field: "feedCategory", values: ["22", "27"] },
  ]),
  define("sverla-i-zenkovki", "zenkovki", "Зенковки", "Инструмент для снятия фаски, удаления заусенцев и подготовки посадочных поверхностей отверстий.", [
    { field: "feedCategory", values: ["220"] },
  ]),
  define("sverla-i-zenkovki", "cekovki-i-zenkery", "Цековки и зенкеры", "Инструмент для чистовой обработки отверстий и формирования плоских посадочных поверхностей.", [
    { field: "feedCategory", values: ["110", "219"] },
  ]),
  define("sverla-i-zenkovki", "termicheskie-sverla", "Термические сверла", "Комплекты для формования втулки в металле без удаления стружки и последующего нарезания резьбы.", [
    { field: "feedCategory", values: ["408"] },
  ]),
  define("sverla-i-zenkovki", "korpusnye-sverla", "Корпусные сверла", "Корпусы со сменными режущими головками для производительного сверления на станках.", [
    { field: "feedCategory", values: ["23"] },
  ]),

  define("stanki-lazernoy-rezki", "dlya-lista", "Лазерные станки для листового металла", "Станки для раскроя листа с различной рабочей зоной, мощностью и уровнем автоматизации.", [
    { field: "feedCategory", values: ["482"] },
  ]),
  define("stanki-lazernoy-rezki", "dlya-trub", "Лазерные труборезы", "Станки для резки круглых, квадратных и профильных труб.", [
    { field: "feedCategory", values: ["483"] },
  ]),
  define("stanki-lazernoy-rezki", "list-i-truba", "Комбинированные станки для листа и труб", "Одна система для плоского раскроя и лазерной резки трубного проката.", [
    { field: "feedCategory", values: ["484"] },
  ]),
  define("stanki-lazernoy-rezki", "s-zashchitnoy-kabinoy", "Станки с защитной кабиной", "Закрытые комплексы для повышения безопасности и контроля зоны лазерной обработки.", [
    paramValues("Наличие защитной кабины", ["Да"]),
  ]),
  define("stanki-lazernoy-rezki", "so-smennym-stolom", "Станки со сменным столом", "Конфигурации для сокращения простоев между загрузкой листа и резкой.", [
    paramValues("Наличие сменного стола", ["Да"]),
  ]),

  define("svarochnye-roboty", "komplekty-pod-klyuch", "Сварочные роботы в комплекте", "Комплексы с источником сварки, управлением и периферией для ускоренного внедрения.", [
    title("в комплекте|с источником сварки|комплекс"),
  ]),
  {
    ...define("svarochnye-roboty", "robotizirovannye-yacheyki", "Роботизированные сварочные ячейки", "Готовые защищённые рабочие зоны для автоматизированной сварки серийных изделий.", [
      { field: "feedCategory", values: ["673"] },
      title("ячейк"),
    ]),
    minProducts: 1,
  },
  {
    ...define("svarochnye-roboty", "koboty", "Коботы для сварки", "Коллаборативные решения для гибкой автоматизации малых и средних серий.", [
      title("кобот|коллаборатив"),
    ]),
    minProducts: 1,
  },
  {
    ...define("svarochnye-roboty", "lazernaya-svarka", "Роботы для лазерной сварки", "Роботизированные системы для высокоскоростной лазерной сварки и обработки.", [
      title("лазер"),
    ]),
    minProducts: 1,
  },

  {
    ...define("stanochnaya-osnastka", "startovye-komplekty", "Стартовые комплекты оснастки", "Готовые наборы базовых оправок и принадлежностей для запуска нового станка.", [
      title("стартов.*комплект"),
    ]),
    minProducts: 1,
  },
  {
    ...define("stanochnaya-osnastka", "smena-instrumenta", "Устройства смены инструмента", "Вспомогательные устройства для ускорения и упрощения смены оснастки.", [
      title("смены инструмента"),
    ]),
    minProducts: 1,
  },
];

// Проверенные редакционные настройки живут поверх snapshot из админки и фида.
// Это защищает точные SEO-посадочные от возврата к общему шаблонному тексту
// после очередного экспорта каталога.
const reviewedContentOverrides: Record<string, Partial<SubcategoryDefinition>> = {
  "stanki-sverlilnye/magnitnye": {
    shortDescription: "Магнитные сверлильные станки на электромагнитном основании для сверления металлоконструкций.",
    intro: "Магнитные сверлильные станки по металлу для корончатого и спирального сверления на металлоконструкциях. Сравните модели по максимальному диаметру, шпинделю, реверсу и основанию, затем запросите подбор станка и совместимой оснастки.",
    metaTitle: "Магнитные сверлильные станки по металлу — купить в 7TOOL",
    metaDescription: "Магнитные сверлильные станки на электромагнитном основании. Подбор по диаметру сверления, шпинделю и реверсу, цены с НДС и доставка по России.",
    keywords: [
      "магнитный сверлильный станок",
      "магнитный сверлильный станок купить",
      "сверлильный станок на магнитном основании",
      "станок на магнитной подошве",
      "магнитная дрель",
      "машина сверлильная на электромагнитном основании",
      "станок для корончатого сверления",
    ],
    seoTitle: "Как выбрать магнитный сверлильный станок",
    seoText: [
      "Основные исходные данные — требуемый диаметр и глубина отверстия, материал и толщина заготовки, положение работы и доступное пространство. Затем сравнивают максимальный диаметр сверления, рабочий ход, шпиндель, число скоростей и параметры основания по паспорту конкретной модели.",
      "Для корончатого сверления заранее проверяют совместимость хвостовика и допустимый диапазон оснастки. Если в задаче есть нарезание резьбы, отдельно проверяют реверс, регулировку частоты вращения и допустимый размер метчика. Наличие функции нельзя определять только по названию товара.",
      "Станок и расходные материалы лучше подбирать как комплект: корончатое сверло, направляющий штифт и СОЖ должны соответствовать выбранной серии и операции. В форме подбора укажите параметры задачи — специалист сопоставит их с характеристиками конкретных моделей.",
    ].join("\n\n"),
    selectionTitle: "Подбор магнитного сверлильного станка",
    selectionFields: [
      { name: "hole", label: "Отверстие: диаметр и глубина", placeholder: "Например, Ø35 мм, глубина 50 мм" },
      { name: "workpiece", label: "Заготовка и положение работы", placeholder: "Материал, толщина; горизонтально, вертикально или над головой" },
      { name: "operations", label: "Операции и оснастка", placeholder: "Корончатое/спиральное сверление, резьба; хвостовик" },
    ],
    relatedLinks: [
      { href: "/c/koronchatye-sverla", label: "Корончатые свёрла по металлу" },
      { href: "/c/koronchatye-sverla/weldon-19", label: "Корончатые свёрла Weldon 19" },
    ],
    faq: [
      {
        question: "Чем магнитный станок отличается от стационарного?",
        answer: "Магнитная модель предназначена для фиксации на подходящей металлической поверхности непосредственно у места обработки. Стационарный станок устанавливают в цехе; окончательный выбор зависит от детали, операции и условий работы.",
      },
      {
        question: "Какой диаметр сверления указывать при подборе?",
        answer: "Нужен максимальный планируемый диаметр и тип инструмента: корончатое или спиральное сверло. Эти пределы в паспорте станка могут отличаться.",
      },
      {
        question: "Когда нужен реверс?",
        answer: "Реверс проверяют, если планируется нарезание резьбы или другая операция, для которой он предусмотрен производителем. Наличие функции берётся из характеристик конкретной модели.",
      },
      {
        question: "Можно ли сразу подобрать корончатые свёрла?",
        answer: "Да. Для этого сопоставляют шпиндель станка, хвостовик, диаметры, рабочую длину и рекомендации производителя оснастки.",
      },
    ],
  },
};

// Порядок в массиве отражает пользовательский сценарий внутри каждой категории.
// У явных админских настроек sortOrder остаётся приоритет.
baseDefinitions.forEach((definition, index) => {
  if (definition.sortOrder == null) definition.sortOrder = index;
});

const definitions: SubcategoryDefinition[] = (() => {
  const byKey = new Map(baseDefinitions.map((item) => [`${item.categorySlug}/${item.slug}`, item]));
  for (const raw of subcategoryOverrides) {
    const categorySlug = typeof raw.categorySlug === "string" ? raw.categorySlug : "";
    const slug = typeof raw.slug === "string" ? raw.slug : "";
    if (!categorySlug || !slug) continue;
    const current = byKey.get(`${categorySlug}/${slug}`);
    const rules = Array.isArray(raw.rules) ? raw.rules as SubcategoryRule[] : current?.rules ?? [];
    const next: SubcategoryDefinition = {
      ...(current ?? define(categorySlug, slug, String(raw.title || slug), String(raw.shortDescription || ""), rules)),
      ...(raw as Partial<SubcategoryDefinition>),
      categorySlug,
      slug,
      rules,
    };
    byKey.set(`${categorySlug}/${slug}`, next);
  }
  for (const [key, reviewed] of Object.entries(reviewedContentOverrides)) {
    const current = byKey.get(key);
    if (!current) continue;
    byKey.set(key, { ...current, ...reviewed });
  }
  return Array.from(byKey.values()).sort((a, b) =>
    a.categorySlug.localeCompare(b.categorySlug) ||
    (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
    a.title.localeCompare(b.title, "ru"),
  );
})();

function define(
  categorySlug: string,
  slug: string,
  titleText: string,
  shortDescription: string,
  rules: SubcategoryRule[],
): SubcategoryDefinition {
  return {
    slug,
    categorySlug,
    title: titleText,
    h1: titleText,
    shortDescription,
    intro: `${shortDescription} В подборке показаны актуальные модели и модификации с характеристиками, ценой с НДС и статусом доступности.`,
    seoText: `${shortDescription} При выборе сопоставьте характеристики модификации с параметрами задачи и используемой оснасткой. В карточках указаны доступные по фиду артикулы, размеры, цены и наличие. Если исходных данных недостаточно, отправьте запрос на инженерный подбор — специалист проверит совместимость по конкретной модели и артикулу.`,
    metaTitle: `${titleText} — купить`,
    metaDescription: `${shortDescription} Сравните модели и артикулы: характеристики, актуальные цены с НДС, наличие, инженерный подбор и доставка по России.`,
    imageAlt: `${titleText} в каталоге 7TOOL`,
    published: true,
    minProducts: 2,
    match: "any",
    rules,
    formEnabled: true,
    formPosition: "after_products",
  };
}

function title(pattern: string): TitleRule {
  return { field: "title", pattern };
}

function paramValues(name: string, values: string[]): ParamRule {
  return { field: "param", name, values };
}

function paramPattern(name: string, pattern: string): ParamRule {
  return { field: "param", name, pattern };
}

function matchesRule(product: Product, rule: SubcategoryRule): boolean {
  if (rule.field === "title") return new RegExp(rule.pattern, "iu").test(product.title);
  if (rule.field === "brand") return rule.values.some((value) => value.toLowerCase() === product.brand.toLowerCase());
  if (rule.field === "feedCategory") return Boolean(product.feedCategoryId && rule.values.includes(product.feedCategoryId));
  const ruleName = cleanParamName(rule.name);
  const params = product.variants
    .flatMap((variant) => variant.params)
    .filter((param) => cleanParamName(param.name) === ruleName);
  if (rule.values?.length) {
    return params.some((param) => rule.values!.some((value) => value.toLowerCase() === `${param.value}${param.unit ? ` ${param.unit}` : ""}`.toLowerCase()));
  }
  return rule.pattern ? params.some((param) => new RegExp(rule.pattern!, "iu").test(`${param.value}${param.unit ? ` ${param.unit}` : ""}`)) : false;
}

export function matchesSubcategory(product: Product, subcategory: SubcategoryDefinition): boolean {
  if (product.category !== subcategory.categorySlug) return false;
  const results = subcategory.rules.map((rule) => matchesRule(product, rule));
  return subcategory.match === "all" ? results.every(Boolean) : results.some(Boolean);
}

function resolve(definition: SubcategoryDefinition): ResolvedSubcategory {
  const manualIds = new Set(definition.manualProductIds ?? []);
  const items = products.filter((product) => manualIds.has(product.id) || matchesSubcategory(product, definition));
  return {
    ...definition,
    items,
    count: items.length,
    categoryTitle: categories.find((category) => category.slug === definition.categorySlug)?.title ?? definition.categorySlug,
  };
}

export function getSubcategoriesForCategory(categorySlug: string): ResolvedSubcategory[] {
  return definitions
    .filter((definition) => definition.categorySlug === categorySlug && definition.published)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.title.localeCompare(b.title, "ru"))
    .map(resolve)
    .filter((subcategory) => subcategory.count >= subcategory.minProducts);
}

export function getSubcategory(categorySlug: string, slug: string): ResolvedSubcategory | undefined {
  const definition = definitions.find((item) => item.categorySlug === categorySlug && item.slug === slug && item.published);
  if (!definition) return undefined;
  const result = resolve(definition);
  return result.count >= result.minProducts ? result : undefined;
}

export function publishedSubcategories(): ResolvedSubcategory[] {
  return definitions.map(resolve).filter((subcategory) => subcategory.published && subcategory.count >= subcategory.minProducts);
}

export function allSubcategoryDefinitions(): SubcategoryDefinition[] {
  return definitions;
}
