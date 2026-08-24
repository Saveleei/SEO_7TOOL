"use client";

import { useState } from "react";
import { DEFAULT_CATEGORY_VISUAL } from "@/lib/category-visuals";

export function CategoryCoverImage({
  src,
  alt,
}: {
  src?: string;
  alt: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const resolvedSrc = !src || failedSrc === src ? DEFAULT_CATEGORY_VISUAL : src;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolvedSrc}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => resolvedSrc !== DEFAULT_CATEGORY_VISUAL && setFailedSrc(src ?? "")}
      className="absolute inset-0 h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.045]"
    />
  );
}
