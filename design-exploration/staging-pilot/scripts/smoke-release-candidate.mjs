import process from "node:process";
import { pathToFileURL } from "node:url";
import feedSnapshot from "../../../7tool-source/src/lib/products.json" with { type:"json" };

const CORE_PUBLIC_ROUTES = [
  "/",
  "/catalog",
  "/company",
  "/contacts",
  "/ordering",
  "/payment",
  "/delivery",
  "/warranty",
  "/product/magnitnyy-sverlilnyy-stanok-lenz-steyr-35",
  "/search?q=STEYR-35",
  "/compare",
];

const TASK_RELEASE_ROUTES = ["drilling", "edge", "cutting", "welding", "tooling", "workplace"]
  .map((task) => `/catalog/task/${task}`);
const CATEGORY_RELEASE_ROUTES = feedSnapshot.categories
  .filter((category) => category.published)
  .map((category) => `/catalog/category/${category.slug}`);
const EDGE_PRODUCT_ROUTES = [
  feedSnapshot.products.find((product) => !(product.images ?? []).some(Boolean)),
  feedSnapshot.products.find((product) => product.variants.some((variant) => !String(variant.sku ?? "").trim())),
]
  .filter(Boolean)
  .map((product) => `/product/${product.slug}`);

export const PUBLIC_RELEASE_ROUTES = Array.from(new Set([
  ...CORE_PUBLIC_ROUTES,
  ...TASK_RELEASE_ROUTES,
  ...CATEGORY_RELEASE_ROUTES,
  ...EDGE_PRODUCT_ROUTES,
]));

export const PROTECTED_RELEASE_ROUTES = [
  "/test/requests",
  "/test/catalog-quality",
  "/test/delivery",
  "/test/settings/shipping",
  "/test/settings/quote",
  "/test/settings/homepage",
  "/test/settings/trust",
];

export function assertLoopbackBaseUrl(value) {
  const url = new URL(value);
  const hostname = url.hostname.toLowerCase().replace(/^\[/u, "").replace(/\]$/u, "");
  if (!['http:', 'https:'].includes(url.protocol) || !["127.0.0.1", "localhost", "::1"].includes(hostname)) {
    throw new Error("Release smoke is restricted to a loopback origin.");
  }
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("SMOKE_BASE_URL must contain only a loopback origin.");
  }
  return url;
}

export async function runReleaseSmoke(options = {}) {
  const baseUrl = assertLoopbackBaseUrl(options.baseUrl || process.env.SMOKE_BASE_URL || "http://127.0.0.1:3180");
  const fetchImpl = options.fetchImpl || fetch;
  const managerUsername = String(options.managerUsername || process.env.SMOKE_MANAGER_USERNAME || "");
  const managerPassword = String(options.managerPassword || process.env.SMOKE_MANAGER_PASSWORD || "");
  if (!managerUsername || !managerPassword) throw new Error("SMOKE_MANAGER_USERNAME and SMOKE_MANAGER_PASSWORD are required.");
  const results = [];

  for (const route of PUBLIC_RELEASE_ROUTES) {
    const response = await request(fetchImpl, baseUrl, route);
    requireStatus(response, 200, route);
    results.push({ route, status:response.status, access:"public" });
  }

  for (const route of PROTECTED_RELEASE_ROUTES) {
    const response = await request(fetchImpl, baseUrl, route, { redirect:"manual" });
    if (![302, 303, 307, 308].includes(response.status) || !sameOriginAccessLocation(response.headers.get("location"), baseUrl)) {
      throw new Error(`${route} must redirect an anonymous visitor to the local staff access page.`);
    }
    results.push({ route, status:response.status, access:"anonymous-redirect" });
  }

  const login = await request(fetchImpl, baseUrl, "/api/manager-auth/session", {
    method:"POST",
    headers:{ Origin:baseUrl.origin, "content-type":"application/json" },
    body:JSON.stringify({ username:managerUsername, password:managerPassword }),
    redirect:"manual",
  });
  requireStatus(login, 200, "/api/manager-auth/session");
  const cookie = sessionCookie(login.headers);
  if (!cookie.startsWith("7tool_manager_session=")) throw new Error("Local administrator session cookie was not issued.");
  results.push({ route:"/api/manager-auth/session", status:login.status, access:"local-admin-sign-in" });

  for (const route of PROTECTED_RELEASE_ROUTES) {
    const response = await request(fetchImpl, baseUrl, route, { headers:{ Cookie:cookie } });
    requireStatus(response, 200, route);
    results.push({ route, status:response.status, access:"local-admin" });
  }

  return { origin:baseUrl.origin, checks:results.length, results };
}

function request(fetchImpl, baseUrl, route, init = {}) {
  const target = new URL(route, baseUrl);
  if (target.origin !== baseUrl.origin) throw new Error("Smoke route escaped the loopback origin.");
  return fetchImpl(target, { signal:AbortSignal.timeout(15_000), ...init });
}

function requireStatus(response, expected, route) {
  if (response.status !== expected) throw new Error(`${route} returned ${response.status}; expected ${expected}.`);
}

function sameOriginAccessLocation(value, baseUrl) {
  if (!value) return false;
  try {
    const target = new URL(value, baseUrl);
    return target.origin === baseUrl.origin && target.pathname === "/test/access";
  } catch {
    return false;
  }
}

function sessionCookie(headers) {
  const values = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [headers.get("set-cookie") || ""];
  return values.find((value) => value.startsWith("7tool_manager_session="))?.split(";", 1)[0] || "";
}

const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (entry === import.meta.url) {
  runReleaseSmoke().then((result) => {
    console.log(`Release candidate smoke passed: ${result.checks} checks on ${result.origin}`);
    for (const item of result.results) console.log(`${item.status}  ${item.access.padEnd(18)} ${item.route}`);
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : "Release candidate smoke failed.");
    process.exitCode = 1;
  });
}
