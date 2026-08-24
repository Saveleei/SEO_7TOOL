"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { EcommerceProduct } from "@/lib/analytics";
import { trackEcommerce } from "@/lib/analytics";

export function TrackedProductLink({
  href,
  item,
  className,
  ariaLabel,
  children,
}: {
  href: string;
  item: EcommerceProduct;
  className?: string;
  ariaLabel?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={className} aria-label={ariaLabel} onClick={() => trackEcommerce("click", [item])}>
      {children}
    </Link>
  );
}
