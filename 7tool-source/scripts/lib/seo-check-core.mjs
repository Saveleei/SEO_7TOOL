function decodeXml(value) {
  return String(value)
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

function normalizePathname(pathname) {
  const normalized = String(pathname || "/").replace(/\/{2,}/g, "/");
  return normalized === "/" ? "/" : normalized.replace(/\/+$/, "");
}

function parseHttpUrl(value, label) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be an absolute HTTP(S) URL`);
  }
  if (!new Set(["http:", "https:"]).has(url.protocol)) throw new Error(`${label} must use HTTP(S)`);
  if (url.username || url.password) throw new Error(`${label} must not contain credentials`);
  return url;
}

export function resolveSeoCheckBase(argv = [], env = {}) {
  const args = Array.isArray(argv) ? argv : [];
  const inline = args.find((value) => value.startsWith("--url="))?.slice(6);
  const flagIndex = args.indexOf("--url");
  const separate = flagIndex >= 0 ? args[flagIndex + 1] : null;
  const positional = args.find((value) => /^https?:\/\//i.test(value));
  const raw = inline || separate || positional || env.SEO_CHECK_BASE_URL || "";
  if (!raw) return "";

  const url = parseHttpUrl(raw, "SEO check base URL");
  if (url.search || url.hash) throw new Error("SEO check base URL must not contain query parameters or a fragment");
  if (normalizePathname(url.pathname) !== "/") throw new Error("SEO check base URL must point to the site root");
  return url.origin;
}

export function canonicalMatches(canonical, route, base) {
  if (!canonical) return false;
  try {
    const actual = new URL(canonical, base);
    const expected = new URL(route, base);
    return actual.origin === expected.origin
      && normalizePathname(actual.pathname) === normalizePathname(expected.pathname)
      && actual.search === expected.search;
  } catch {
    return false;
  }
}

export function extractDeclaredSitemaps(robotsText) {
  return String(robotsText ?? "")
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*Sitemap\s*:\s*(\S+)\s*$/i)?.[1])
    .filter(Boolean);
}

export function inspectSitemapXml(xml, base) {
  const findings = [];
  const origin = new URL(base).origin;
  if (!/<urlset\b/i.test(xml) || !/xmlns=["']http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9["']/i.test(xml)) {
    findings.push({ code: "SITEMAP_XML_INVALID", detail: "Missing sitemap urlset namespace" });
  }

  const rawLocs = Array.from(String(xml).matchAll(/<loc>(.*?)<\/loc>/gis), (match) => decodeXml(match[1].trim()));
  if (rawLocs.length > 50_000) findings.push({ code: "SITEMAP_TOO_LARGE", detail: String(rawLocs.length) });
  const seen = new Set();
  const urls = [];

  for (const raw of rawLocs) {
    let url;
    try {
      url = parseHttpUrl(raw, "Sitemap URL");
    } catch (error) {
      findings.push({ code: "SITEMAP_INVALID_URL", detail: `${raw}: ${error.message}` });
      continue;
    }
    if (url.origin !== origin) findings.push({ code: "SITEMAP_FOREIGN_ORIGIN", detail: raw });
    if (url.search || url.hash) findings.push({ code: "SITEMAP_PARAMETER_URL", detail: raw });
    if (/\s/.test(raw)) findings.push({ code: "SITEMAP_RAW_SPACE", detail: raw });
    const normalized = url.toString();
    if (seen.has(normalized)) findings.push({ code: "SITEMAP_DUPLICATE", detail: raw });
    else seen.add(normalized);
    urls.push(normalized);
  }
  return { urls, findings };
}

export function inspectImageSitemapXml(xml, base, pageUrls = []) {
  const findings = [];
  const origin = new URL(base).origin;
  const pages = new Set(pageUrls.map((value) => new URL(value, base).toString()));
  const text = String(xml ?? "");
  if (!/<urlset\b/i.test(text)
    || !/xmlns=["']http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9["']/i.test(text)
    || !/xmlns:image=["']http:\/\/www\.google\.com\/schemas\/sitemap-image\/1\.1["']/i.test(text)) {
    findings.push({ code: "IMAGE_SITEMAP_XML_INVALID", detail: "Missing sitemap or image sitemap namespace" });
  }

  const blocks = Array.from(text.matchAll(/<url>([\s\S]*?)<\/url>/gi), (match) => match[1]);
  if (blocks.length > 50_000) findings.push({ code: "IMAGE_SITEMAP_TOO_LARGE", detail: String(blocks.length) });
  const seenPairs = new Set();

  for (const block of blocks) {
    const pageRaw = block.match(/<loc>(.*?)<\/loc>/is)?.[1];
    if (!pageRaw) {
      findings.push({ code: "IMAGE_SITEMAP_PAGE_MISSING", detail: "Image sitemap url block has no page loc" });
      continue;
    }
    let page;
    try {
      page = parseHttpUrl(decodeXml(pageRaw.trim()), "Image sitemap page URL");
    } catch (error) {
      findings.push({ code: "IMAGE_SITEMAP_PAGE_INVALID", detail: error.message });
      continue;
    }
    if (page.origin !== origin) findings.push({ code: "IMAGE_SITEMAP_PAGE_FOREIGN", detail: page.toString() });
    if (!pages.has(page.toString())) findings.push({ code: "IMAGE_SITEMAP_PAGE_NOT_IN_SITEMAP", detail: page.toString() });

    const images = Array.from(block.matchAll(/<image:loc>(.*?)<\/image:loc>/gis), (match) => decodeXml(match[1].trim()));
    if (!images.length) findings.push({ code: "IMAGE_SITEMAP_EMPTY_PAGE", detail: page.toString() });
    if (images.length > 1_000) findings.push({ code: "IMAGE_SITEMAP_PAGE_TOO_LARGE", detail: `${page}: ${images.length}` });
    for (const raw of images) {
      let image;
      try {
        image = parseHttpUrl(raw, "Image sitemap asset URL");
      } catch (error) {
        findings.push({ code: "IMAGE_SITEMAP_ASSET_INVALID", detail: `${raw}: ${error.message}` });
        continue;
      }
      if (image.origin !== origin) findings.push({ code: "IMAGE_SITEMAP_ASSET_FOREIGN", detail: raw });
      if (!image.pathname.startsWith("/media/")) findings.push({ code: "IMAGE_SITEMAP_ASSET_NOT_LOCAL_MEDIA", detail: raw });
      const pair = `${page.toString()}\n${image.toString()}`;
      if (seenPairs.has(pair)) findings.push({ code: "IMAGE_SITEMAP_DUPLICATE", detail: raw });
      else seenPairs.add(pair);
    }
  }
  return { pages: blocks.length, images: seenPairs.size, findings };
}
