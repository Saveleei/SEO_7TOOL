export function buildCategorySelectionUrl({ pathname, search = "", selections = [] }) {
  const params = new URLSearchParams(search);
  params.delete("page");
  for (const selection of selections) {
    const key = `f_${selection.key}`;
    params.delete(key);
    if (selection.value) params.append(key, selection.value);
  }
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}#products`;
}

export function buildCategorySelectionContext(categoryTitle, selections) {
  const selected = selections.filter((selection) => selection.value);
  const details = selected.length > 0
    ? selected.map((selection) => `${selection.label}: ${selection.value}`).join("; ")
    : "структурированные параметры в фиде отсутствуют или пока не выбраны";
  return `Категория: ${categoryTitle}. Известные параметры: ${details}. Нужна проверка совместимости и подходящего исполнения.`;
}
