export const burrTaskOptions = Object.freeze([
  Object.freeze({ id:"flat", label:"Плоскость или прямая кромка", hint:"Ровный участок, торец или снятие материала по прямой" }),
  Object.freeze({ id:"radius", label:"Радиус или скругление", hint:"Вогнутая поверхность, контур или плавный переход" }),
  Object.freeze({ id:"access", label:"Узкая или глубокая зона", hint:"Паз, трудный доступ или локальная обработка" }),
  Object.freeze({ id:"chamfer", label:"Фаска, угол или V-паз", hint:"Конический профиль и обработка под углом" }),
  Object.freeze({ id:"unknown", label:"Не знаю — покажу деталь", hint:"Инженер проверит фото, эскиз или описание задачи" }),
]);

const taskRecommendations = Object.freeze({
  flat: Object.freeze({ forms:["A", "B"], title:"Цилиндрические формы A и B", reason:"Предварительный выбор для плоских поверхностей и прямых кромок." }),
  radius: Object.freeze({ forms:["C", "D", "E"], title:"Радиусные формы C, D и E", reason:"Предварительный выбор для скруглений, вогнутых участков и плавных контуров." }),
  access: Object.freeze({ forms:["F", "G", "H"], title:"Вытянутые формы F, G и H", reason:"Предварительный выбор для пазов и зон с ограниченным доступом." }),
  chamfer: Object.freeze({ forms:["L", "M", "N"], title:"Конические формы L, M и N", reason:"Предварительный выбор для фасок, углов и V-образных участков." }),
  unknown: Object.freeze({ forms:[], title:"Нужна проверка по детали", reason:"Покажем все формы и подготовим задачу для инженера — артикул знать не требуется." }),
});

export function getBurrTaskRecommendation(taskId, availableForms = []) {
  const recommendation = taskRecommendations[taskId] ?? taskRecommendations.unknown;
  const allowed = new Set(availableForms);
  return {
    ...recommendation,
    forms: recommendation.forms.filter((form) => allowed.has(form)),
  };
}

export function resolveMaterialFacetValue(selection, availableValues = []) {
  const aliases = {
    "Сталь":"Сталь",
    "Нержавеющая сталь":"Нержавеющие стали",
    "Чугун":"Чугун",
    "Алюминий / цветные металлы":"Цветные металлы",
  };
  const expected = aliases[selection];
  return expected && availableValues.includes(expected) ? expected : "";
}

export function buildBurrSelectionUrl({ pathname, search = "", shapeFacetKey, shankFacetKey, materialFacetKey, forms = [], shank = "", material = "" }) {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  params.delete("page");
  params.delete(`f_${shapeFacetKey}`);
  if (shankFacetKey) params.delete(`f_${shankFacetKey}`);
  if (materialFacetKey) params.delete(`f_${materialFacetKey}`);
  for (const form of forms) params.append(`f_${shapeFacetKey}`, form);
  if (shankFacetKey && shank) params.append(`f_${shankFacetKey}`, shank);
  if (materialFacetKey && material) params.append(`f_${materialFacetKey}`, material);
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}#products`;
}
