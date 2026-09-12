export const drillWorkOptions = Object.freeze([
  Object.freeze({ id:"installation", label:"Монтаж на конструкции", hint:"Нужен переносной станок для работы непосредственно на детали" }),
  Object.freeze({ id:"workshop", label:"Стационарная работа в цехе", hint:"Станок устанавливается на рабочем месте или участке" }),
  Object.freeze({ id:"unknown", label:"Пока не знаю", hint:"Покажем оборудование без ограничения по типу установки" }),
]);

export const drillDiameterOptions = Object.freeze([
  Object.freeze({ value:16, label:"до Ø16 мм" }),
  Object.freeze({ value:35, label:"до Ø35 мм" }),
  Object.freeze({ value:50, label:"до Ø50 мм" }),
  Object.freeze({ value:63, label:"до Ø63 мм" }),
]);

export function resolveReverseFacetValue(required, availableValues = []) {
  if (!required) return "";
  return availableValues.includes("Да") ? "Да" : "";
}

export function buildDrillSelectionUrl({ pathname, search = "", diameterFacetKey, reverseFacetKey, diameter, reverse = "", work = "unknown" }) {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  params.delete("page");
  params.delete("q");
  params.delete(`min_${diameterFacetKey}`);
  if (reverseFacetKey) params.delete(`f_${reverseFacetKey}`);
  if (diameter > 0) params.set(`min_${diameterFacetKey}`, String(diameter));
  if (reverseFacetKey && reverse) params.set(`f_${reverseFacetKey}`, reverse);
  if (work === "installation") params.set("q", "магнитн");
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}#products`;
}
