import Image from "next/image";
import Link from "next/link";
import type { ProductionCategoryGroup } from "../data/productionCategoryGroups";

export function ProductionCategoryGrid({ groups }: { groups: ProductionCategoryGroup[] }) {
  const featured = groups.filter((group) => group.featured);
  const supporting = groups.filter((group) => !group.featured);

  return <div className="production-categories">
    <div className="production-category-grid">
      {featured.map((group) => <article className="production-category-card" key={group.id}>
        <Link className="production-category-media" href={group.href} aria-label={`Открыть направление «${group.title}»`}><span>{group.id}</span><Image src={group.image} alt="" width={360} height={220} /></Link>
        <div className="production-category-copy"><span>{group.accent}</span><h3><Link href={group.href}>{group.title}</Link></h3><nav aria-label={`Подкатегории: ${group.title}`}>{group.subcategories.map((subcategory) => <Link href={subcategory.href} key={subcategory.slug}>{subcategory.label}<span aria-hidden="true">→</span></Link>)}</nav><Link className="production-category-action" href={group.href}>Все подкатегории →</Link></div>
      </article>)}
    </div>
    {supporting.map((group) => <article className="production-category-wide" key={group.id}>
      <Image src={group.image} alt="" width={210} height={145} /><div><span>{group.accent}</span><h3><Link href={group.href}>{group.title}</Link></h3><nav aria-label={`Подкатегории: ${group.title}`}>{group.subcategories.map((subcategory) => <Link href={subcategory.href} key={subcategory.slug}>{subcategory.label}</Link>)}</nav></div><Link href={group.href}>Все подкатегории →</Link>
    </article>)}
  </div>;
}
