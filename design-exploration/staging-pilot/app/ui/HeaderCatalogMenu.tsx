"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { ProductionCategoryGroup } from "../data/productionCategoryGroups";

export function HeaderCatalogMenu({ groups }: { groups: ProductionCategoryGroup[] }) {
  const menuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const closeFromOutside = (event: PointerEvent) => {
      const menu = menuRef.current;
      if (menu?.open && event.target instanceof Node && !menu.contains(event.target)) menu.removeAttribute("open");
    };
    const closeFromKeyboard = (event: KeyboardEvent) => {
      const menu = menuRef.current;
      if (!menu?.open || event.key !== "Escape") return;
      event.preventDefault();
      menu.removeAttribute("open");
      menu.querySelector<HTMLElement>("summary")?.focus();
    };
    document.addEventListener("pointerdown", closeFromOutside);
    document.addEventListener("keydown", closeFromKeyboard);
    return () => {
      document.removeEventListener("pointerdown", closeFromOutside);
      document.removeEventListener("keydown", closeFromKeyboard);
    };
  }, []);

  const closeMenu = () => menuRef.current?.removeAttribute("open");

  return <details className="header-catalog-menu" ref={menuRef}>
    <summary className="catalog-button" aria-label="Открыть каталог 7TOOL"><i aria-hidden="true" /><span>Каталог</span></summary>
    <div className="header-catalog-panel">
      <header>
        <div><span>Каталог 7TOOL</span><b>Оборудование по производственной задаче</b></div>
        <Link href="/catalog" onClick={closeMenu}>Весь каталог →</Link>
      </header>
      <div className="header-catalog-grid">
        {groups.map((group) => <section key={group.slug}>
          <Link className="header-catalog-group" href={group.href} onClick={closeMenu}>
            <span>{group.id}</span><b>{group.title}</b><small>{formatCategoryCount(group.subcategories.length)}</small>
          </Link>
          <nav aria-label={`Основные категории: ${group.title}`}>
            {group.subcategories.slice(0, 3).map((subcategory) => <Link href={subcategory.href} key={subcategory.slug} onClick={closeMenu}>{subcategory.label}<b aria-hidden="true">→</b></Link>)}
          </nav>
          <Link className="header-catalog-all" href={group.href} onClick={closeMenu}>Все категории направления →</Link>
        </section>)}
      </div>
      <footer>
        <div><b>Не знаете категорию?</b><span>Опишите операцию, материал и условия работы — инженер предложит подходящие варианты.</span></div>
        <Link href="/#quick-order" onClick={closeMenu}>Передать задачу инженеру</Link>
      </footer>
    </div>
  </details>;
}

function formatCategoryCount(count: number): string {
  const mod100 = count % 100;
  const mod10 = count % 10;
  const noun = mod100 >= 11 && mod100 <= 14 ? "категорий" : mod10 === 1 ? "категория" : mod10 >= 2 && mod10 <= 4 ? "категории" : "категорий";
  return `${count} ${noun}`;
}
