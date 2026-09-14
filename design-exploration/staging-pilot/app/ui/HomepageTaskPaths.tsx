import Image from "next/image";
import Link from "next/link";
import type { ProductionCategoryGroup } from "../data/productionCategoryGroups";

export function HomepageTaskPaths({ groups }: { groups: ProductionCategoryGroup[] }) {
  return <div className="homepage-task-paths">
    {groups.map((group) => <Link className="homepage-task-path" href={group.href} key={group.slug}>
      <span className="homepage-task-path__number">{group.id}</span>
      <div className="homepage-task-path__copy">
        <small>{group.accent}</small>
        <h3>{group.title}</h3>
        <p>{group.subcategories.slice(0, 2).map((category) => category.label).join(" · ")}</p>
      </div>
      <Image src={group.representativeImage ?? group.image} alt="" width={130} height={92} unoptimized={Boolean(group.representativeImage)} />
      <b>Подобрать по задаче <span aria-hidden="true">→</span></b>
    </Link>)}
  </div>;
}
