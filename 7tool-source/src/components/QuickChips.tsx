import Link from "next/link";
import type { Product } from "@/lib/catalog";

// Топ-чипы быстрого фильтра под H1 категории
export function QuickChips({ items, slug }: { items: Product[]; slug: string }) {
  const counts = new Map<string, { name: string; value: string; count: number }>();
  for (const p of items) {
    for (const v of p.variants) {
      for (const prm of v.params) {
        if (!["Серия", "Хвостовик", "Покрытие"].includes(prm.name)) continue;
        const key = `${prm.name}::${prm.value}`;
        const cur = counts.get(key) ?? { name: prm.name, value: prm.value, count: 0 };
        cur.count += 1;
        counts.set(key, cur);
      }
    }
  }
  const chips = Array.from(counts.values()).sort((a, b) => b.count - a.count).slice(0, 6);
  if (chips.length === 0) return null;

  return (
    <div className="mt-7 flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-300">
        быстрый поиск:
      </span>
      {chips.map((c) => (
        <Link
          key={`${c.name}-${c.value}`}
          href={`/c/${slug}?${encodeURIComponent(c.name)}=${encodeURIComponent(c.value)}`}
          rel="nofollow"
          data-facet-classification="NON_INDEXABLE_FACET"
          className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[12.5px] font-semibold text-white transition hover:-translate-y-0.5 hover:border-amber-400 hover:bg-amber-400 hover:text-steel-900"
        >
          {c.value}
          <span className="text-[10.5px] text-steel-300 transition group-hover:text-steel-700">
            · {c.count}
          </span>
        </Link>
      ))}
    </div>
  );
}
