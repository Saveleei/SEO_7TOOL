import Link from "next/link";
import { canonicalUrl } from "../data/seo";
import { JsonLd } from "./JsonLd";

export function Breadcrumbs({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <>
      <JsonLd data={{ "@context":"https://schema.org", "@type":"BreadcrumbList", itemListElement:items.map((item, index) => ({ "@type":"ListItem", position:index + 1, name:item.label, ...(item.href ? { item:canonicalUrl(item.href) } : {}) })) }} />
      <nav className="breadcrumbs" aria-label="Хлебные крошки">
        {items.map((item, index) => (
          <span key={`${item.label}-${index}`}>
            {index > 0 && <i>/</i>}
            {item.href ? <Link href={item.href}>{item.label}</Link> : <b>{item.label}</b>}
          </span>
        ))}
      </nav>
    </>
  );
}
