"use client";

import { useState } from "react";
import type { Product } from "@/lib/catalog";
import { CategoryArt } from "./CategoryArt";

export function ProductImage({
  p,
  index = 0,
  className = "",
  sizes,
  alt,
}: {
  p: { icon: Product["icon"]; images?: Product["images"]; title: Product["title"] };
  index?: number;
  className?: string;
  sizes?: string;
  alt?: string;
}) {
  const src = p.images?.[index];
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) {
    return <CategoryArt icon={p.icon} className={className} />;
  }
  return (
    <div className={`relative overflow-hidden bg-white ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt || p.title}
        loading="lazy"
        decoding="async"
        sizes={sizes}
        onError={() => setFailedSrc(src)}
        className="absolute inset-0 h-full w-full object-contain p-3"
      />
    </div>
  );
}
