export const drillWorkOptions = Object.freeze([
  Object.freeze({ id:"installation", label:"Монтаж на конструкции", hint:"Нужен переносной станок для работы непосредственно на детали" }),
  Object.freeze({ id:"workshop", label:"Стационарная работа в цехе", hint:"Станок устанавливается на рабочем месте или участке" }),
  Object.freeze({ id:"unknown", label:"Пока не знаю", hint:"Покажем оборудование без ограничения по типу установки" }),
]);

export function buildDrillDiameterOptions(availableOptions = [], limit = 6, selectedValue = 0) {
  if (limit <= 0) return [];
  const unique = new Map();
  for (const option of availableOptions) {
    const value = Number.parseFloat(String(option.value ?? option.label ?? "").replace(",", ".").match(/\d+(?:\.\d+)?/)?.[0] ?? "");
    if (!Number.isFinite(value) || value <= 0 || unique.has(value)) continue;
    unique.set(value, Object.freeze({ value, label:`до Ø${option.label ?? option.value}` }));
  }
  const ordered = Array.from(unique.values()).sort((first, second) => first.value - second.value);
  if (ordered.length <= limit) return ordered;
  if (limit === 1) return ordered.slice(0, 1);
  const sampled = Array.from({ length:limit }, (_, index) => ordered[Math.round(index * (ordered.length - 1) / (limit - 1))]);
  const selected = ordered.find((option) => option.value === selectedValue);
  if (selected && !sampled.some((option) => option.value === selected.value)) sampled.push(selected);
  return Array.from(new Map(sampled.map((option) => [option.value, option])).values()).sort((first, second) => first.value - second.value);
}

export function resolveReverseFacetValue(required, availableValues = []) {
  if (!required) return "";
  return availableValues.includes("Да") ? "Да" : "";
}

export function buildDrillSelectionUrl({ pathname, search = "", diameterFacetKey, reverseFacetKey, diameter, reverse = "", work = "unknown" }) {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  params.delete("page");
  params.delete("q");
  params.delete("segment");
  params.delete("drill_type");
  params.delete(`min_${diameterFacetKey}`);
  if (reverseFacetKey) params.delete(`f_${reverseFacetKey}`);
  if (diameter > 0) params.set(`min_${diameterFacetKey}`, String(diameter));
  if (reverseFacetKey && reverse) params.set(`f_${reverseFacetKey}`, reverse);
  if (work === "installation") params.set("segment", "drill-magnetic");
  if (work === "workshop") params.set("segment", "drill-stationary");
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}#products`;
}
