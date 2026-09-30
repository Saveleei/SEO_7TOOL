import Image from "next/image";
import Link from "next/link";
import type { ProductionCategoryGroup } from "../data/productionCategoryGroups";

export function HomepageTaskPaths({ groups }: { groups: ProductionCategoryGroup[] }) {
  return <div className="homepage-task-paths">
    {groups.map((group) => <article className="homepage-task-path" key={group.slug}>
      <span className="homepage-task-path__number">{group.id}</span>
      <div className="homepage-task-path__copy">
        <small>{group.accent}</small>
        <h3><Link href={group.href}>{group.title}</Link></h3>
        <nav className="homepage-task-path__subcategories" aria-label={`Разделы: ${group.title}`}>
          {group.subcategories.slice(0, 4).map((category) => <Link href={category.href} key={category.slug}>{category.label}<span aria-hidden="true">→</span></Link>)}
          {group.subcategories.length > 4 && <Link className="homepage-task-path__more" href={group.href}>Ещё {group.subcategories.length - 4}<span aria-hidden="true">→</span></Link>}
        </nav>
      </div>
      <Image src={group.representativeImage ?? group.image} alt="" width={130} height={92} unoptimized={Boolean(group.representativeImage)} />
      <Link className="homepage-task-path__action" href={group.href}>Подобрать по задаче <span aria-hidden="true">→</span></Link>
    </article>)}
  </div>;
}
