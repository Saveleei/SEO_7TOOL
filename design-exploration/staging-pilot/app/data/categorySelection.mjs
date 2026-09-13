const exact = "exact";
const minimum = "minimum";

export const categorySelectionRules = Object.freeze({
  "koronchatye-sverla": Object.freeze({ "диаметр режущей":exact, "рабочая длина":minimum, "материал":exact }),
  "kromkorezy-po-listu": Object.freeze({ "макс. ширина фаски":minimum, "угол фаски":exact, "возможности":exact }),
  "kromkorezy-dlya-trub": Object.freeze({
    "макс. диаметр тру":Object.freeze({ mode:"range", minimumKeyword:"мин. диаметр тру", question:"Диаметр вашей трубы, мм" }),
    "способ крепления":exact,
    "возможности":exact,
  }),
  "rezbonareznye-manipulyatory": Object.freeze({ "макс. резьба":minimum, "рабочий радиус":minimum, "охват рабочей зоны":minimum }),
  "truborezy": Object.freeze({ "макс. диаметр тру":minimum, "макс. толщина стен":minimum, "диапазон труб":exact }),
  "karetki-svarochnye": Object.freeze({ "положения сварки":exact, "движение каретки":exact, "особенности":exact }),
  "pilnye-diski": Object.freeze({ "диаметр диска":exact, "посадочное отверстие":exact, "материал":exact }),
  "karetki-termicheskoy-rezki": Object.freeze({ "назначение":exact, "тип резки":exact, "макс. толщина резки":minimum }),
  "metchiki": Object.freeze({ "резьба":exact, "материал":exact, "стандарт":exact }),
  "lentochnopilnye-stanki": Object.freeze({ "макс. ширина заготовки":minimum, "макс. диаметр круглого профиля при резке 90":minimum, "угол поворота пильной рамы":exact }),
  "shlifovalnoe-i-zatochnoe-oborudovanie": Object.freeze({ "тип затачиваемого инструмента":exact, "диаметр сверла":minimum, "частота вращения":exact }),
  "magnitnaya-osnastka": Object.freeze({ "тип фиксатора":exact, "усилие на отрыв":minimum, "рабочий угол":exact }),
  "almaznoe-burenie": Object.freeze({ "диаметр режущей":exact, "материал":exact, "рабочая длина":minimum }),
  "svarochnye-vrashchateli-i-pozitsionery": Object.freeze({ "грузоподъемность (позиционеры)":minimum, "макс. диаметр обечайки":minimum, "тип настройки роликов":exact }),
  "zahvaty-dlya-gruzov": Object.freeze({ "грузоподъемность":minimum, "толщина стали":minimum, "включение/выключение":exact }),
  "sozh-i-sots": Object.freeze({ "вид":exact, "форма выпуска":exact, "объем":exact }),
  "disko-otreznye-stanki": Object.freeze({ "диаметр диска":exact, "тип":exact, "угол реза":exact }),
  "kompressory": Object.freeze({ "производительность":minimum, "объем ресивера":minimum, "мощность":exact }),
  "sverla-i-zenkovki": Object.freeze({ "диаметр режущей":exact, "мин. диаметр зенкования":exact, "диаметр хвостовика":exact }),
  "stanki-lazernoy-rezki": Object.freeze({ "мощность, вт":minimum, "длина рабочего стола":minimum, "наличие защитной кабины":exact }),
  "svarochnye-roboty": Object.freeze({ "макс. охват":minimum, "доп. возможности":exact }),
  "stanochnaya-osnastka": Object.freeze({}),
});

export function getCategorySelectionRule(slug, keyword = "") {
  const configured = categorySelectionRules[slug]?.[keyword];
  const rule = typeof configured === "string" ? { mode:configured } : configured ?? { mode:exact };
  const hint = rule.mode === "range"
    ? "Проверим, что размер входит между нижней и верхней границей рабочего диапазона."
    : rule.mode === minimum
      ? "Покажем исполнения со значением не меньше выбранного."
      : "Покажем исполнения с точным совпадением выбранного параметра.";
  return { ...rule, hint };
}

export function parseCategorySelectionNumber(value) {
  const match = String(value ?? "").replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  const parsed = Number.parseFloat(match?.[0] ?? "");
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function findCategorySelectionOption(options = [], numericValue) {
  if (!Number.isFinite(numericValue)) return undefined;
  return options.find((option) => parseCategorySelectionNumber(option.value) === numericValue);
}

export function buildCategorySelectionUrl({ pathname, search = "", selections = [] }) {
  const params = new URLSearchParams(search);
  params.delete("page");
  for (const selection of selections) {
    const exactKey = `f_${selection.key}`;
    const minimumKey = `min_${selection.key}`;
    params.delete(exactKey);
    params.delete(minimumKey);
    if (selection.minimumFacetKey) params.delete(`max_${selection.minimumFacetKey}`);
    if (!selection.value) continue;
    if (selection.mode === "minimum" || selection.mode === "range") {
      const numericValue = parseCategorySelectionNumber(selection.value);
      if (!Number.isFinite(numericValue)) continue;
      params.set(minimumKey, String(numericValue));
      if (selection.mode === "range" && selection.minimumFacetKey) params.set(`max_${selection.minimumFacetKey}`, String(numericValue));
    } else {
      params.append(exactKey, selection.value);
    }
  }
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}#products`;
}

export function buildCategorySelectionContext(categoryTitle, selections) {
  const selected = selections.filter((selection) => selection.value);
  const details = selected.length > 0
    ? selected.map((selection) => selection.mode === "range"
      ? `${selection.label}: ${selection.value}, проверить попадание в рабочий диапазон`
      : selection.mode === "minimum"
        ? `${selection.label}: требуется не менее ${selection.value}`
        : `${selection.label}: ${selection.value}`).join("; ")
    : "структурированные параметры в фиде отсутствуют или пока не выбраны";
  return `Категория: ${categoryTitle}. Известные параметры: ${details}. Нужна проверка совместимости и подходящего исполнения.`;
}
