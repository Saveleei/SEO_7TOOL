import type { Metadata } from "next";

/**
 * RootLayout already appends «— 7TOOL». Manual SEO fields may contain the
 * brand themselves, so they must be treated as absolute titles to avoid
 * «7TOOL — 7TOOL» in the rendered <title>.
 */
export function pageTitle(value: string): NonNullable<Metadata["title"]> {
  return /\b7tool\b/i.test(value) ? { absolute: value } : value;
}

export const indexableRobots: Metadata["robots"] = {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    "max-image-preview": "large",
    "max-snippet": -1,
    "max-video-preview": -1,
  },
};

export const noIndexRobots: Metadata["robots"] = {
  index: false,
  follow: true,
  googleBot: { index: false, follow: true },
};

