"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ProductionCategoryGroup } from "../data/productionCategoryGroups";

export function HeaderCatalogMenu({ groups }: { groups: ProductionCategoryGroup[] }) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState("");

  useEffect(() => {
    const menu = menuRef.current;
    const syncOpenState = () => setIsOpen(Boolean(menu?.open));
    const closeFromOutside = (event: PointerEvent) => {
      if (menu?.open && event.target instanceof Node && !menu.contains(event.target)) {
        menu.removeAttribute("open");
        setIsOpen(false);
      }
    };
    const closeFromKeyboard = (event: KeyboardEvent) => {
      if (!menu?.open || event.key !== "Escape") return;
      event.preventDefault();
      menu.removeAttribute("open");
      setIsOpen(false);
      menu.querySelector<HTMLElement>("summary")?.focus();
    };
    menu?.addEventListener("toggle", syncOpenState);
    document.addEventListener("pointerdown", closeFromOutside);
    document.addEventListener("keydown", closeFromKeyboard);
    return () => {
      menu?.removeEventListener("toggle", syncOpenState);
      document.removeEventListener("pointerdown", closeFromOutside);
      document.removeEventListener("keydown", closeFromKeyboard);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("catalog-menu-open", isOpen);
    const background = Array.from(document.querySelectorAll<HTMLElement>("main, .footer, .mobile-action-bar"));
    for (const element of background) {
      if (isOpen) element.setAttribute("inert", "");
      else element.removeAttribute("inert");
    }
    return () => {
      document.body.classList.remove("catalog-menu-open");
      for (const element of background) element.removeAttribute("inert");
    };
  }, [isOpen]);

  const closeMenu = () => {
    menuRef.current?.removeAttribute("open");
    setIsOpen(false);
    setExpandedGroup("");
  };

  return <details className="header-catalog-menu" ref={menuRef}>
    <summary
      className="catalog-button"
      aria-current={pathname.startsWith("/catalog") ? "page" : undefined}
      aria-expanded={isOpen}
      aria-label={isOpen ? "Закрыть каталог 7TOOL" : "Открыть каталог 7TOOL"}
      onClick={() => setIsOpen(!menuRef.current?.open)}
    ><i aria-hidden="true" /><span>Каталог</span></summary>
    <button className="header-catalog-backdrop" type="button" aria-label="Закрыть каталог" onClick={closeMenu} />
    <div className="header-catalog-panel" aria-label="Каталог оборудования">
      <header>
        <div><span>Каталог 7TOOL</span><b>Оборудование и оснастка по разделам</b><small>Каждая категория показана один раз. Подбор по операции — отдельным сценарием.</small></div>
        <Link href="/catalog" onClick={closeMenu}>Открыть весь каталог →</Link>
      </header>
      <div className="header-catalog-grid">
        {groups.map((group) => {
          const isExpanded = expandedGroup === group.slug;
          const navigationId = `catalog-group-${group.slug}`;
          return <section key={group.slug} data-expanded={isExpanded ? "true" : "false"}>
            <Link className="header-catalog-group header-catalog-group--desktop" href={group.href} onClick={closeMenu}>
              <span>{group.id}</span>
              <span><b>{group.title}</b><small>{formatCategoryCount(group.subcategories.length)}</small></span>
              <i aria-hidden="true">→</i>
            </Link>
            <button
              className="header-catalog-group header-catalog-group--mobile"
              type="button"
              aria-controls={navigationId}
              aria-expanded={isExpanded}
              onClick={() => setExpandedGroup(isExpanded ? "" : group.slug)}
            >
              <span>{group.id}</span>
              <span><b>{group.title}</b><small>{formatCategoryCount(group.subcategories.length)}</small></span>
              <i aria-hidden="true">{isExpanded ? "−" : "+"}</i>
            </button>
            <nav id={navigationId} aria-label={`Категории: ${group.title}`}>
              {group.subcategories.map((subcategory) => <Link href={subcategory.href} key={subcategory.slug} onClick={closeMenu}>{subcategory.label}<b aria-hidden="true">→</b></Link>)}
            </nav>
            <Link className="header-catalog-overview" href={group.href} onClick={closeMenu}>Обзор раздела →</Link>
          </section>;
        })}
      </div>
      <footer>
        <div><b>Не знаете категорию?</b><span>Опишите операцию, материал и условия работы — инженер предложит подходящие варианты.</span></div>
        <Link href="/#production-categories" onClick={closeMenu}>Выбрать по задаче</Link>
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
