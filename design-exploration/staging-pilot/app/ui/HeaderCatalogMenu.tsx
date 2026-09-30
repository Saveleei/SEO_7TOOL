"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { siteContact } from "../data/contactConfig";
import type { ProductionCategoryGroup } from "../data/productionCategoryGroups";

const FOCUSABLE_SELECTOR = "a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex='-1'])";

export function HeaderCatalogMenu({ groups }: { groups: ProductionCategoryGroup[] }) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState("");

  useEffect(() => {
    const menu = menuRef.current;
    const syncOpenState = () => {
      const open = Boolean(menu?.open);
      setIsOpen(open);
      if (open) {
        returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        if (window.matchMedia("(max-width: 760px)").matches) window.requestAnimationFrame(() => closeButtonRef.current?.focus());
      }
    };
    const closeFromOutside = (event: PointerEvent) => {
      if (menu?.open && event.target instanceof Node && !menu.contains(event.target)) {
        menu.removeAttribute("open");
        setIsOpen(false);
      }
    };
    const closeFromKeyboard = (event: KeyboardEvent) => {
      if (!menu?.open) return;
      if (event.key !== "Escape") {
        if (event.key !== "Tab" || !window.matchMedia("(max-width: 760px)").matches) return;
        const focusable = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []).filter((element) => element.offsetParent !== null);
        const first = focusable[0];
        const last = focusable.at(-1);
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        return;
      }
      event.preventDefault();
      menu.removeAttribute("open");
      setIsOpen(false);
      returnFocusRef.current?.focus();
    };
    const openFromMobileNavigation = () => {
      if (!menu) return;
      menu.setAttribute("open", "");
      setIsOpen(true);
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    };
    menu?.addEventListener("toggle", syncOpenState);
    document.addEventListener("pointerdown", closeFromOutside);
    document.addEventListener("keydown", closeFromKeyboard);
    window.addEventListener("7tool:open-catalog-menu", openFromMobileNavigation);
    return () => {
      menu?.removeEventListener("toggle", syncOpenState);
      document.removeEventListener("pointerdown", closeFromOutside);
      document.removeEventListener("keydown", closeFromKeyboard);
      window.removeEventListener("7tool:open-catalog-menu", openFromMobileNavigation);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("catalog-menu-open", isOpen);
    const background = Array.from(document.querySelectorAll<HTMLElement>("main, .footer, .mobile-action-bar, .mobile-manager-bubble"));
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
    returnFocusRef.current?.focus();
  };

  return <details className="header-catalog-menu" ref={menuRef}>
    <summary
      className="catalog-button"
      aria-current={pathname.startsWith("/catalog") ? "page" : undefined}
      aria-expanded={isOpen}
      aria-label={isOpen ? "Закрыть каталог 7TOOL" : "Открыть каталог 7TOOL"}
    ><i aria-hidden="true" /><span>Каталог</span></summary>
    <button className="header-catalog-backdrop" type="button" aria-label="Закрыть каталог" onClick={closeMenu} />
    <div className="header-catalog-panel" ref={panelRef} role="dialog" aria-modal="true" aria-label="Каталог и навигация 7TOOL">
      <div className="header-catalog-mobile-top">
        <Link className="header-catalog-mobile-brand" href="/" aria-label="7TOOL — главная" onClick={closeMenu}><span aria-hidden="true" /></Link>
        <form action="/search" role="search"><label className="sr-only" htmlFor="mobile-catalog-search">Найти товар</label><input id="mobile-catalog-search" name="q" type="search" placeholder="Модель, товар или задача" /><button type="submit" aria-label="Найти">⌕</button></form>
        <button ref={closeButtonRef} type="button" aria-label="Закрыть меню" onClick={closeMenu}>×</button>
      </div>
      <div className="header-catalog-mobile-contact">
        <a href={siteContact.phoneHref}><span>Позвонить</span><b>{siteContact.phone}</b></a>
        <a href={`mailto:${siteContact.email}?subject=Запрос%20с%20сайта%207TOOL`}><span>Написать</span><b>{siteContact.email}</b></a>
      </div>
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
              <span className="header-catalog-group-media"><Image src={group.representativeImage || group.image} alt="" width={56} height={44} unoptimized={Boolean(group.representativeImage)} /></span>
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
              <span className="header-catalog-group-media"><Image src={group.representativeImage || group.image} alt="" width={56} height={44} unoptimized={Boolean(group.representativeImage)} /></span>
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
      <nav className="header-catalog-service-links" aria-label="Информация для покупателей">
        <Link href="/company" onClick={closeMenu}>О компании</Link>
        <Link href="/delivery" onClick={closeMenu}>Доставка по России</Link>
        <Link href="/payment" onClick={closeMenu}>Оплата и отсрочка</Link>
        <Link href="/warranty" onClick={closeMenu}>Гарантия и сервис</Link>
        <Link href="/contacts" onClick={closeMenu}>Контакты и реквизиты</Link>
      </nav>
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
