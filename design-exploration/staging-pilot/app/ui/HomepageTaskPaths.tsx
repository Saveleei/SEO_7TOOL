"use client";

import Link from "next/link";
import { useState } from "react";
import type { ProductionCategoryGroup } from "../data/productionCategoryGroups";

export function HomepageTaskPaths({ groups }: { groups: ProductionCategoryGroup[] }) {
  const [expandedGroup, setExpandedGroup] = useState("");

  return <div className="homepage-task-paths">
    {groups.map((group) => {
      const expanded = expandedGroup === group.slug;
      const navigationId = `homepage-task-${group.slug}`;
      return <article className="homepage-task-path" data-expanded={expanded ? "true" : "false"} key={group.slug}>
        <header className="homepage-task-path__header">
          <span className="homepage-task-path__number">{group.id}</span>
          <div className="homepage-task-path__copy"><h3><Link href={group.href}>{group.title}</Link></h3><small>{group.accent}</small></div>
          <button type="button" aria-controls={navigationId} aria-expanded={expanded} aria-label={`${expanded ? "Свернуть" : "Показать"} подразделы: ${group.title}`} onClick={() => setExpandedGroup(expanded ? "" : group.slug)}><span>{expanded ? "Свернуть" : "Разделы"}</span><i aria-hidden="true">{expanded ? "−" : "+"}</i></button>
        </header>
        <nav className="homepage-task-path__subcategories" id={navigationId} aria-label={`Подразделы: ${group.title}`}>
          {group.subcategories.slice(0, 4).map((category) => <Link href={category.href} key={category.slug}>
            <span className="homepage-task-path__subcategory-copy"><b>{category.label}</b><small>{formatSeriesCount(category.count ?? 0)}</small></span>
            <i aria-hidden="true">→</i>
          </Link>)}
        </nav>
        <Link className="homepage-task-path__action" href={group.href}>
          <span><b>Подобрать по задаче</b><small>{formatCategoryCount(group.subcategories.length)} в направлении</small></span>
          <i aria-hidden="true">→</i>
        </Link>
      </article>;
    })}
  </div>;
}

function formatSeriesCount(count: number): string {
  const mod100 = count % 100;
  const mod10 = count % 10;
  const noun = mod100 >= 11 && mod100 <= 14 ? "серий" : mod10 === 1 ? "серия" : mod10 >= 2 && mod10 <= 4 ? "серии" : "серий";
  return `${count} ${noun}`;
}

function formatCategoryCount(count: number): string {
  const mod100 = count % 100;
  const mod10 = count % 10;
  const noun = mod100 >= 11 && mod100 <= 14 ? "категорий" : mod10 === 1 ? "категория" : mod10 >= 2 && mod10 <= 4 ? "категории" : "категорий";
  return `${count} ${noun}`;
}
