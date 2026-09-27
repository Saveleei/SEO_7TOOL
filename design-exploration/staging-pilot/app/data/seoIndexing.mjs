export const SEO_SITE_ORIGIN = "https://7tool.ru";
export const SEO_PRODUCTION_HOSTS = Object.freeze(["7tool.ru", "www.7tool.ru"]);
export const SEO_NOINDEX_HEADER = "noindex, nofollow, noarchive";

export function isSeoIndexingEnabled(env = runtimeEnv()) {
  return env.SEO_INDEXING_ENABLED === "1";
}

export function normalizeSeoHost(value) {
  const candidate = String(value ?? "").split(",")[0].trim().toLocaleLowerCase("en-US");
  if (!candidate) return "";
  try {
    return new URL(`http://${candidate}`).hostname.replace(/\.$/u, "");
  } catch {
    return "";
  }
}

export function isProductionSeoHost(value) {
  return SEO_PRODUCTION_HOSTS.includes(normalizeSeoHost(value));
}

export function shouldSendNoIndexHeader(host, env = runtimeEnv()) {
  return !isSeoIndexingEnabled(env) || !isProductionSeoHost(host);
}

function runtimeEnv() {
  return typeof process !== "undefined" && process.env ? process.env : {};
}
