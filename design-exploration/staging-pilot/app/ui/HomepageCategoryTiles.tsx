import Image from "next/image";
import Link from "next/link";
import type { ProductionSubcategory } from "../data/productionCategoryGroups";

type HomepageCategoryTile = ProductionSubcategory & { imageAlt?: string; imageFit?: "contain" | "cover"; imagePosition?: "center" | "top" | "bottom" | "left" | "right" };

export function HomepageCategoryTiles({ categories }: { categories: HomepageCategoryTile[] }) {
  return <nav className="homepage-category-tiles" aria-label="Основные разделы каталога">
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
      <span className="homepage-category-tile-media" data-fit={category.imageFit || "contain"} data-position={category.imagePosition || "center"}>
        {category.image
          ? <Image src={category.image} alt={category.imageAlt || category.label} fill sizes="(max-width: 760px) 42vw, (max-width: 1050px) 34vw, 420px" unoptimized />
          : <span aria-hidden="true">7T</span>}
      </span>
    </Link>)}
  </nav>;
}

function formatProductCount(count: number): string {
  const mod100 = count % 100;
  const mod10 = count % 10;
  const noun = mod100 >= 11 && mod100 <= 14 ? "товаров" : mod10 === 1 ? "товар" : mod10 >= 2 && mod10 <= 4 ? "товара" : "товаров";
  return `${count} ${noun}`;
}
