"use client";

import Image from "next/image";
import { useState } from "react";

export function HomepageCategoryMedia({ src, alt }: { src?: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <CategoryMediaFallback />;

  return <Image
    src={src}
    alt={alt}
    fill
    sizes="(max-width: 760px) 42vw, (max-width: 1050px) 34vw, 420px"
    unoptimized
    onError={() => setFailed(true)}
  />;
}

function CategoryMediaFallback() {
  return <span className="homepage-category-tile-placeholder" aria-hidden="true">
    <b>7TOOL</b>
    <small>раздел каталога</small>
  </span>;
}
