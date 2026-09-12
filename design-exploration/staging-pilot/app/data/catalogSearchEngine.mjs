export function normalizeCatalogQuery(value = "") {
  return String(value)
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/g, "е")
    .replace(/(\d)[×х*](?=\d)/g, "$1x")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getCatalogQueryTokens(value = "") {
  return normalizeCatalogQuery(value).split(" ").filter((token) => token.length > 1);
}

export function rankCatalogItems(items, query, limit = 6) {
  const normalizedQuery = normalizeCatalogQuery(query);
  const queryTokens = getCatalogQueryTokens(query);
  if (normalizedQuery.length < 2 || queryTokens.length === 0) return [];

  return items
    .map((item, sourceOrder) => ({ item, sourceOrder, score: scoreCatalogItem(item, normalizedQuery, queryTokens) }))
    .filter(({ score }) => score > 0)
    .sort((first, second) => second.score - first.score || first.sourceOrder - second.sourceOrder)
    .slice(0, Math.max(1, limit))
    .map(({ item }) => item);
}

function scoreCatalogItem(item, normalizedQuery, queryTokens) {
  const title = item.normalizedTitle || normalizeCatalogQuery(item.title);
  const searchText = item.normalizedSearchText || normalizeCatalogQuery(item.searchText || item.title);
  const identifiers = item.normalizedIdentifiers || (item.identifiers || []).map(normalizeCatalogQuery);
  const searchTokens = searchText.split(" ");
  let score = 0;

  if (identifiers.includes(normalizedQuery)) score += 1200;
  if (title === normalizedQuery) score += 900;
  if (title.startsWith(normalizedQuery)) score += 420;
  else if (title.includes(normalizedQuery)) score += 300;
  if (searchText.includes(normalizedQuery)) score += 220;

  let matchedTokens = 0;
  for (const queryToken of queryTokens) {
    const stem = queryToken.slice(0, Math.min(queryToken.length, 5));
    const titleMatch = title.split(" ").some((token) => token.startsWith(stem));
    const searchMatch = searchTokens.some((token) => token.startsWith(stem));
    if (titleMatch || searchMatch) {
      matchedTokens += 1;
      score += titleMatch ? 75 : 35;
    }
  }

  const requiredMatches = queryTokens.length <= 2 ? queryTokens.length : Math.ceil(queryTokens.length * 0.6);
  if (matchedTokens < requiredMatches && score < 500) return 0;
  if (matchedTokens === queryTokens.length) score += 180;
  if (item.available) score += 8;
  return score;
}
