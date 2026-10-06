import type { Metadata } from "next";
import { isSeoIndexingEnabled, SEO_SITE_ORIGIN } from "./seoIndexing.mjs";
import { normalizeSeoKeywords } from "./seoKeywords.ts";

type SearchParams = Record<string, string | string[] | undefined>;

export type SeoSocialImage = {
  url: string;
  width?: number;
  height?: number;
  type?: string;
  alt?: string;
};

export const DEFAULT_SOCIAL_IMAGE: Required<SeoSocialImage> = {
  url:"/social/7tool-share-warehouse-v1.png",
  width:1200,
  height:630,
  type:"image/png",
  alt:"7TOOL — промышленный инструмент и оборудование со склада в России",
};

export function canonicalUrl(pathname: string): string {
  const cleanPath = `/${String(pathname || "/").split(/[?#]/u)[0].replace(/^\/+|\/+$/gu, "")}`;
  return new URL(cleanPath === "/" ? "/" : cleanPath, SEO_SITE_ORIGIN).toString();
}

export function publicRobots(indexable = true): Metadata["robots"] {
  if (!isSeoIndexingEnabled()) return { index:false, follow:false, nocache:true };
  if (!indexable) return { index:false, follow:true, nocache:true };
  return {
    index:true,
    follow:true,
    googleBot:{ index:true, follow:true, "max-image-preview":"large", "max-snippet":-1, "max-video-preview":-1 },
  };
}

export function createPublicMetadata({
  title,
  description,
  path,
  indexable = true,
  image,
  keywords = [],
}: {
  title: string;
  description: string;
  path: string;
  indexable?: boolean;
  image?: string | SeoSocialImage;
  keywords?: readonly string[];
}): Metadata {
  const canonical = canonicalUrl(path);
  const socialImage = absoluteSocialImage(image ?? DEFAULT_SOCIAL_IMAGE, title);
  const normalizedKeywords = indexable && isSeoIndexingEnabled() ? normalizeSeoKeywords(keywords) : [];
  return {
    title,
    description,
    ...(normalizedKeywords.length > 0 ? { keywords:normalizedKeywords } : {}),
    alternates:{ canonical },
    robots:publicRobots(indexable),
    openGraph:{ title, description, url:canonical, siteName:"7TOOL", locale:"ru_RU", type:"website", images:[socialImage] },
    twitter:{ card:"summary_large_image", title, description, images:[{ url:socialImage.url, alt:socialImage.alt }] },
  };
}

function absoluteSocialImage(image: string | SeoSocialImage, fallbackAlt: string): SeoSocialImage & { url: string; alt: string } {
  const entry = typeof image === "string" ? { url:image } : image;
  return {
    ...entry,
    url:new URL(entry.url, SEO_SITE_ORIGIN).toString(),
    alt:entry.alt?.trim() || fallbackAlt,
  };
}

export function hasSearchParameters(searchParams: SearchParams): boolean {
  return Object.values(searchParams).some((value) => Array.isArray(value) ? value.some((item) => item.trim().length > 0) : typeof value === "string" && value.trim().length > 0);
}

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</gu, "\\u003c");
}
