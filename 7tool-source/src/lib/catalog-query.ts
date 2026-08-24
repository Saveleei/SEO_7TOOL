export type CatalogQuery = Record<string, string | string[] | undefined>;

const TRACKING_PARAMS = new Set([
  "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
  "yclid", "gclid", "fbclid", "_openstat", "roistat",
]);

export function catalogPageNumber(query: CatalogQuery): number | undefined {
  const raw = Array.isArray(query.page) ? query.page[0] : query.page;
  if (!raw) return 1;
  if (!/^\d+$/.test(raw)) return undefined;
  const page = Number(raw);
  return Number.isSafeInteger(page) && page >= 1 ? page : undefined;
}

export function catalogFilterValues(query: CatalogQuery): Record<string, string[]> {
  const values: Record<string, string[]> = {};
  for (const [name, raw] of Object.entries(query)) {
    if (name === "page" || TRACKING_PARAMS.has(name.toLocaleLowerCase("ru"))) continue;
    const list = (Array.isArray(raw) ? raw : [raw]).filter((value): value is string => Boolean(value?.trim()));
    if (list.length) values[name] = list;
  }
  return values;
}

export function hasCatalogFilters(query: CatalogQuery): boolean {
  return Object.keys(catalogFilterValues(query)).length > 0;
}

export function catalogPageHref(basePath: string, page: number): string {
  return page > 1 ? `${basePath}?page=${page}` : basePath;
}
