import Link from "next/link";
import type { ProductionSubcategory } from "../data/productionCategoryGroups";
import { HomepageCategoryMedia } from "./HomepageCategoryMedia";

type HomepageCategoryTile = ProductionSubcategory & { imageAlt?: string; imageFit?: "contain" | "cover"; imagePosition?: "center" | "top" | "bottom" | "left" | "right" };

export function HomepageCategoryTiles({ categories, compact = false }: { categories: HomepageCategoryTile[]; compact?: boolean }) {
  return <nav className={`homepage-category-tiles${compact ? " homepage-category-tiles--hero" : ""}`} aria-label="Основные разделы каталога">
    {categories.map((category, index) => <Link
      className={`homepage-category-tile homepage-category-tile--${index + 1}`}
      href={category.href}
      key={category.slug}
      aria-label={`${category.label}: открыть раздел каталога`}
    >
      <span className="homepage-category-tile-copy">
        {typeof category.count === "number" && <small>{formatProductCount(category.count)}</small>}
        <b>{category.label}</b>
        <span>Перейти в раздел <i aria-hidden="true">↗</i></span>
      </span>
      <span className="homepage-category-tile-media" data-fit={compact ? "contain" : category.imageFit || "contain"} data-position={compact ? "center" : category.imagePosition || "center"}>
        <HomepageCategoryMedia src={category.image} alt={category.imageAlt || category.label} />
      </span>
    </Link>)}
  </nav>;
}

function formatProductCount(count: number): string {
  const mod100 = count % 100;
  const mod10 = count % 10;
  const noun = mod100 >= 11 && mod100 <= 14 ? "товарных серий" : mod10 === 1 ? "товарная серия" : mod10 >= 2 && mod10 <= 4 ? "товарные серии" : "товарных серий";
  return `${count} ${noun}`;
}
