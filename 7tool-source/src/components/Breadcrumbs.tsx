import Link from "next/link";

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Хлебные крошки" className="-mx-1 overflow-x-auto px-1 text-[12.5px] text-steel-500 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      <ol className="flex flex-nowrap items-center gap-1.5 whitespace-nowrap sm:flex-wrap">
        {items.map((c, i) => {
          const isLast = i === items.length - 1;
          return (
            <li
              key={i}
              className={`flex shrink-0 items-center gap-1.5 ${isLast && items.length > 1 ? "hidden sm:flex" : ""}`}
            >
              {c.href ? (
                <Link href={c.href} className="hover:text-amber-700 transition">
                  {c.label}
                </Link>
              ) : (
                <span className="text-steel-700">{c.label}</span>
              )}
              {!isLast && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="text-steel-300">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
