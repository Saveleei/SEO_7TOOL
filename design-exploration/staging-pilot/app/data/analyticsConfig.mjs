const METRIKA_ID = /^[1-9]\d{4,11}$/u;

export function resolveYandexMetrikaId(env = process.env) {
  if (String(env.SEO_INDEXING_ENABLED || "") !== "1") return null;
  if (String(env.QUOTE_TEST_MODE || "") === "1") return null;
  const value = String(env.YANDEX_METRIKA_ID || "").trim();
  return METRIKA_ID.test(value) ? Number(value) : null;
}
