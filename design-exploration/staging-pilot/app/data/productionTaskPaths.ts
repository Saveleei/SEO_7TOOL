export type ProductionTaskPath = {
  id: string;
  label: string;
  title: string;
  copy: string;
  image?: string;
  categorySlugs: string[];
  firstLabel: string;
  firstOptions: string[];
  secondLabel: string;
  secondOptions: string[];
  result: string;
  resultCopy: string;
  href: string | null;
  action: string;
  featured?: boolean;
};

const definitions: ProductionTaskPath[] = [
  { id:"drilling", label:"Сверление", title:"Сверлить металл", copy:"Станок и совместимая оснастка", image:"/category/stanki-sverlilnye.webp", categorySlugs:["stanki-sverlilnye","koronchatye-sverla"], firstLabel:"Диаметр отверстия", firstOptions:["до 35 мм","36–60 мм","более 60 мм"], secondLabel:"Где работаете", secondOptions:["На монтаже","В цехе","Оба сценария"], result:"Магнитные сверлильные станки", resultCopy:"Сравните открытые модели по диаметру, массе, шпинделю и функциям.", href:"/catalog/sverlenie/magnitnye-stanki", action:"Смотреть модели", featured:true },
  { id:"edge", label:"Фаска", title:"Снимать фаску", copy:"Кромкорез под заготовку и размер фаски", image:"/category/kromkorezy-po-listu.webp", categorySlugs:["kromkorezy-po-listu","kromkorezy-dlya-trub"], firstLabel:"Тип заготовки", firstOptions:["Лист","Труба","Отверстие"], secondLabel:"Размер фаски", secondOptions:["до 5 мм","6–15 мм","более 15 мм"], result:"Подбор кромкореза по задаче", resultCopy:"Инженер проверит геометрию, материал, угол и требуемую производительность.", href:null, action:"Передать параметры", featured:true },
  { id:"cutting", label:"Резка", title:"Резать металл", copy:"Решение под профиль и требуемый рез", image:"/category/truborezy.webp", categorySlugs:["truborezy","karetki-termicheskoy-rezki","stanki-lazernoy-rezki","lentochnopilnye-stanki","disko-otreznye-stanki"], firstLabel:"Что режем", firstOptions:["Трубу","Профиль","Лист"], secondLabel:"Главный приоритет", secondOptions:["Мобильность","Чистота реза","Скорость"], result:"Подбор оборудования для резки", resultCopy:"Сопоставим материал, размеры заготовки, допуск и условия работы.", href:null, action:"Передать параметры", featured:true },
  { id:"welding", label:"Сварка", title:"Автоматизировать сварку", copy:"Каретка, вращатель или роботизированное решение", image:"/category/karetki-svarochnye.webp", categorySlugs:["karetki-svarochnye","svarochnye-roboty","svarochnye-vrashchateli-i-pozitsionery"], firstLabel:"Тип шва", firstOptions:["Прямой","Кольцевой","Повторяемый узел"], secondLabel:"Режим производства", secondOptions:["Пилот","Серия","Непрерывный"], result:"Инженерный подбор автоматизации", resultCopy:"Уточним изделие, процесс, цикл и ожидаемую производительность.", href:null, action:"Передать параметры", featured:true },
  { id:"holes", label:"Отверстия", title:"Обработать отверстие", copy:"Сверло, зенковка или цековка", categorySlugs:["sverla-i-zenkovki","almaznoe-burenie"], firstLabel:"Операция", firstOptions:["Сверление","Зенкование","Цекование"], secondLabel:"Материал", secondOptions:["Сталь","Нержавейка","Цветной металл"], result:"Подбор инструмента для отверстий", resultCopy:"Уточним диаметр, глубину, материал и посадку инструмента.", href:null, action:"Передать параметры" },
  { id:"threading", label:"Резьба", title:"Нарезать резьбу", copy:"Манипулятор, метчик и защитная оснастка", categorySlugs:["rezbonareznye-manipulyatory","metchiki"], firstLabel:"Диапазон резьбы", firstOptions:["до М12","М14–М24","свыше М24"], secondLabel:"Режим", secondOptions:["Разовые работы","Рабочее место","Серийный цикл"], result:"Подбор резьбонарезного комплекта", resultCopy:"Сопоставим привод, рабочую зону, метчик и предохранительную цангу.", href:null, action:"Передать параметры" },
  { id:"finishing", label:"Поверхность", title:"Зачищать и шлифовать", copy:"Борфреза или шлифовальное оборудование", categorySlugs:["borfrezy","shlifovalnoe-i-zatochnoe-oborudovanie"], firstLabel:"Операция", firstOptions:["Снять заусенец","Зачистить шов","Обработать кромку"], secondLabel:"Материал", secondOptions:["Сталь","Нержавейка","Алюминий"], result:"Подбор инструмента для поверхности", resultCopy:"Проверим форму, тип насечки или класс оборудования под режим работы.", href:null, action:"Передать параметры" },
  { id:"handling", label:"Перемещение", title:"Поднять или повернуть", copy:"Захват, вращатель или позиционер", categorySlugs:["zahvaty-dlya-gruzov","magnitnaya-osnastka","svarochnye-vrashchateli-i-pozitsionery"], firstLabel:"Что перемещаем", firstOptions:["Лист","Трубу","Сварной узел"], secondLabel:"Масса", secondOptions:["до 300 кг","300–1000 кг","более 1000 кг"], result:"Подбор захвата или позиционера", resultCopy:"Проверим массу, центр тяжести, геометрию и безопасный способ фиксации.", href:null, action:"Передать параметры" },
  { id:"air", label:"Пневматика", title:"Обеспечить сжатым воздухом", copy:"Компрессор под потребление и режим", categorySlugs:["kompressory"], firstLabel:"Потребители", firstOptions:["Один инструмент","Рабочий пост","Линия"], secondLabel:"Режим", secondOptions:["Периодически","Одна смена","Непрерывно"], result:"Подбор компрессорного оборудования", resultCopy:"Уточним расход, давление, качество воздуха и допустимый режим нагрузки.", href:null, action:"Передать параметры" },
  { id:"workplace", label:"Оснащение", title:"Оснастить рабочее место", copy:"Оснастка, расходники и производственная мебель", categorySlugs:["stanochnaya-osnastka","pilnye-diski","sozh-i-sots","vibroopory","verstaki"], firstLabel:"Что требуется", firstOptions:["Оснастка","Расходники","Рабочее место"], secondLabel:"Сценарий", secondOptions:["Новое оснащение","Замена","Модернизация"], result:"Комплектование рабочего места", resultCopy:"Проверим совместимость со станком, операцией и требованиями к участку.", href:null, action:"Передать параметры" },
];

// Снимок активных разделов пилота. В production сюда передаётся список категорий из фида.
export const pilotFeedCategorySlugs = [
  "stanki-sverlilnye", "koronchatye-sverla", "borfrezy", "truborezy", "kromkorezy-po-listu", "kromkorezy-dlya-trub",
  "karetki-svarochnye", "rezbonareznye-manipulyatory", "karetki-termicheskoy-rezki", "sverla-i-zenkovki", "stanki-lazernoy-rezki",
  "svarochnye-roboty", "metchiki", "lentochnopilnye-stanki", "shlifovalnoe-i-zatochnoe-oborudovanie", "magnitnaya-osnastka",
  "almaznoe-burenie", "svarochnye-vrashchateli-i-pozitsionery", "zahvaty-dlya-gruzov", "disko-otreznye-stanki", "kompressory",
  "stanochnaya-osnastka", "pilnye-diski", "sozh-i-sots", "vibroopory", "verstaki",
];

export function getProductionTaskPaths(activeCategorySlugs: string[]): ProductionTaskPath[] {
  const active = new Set(activeCategorySlugs);
  return definitions.filter((task) => task.categorySlugs.some((slug) => active.has(slug)));
}
