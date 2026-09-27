import type { Metadata } from "next";
import { isSeoIndexingEnabled, SEO_SITE_ORIGIN } from "./seoIndexing.mjs";

type SearchParams = Record<string, string | string[] | undefined>;

export function canonicalUrl(pathname: string): string {
  const cleanPath = `/${String(pathname || "/").split(/[?#]/u)[0].replace(/^\/+|\/+$/gu, "")}`;
  return new URL(cleanPath === "/" ? "/" : cleanPath, SEO_SITE_ORIGIN).toString();
}

export function publicRobots(indexable = true): Metadata["robots"] {
  if (!indexable || !isSeoIndexingEnabled()) return { index:false, follow:false, nocache:true };
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
}: {
  title: string;
  description: string;
  path: string;
  indexable?: boolean;
  image?: string;
}): Metadata {
  const canonical = canonicalUrl(path);
  const socialImage = image ? new URL(image, SEO_SITE_ORIGIN).toString() : canonicalUrl("/og.png");
  return {
    title,
    description,
    alternates:{ canonical },
    robots:publicRobots(indexable),
    openGraph:{ title, description, url:canonical, siteName:"7TOOL", locale:"ru_RU", type:"website", images:[{ url:socialImage, alt:title }] },
    twitter:{ card:"summary_large_image", title, description, images:[socialImage] },
  };
}

export function hasSearchParameters(searchParams: SearchParams): boolean {
  return Object.values(searchParams).some((value) => Array.isArray(value) ? value.some((item) => item.trim().length > 0) : typeof value === "string" && value.trim().length > 0);
}

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</gu, "\\u003c");
}
