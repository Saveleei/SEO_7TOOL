const CYRILLIC = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function slug(value) {
  return [...String(value ?? "").normalize("NFKC").toLocaleLowerCase("ru")]
    .map((character) => CYRILLIC[character] ?? character)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/g, "") || "image";
}

function escapeXml(value) {
  return String(value).replace(/[<>&'\"]/g, (character) => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;",
  })[character]);
}

export function descriptiveImageFilename(description, width, format) {
  const safeWidth = Number(width);
  const safeFormat = String(format ?? "").toLocaleLowerCase("en");
  if (!Number.isInteger(safeWidth) || safeWidth < 1 || !new Set(["webp", "avif"]).has(safeFormat)) {
    throw new Error("Image filename requires a positive width and WebP/AVIF format");
  }
  return `${safeWidth}-${slug(description)}.${safeFormat}`;
}

export function buildImageSitemap(entries) {
  const urls = (Array.isArray(entries) ? entries : []).map((entry) => {
    const page = new URL(entry.loc);
    if (page.protocol !== "https:" || page.hostname !== "7tool.ru") throw new Error("Image sitemap pages must belong to https://7tool.ru");
    const images = [...new Set((Array.isArray(entry.images) ? entry.images : []).map((value) => {
      const image = new URL(value);
      if (image.protocol !== "https:" || image.hostname !== "7tool.ru") throw new Error("Image sitemap assets must belong to https://7tool.ru");
      return image.toString();
    }))];
    if (!images.length) return "";
    return `<url><loc>${escapeXml(page.toString())}</loc>${images.map((image) => `<image:image><image:loc>${escapeXml(image)}</image:loc></image:image>`).join("")}</url>`;
  }).filter(Boolean);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${urls.join("")}</urlset>\n`;
}

export function auditImageSeo(input) {
  const issues = [];
  if (!String(input.alt ?? "").trim()) issues.push("MISSING_ALT");
  if (!Number.isInteger(input.width) || !Number.isInteger(input.height) || input.width < 1 || input.height < 1) issues.push("MISSING_DIMENSIONS");
  if (!new Set(["image/webp", "image/avif"]).has(input.mime)) issues.push("NON_MODERN_FORMAT");
  if (!input.hasSurroundingText) issues.push("MISSING_SURROUNDING_TEXT");
  if (input.priority && input.loading === "lazy") issues.push("LCP_IMAGE_LAZY_LOADED");
  return { status: issues.length ? "NEEDS_ATTENTION" : "PASS", issues };
}
