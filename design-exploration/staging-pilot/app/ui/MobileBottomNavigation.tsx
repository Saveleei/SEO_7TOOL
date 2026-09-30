"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HeaderContactMenu } from "./HeaderContactMenu";
import { RequestCartButton } from "./RequestCart";

export function MobileBottomNavigation() {
  const pathname = usePathname();
  const openCatalog = () => window.dispatchEvent(new Event("7tool:open-catalog-menu"));

  return <nav className="mobile-action-bar" aria-label="Основная мобильная навигация">
    <Link href="/" aria-current={pathname === "/" ? "page" : undefined}><HomeIcon /><span>Главная</span></Link>
    <button type="button" aria-current={pathname.startsWith("/catalog") ? "page" : undefined} onClick={openCatalog}><CatalogIcon /><span>Каталог</span></button>
    <RequestCartButton compact />
    <HeaderContactMenu compact placement="mobile_bottom_navigation" />
  </nav>;
}

function HomeIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 10.7 12 3.8l8.5 6.9v8.8h-5.3v-5.8H8.8v5.8H3.5z" /></svg>;
}

function CatalogIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h6v6H4zm10 0h6v6h-6zM4 14h6v6H4zm10 0h6v6h-6z" /></svg>;
}
