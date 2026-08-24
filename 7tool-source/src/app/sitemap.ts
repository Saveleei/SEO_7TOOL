import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-config";
import { publishedSubcategories } from "@/lib/subcategories";
import { listPublicCategories } from "@/lib/categories-db";
import { listPublicBrands, listPublicProductSlugs } from "@/lib/products-db";
import { brandSlug } from "@/lib/brand";
import { statSync } from "node:fs";
import { join } from "node:path";

function catalogLastModified(): Date {
  try {
    return statSync(join(process.cwd(), "src", "lib", "products.json")).mtime;
  } catch {
    return new Date("2026-01-01T00:00:00.000Z");
  }
}

function sourceLastModified(source: string): Date {
  try {
    return statSync(join(process.cwd(), source)).mtime;
  } catch {
    return new Date("2026-01-01T00:00:00.000Z");
  }
}

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = catalogLastModified();
  const categories = listPublicCategories();
  const publicCategorySlugs = new Set(categories.map((category) => category.slug));
  const staticModified = sourceLastModified("src/app/page.tsx");

  const staticUrls: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: staticModified, changeFrequency: "daily", priority: 1.0 },
    { url: `${SITE_URL}/kontakty`, lastModified: sourceLastModified("src/app/kontakty/page.tsx"), changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/dostavka-i-oplata`, lastModified: sourceLastModified("src/app/dostavka-i-oplata/page.tsx"), changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/garantiya-i-vozvrat`, lastModified: sourceLastModified("src/app/garantiya-i-vozvrat/page.tsx"), changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/politika-konfidencialnosti`, lastModified: sourceLastModified("src/app/politika-konfidencialnosti/page.tsx"), changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/soglasie-na-obrabotku`, lastModified: sourceLastModified("src/app/soglasie-na-obrabotku/page.tsx"), changeFrequency: "yearly", priority: 0.2 },
  ];

  const categoryUrls: MetadataRoute.Sitemap = categories.map((c) => ({
    url: `${SITE_URL}/c/${c.slug}`,
    lastModified,
    changeFrequency: "weekly",
    priority: 0.85,
  }));

  const subcategoryUrls: MetadataRoute.Sitemap = publishedSubcategories()
    .filter((subcategory) => publicCategorySlugs.has(subcategory.categorySlug))
    .map((subcategory) => ({
    url: `${SITE_URL}/c/${subcategory.categorySlug}/${subcategory.slug}`,
    lastModified,
    changeFrequency: "weekly",
    priority: 0.75,
  }));

  // Campaign/selection landing pages stay reachable but are noindex until an
  // editorial review proves independent demand and non-overlapping intent.
  const brandUrls: MetadataRoute.Sitemap = listPublicBrands().map((brand) => ({
    url: `${SITE_URL}/brand/${brandSlug(brand)}`,
    lastModified,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const productUrls: MetadataRoute.Sitemap = listPublicProductSlugs().map((slug) => ({
    url: `${SITE_URL}/p/${slug}`,
    lastModified,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticUrls, ...categoryUrls, ...subcategoryUrls, ...brandUrls, ...productUrls];
}
