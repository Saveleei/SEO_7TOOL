"use client";

import { useState } from "react";
import Image from "next/image";
import type { Product } from "@/lib/catalog";
import { CategoryArt } from "./CategoryArt";

export function ProductImage({
  p,
  index = 0,
  className = "",
  sizes,
  alt,
  priority = false,
}: {
  p: { icon: Product["icon"]; images?: Product["images"]; title: Product["title"] };
  index?: number;
  className?: string;
  sizes?: string;
  alt?: string;
  priority?: boolean;
}) {
  const src = p.images?.[index];
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) {
    return <CategoryArt icon={p.icon} className={className} />;
  }
  return (
    <div className={`relative overflow-hidden bg-white ${className}`}>
      <Image
        src={src}
        alt={alt || p.title}
        fill
        priority={priority}
        loading={priority ? undefined : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        sizes={sizes || "100vw"}
        onError={() => setFailedSrc(src)}
        className="absolute inset-0 h-full w-full object-contain p-3"
      />
    </div>
  );
}
