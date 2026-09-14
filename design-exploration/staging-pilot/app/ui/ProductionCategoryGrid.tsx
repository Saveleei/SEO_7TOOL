import Image from "next/image";
import Link from "next/link";
import type { ProductionCategoryGroup } from "../data/productionCategoryGroups";

export function ProductionCategoryGrid({ groups }: { groups: ProductionCategoryGroup[] }) {
  return <div className="production-categories">
    <div className="production-category-grid">
      {groups.map((group) => <article className={`production-category-card${group.featured ? " production-category-card--featured" : ""}`} key={group.id}>
        <Link className="production-category-media" href={group.href} aria-label={`Открыть направление «${group.title}»`}><span>{group.id}</span><Image src={group.image} alt="" width={360} height={220} /></Link>
        <div className="production-category-copy"><span>{group.accent}</span><h3><Link href={group.href}>{group.title}</Link></h3><p>{group.subcategories.length} {pluralizeSections(group.subcategories.length)} · {(group.productCount ?? 0).toLocaleString("ru-RU")} товарных групп</p><nav aria-label={`Подкатегории: ${group.title}`}>{group.subcategories.map((subcategory) => <Link href={subcategory.href} key={subcategory.slug}><span>{subcategory.label}</span><small>{(subcategory.count ?? 0).toLocaleString("ru-RU")}</small><b aria-hidden="true">→</b></Link>)}</nav><Link className="production-category-action" href={group.href}>Открыть направление →</Link></div>
      </article>)}
    </div>
  </div>;
}

function pluralizeSections(count: number): string {
  const mod100 = count % 100;
  const mod10 = count % 10;
  if (mod100 >= 11 && mod100 <= 14) return "разделов";
  if (mod10 === 1) return "раздел";
  if (mod10 >= 2 && mod10 <= 4) return "раздела";
  return "разделов";
}
