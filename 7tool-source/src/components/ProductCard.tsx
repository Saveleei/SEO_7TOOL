import type { Product } from "@/lib/data";
import { ProductImage } from "./ProductImage";
import { FavoriteButton } from "./FavoriteButton";
import { CardLive } from "./CardLive";
import { TrackedProductLink } from "./TrackedProductLink";
import { getProductAvailability, isValidPrice } from "@/lib/catalog";
import { advertisingVariantUrl, ecommerceProduct } from "@/lib/advertising";

function pluralRu(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

export function ProductCard({ p }: { p: Product }) {
  const availability = getProductAvailability(p);
  const representative = availability.availableVariants.find((variant) => isValidPrice(variant.price))
    ?? availability.orderableVariants.find((variant) => isValidPrice(variant.price))
    ?? p.variants[0];
  const href = representative ? advertisingVariantUrl(p, representative) : `/p/${p.slug}`;
  const ecommerceItem = representative ? ecommerceProduct(p, representative, "catalog") : null;
  const variantsCount = p.listingVariantCount ?? p.variants.length;
  const keyParams = (p.listingParams ?? Array.from(new Map(
    p.variants.flatMap((variant) => variant.params).map((param) => [param.name, param]),
  ).values())).slice(0, 2);

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-steel-200 bg-white shadow-card transition duration-300 hover:-translate-y-1 hover:border-amber-400 hover:shadow-elev">
      {p.isGroup && variantsCount > 1 && (
        <span className="absolute right-12 top-3 z-10 rounded-sm bg-white/90 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-steel-700 shadow-soft ring-1 ring-steel-200 backdrop-blur">
          {variantsCount} {pluralRu(variantsCount, "размер", "размера", "размеров")}
        </span>
      )}
      <div className="absolute right-3 top-3 z-10">
        <FavoriteButton productId={p.id} />
      </div>

      {ecommerceItem ? <TrackedProductLink href={href} item={ecommerceItem} className="block bg-gradient-to-br from-steel-50 via-white to-amber-50/40" ariaLabel={p.title}>
        <ProductImage p={p} className="aspect-square border-b border-steel-100" sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw" />
      </TrackedProductLink> : <div className="block bg-gradient-to-br from-steel-50 via-white to-amber-50/40"><ProductImage p={p} className="aspect-square border-b border-steel-100" sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw" /></div>}

      <div className="flex flex-1 flex-col gap-2.5 p-3 sm:gap-3 sm:p-4">
        <div className="flex items-center justify-between text-[10.5px] uppercase tracking-[0.14em] sm:text-[11px] sm:tracking-[0.16em]">
          <span className="truncate font-bold tracking-[0.16em] text-amber-700 sm:tracking-[0.18em]">{p.brand}</span>
          {p.sku && <span className="shrink-0 text-steel-400">арт. {p.sku}</span>}
        </div>

        {ecommerceItem ? <TrackedProductLink href={href} item={ecommerceItem} className="block">
          <h3 className="line-clamp-3 min-h-[54px] text-[13px] font-semibold leading-snug text-steel-900 transition group-hover:text-amber-700 sm:min-h-[60px] sm:text-[14px]">
            {p.title}
          </h3>
        </TrackedProductLink> : <h3 className="line-clamp-3 min-h-[54px] text-[13px] font-semibold leading-snug text-steel-900 sm:min-h-[60px] sm:text-[14px]">{p.title}</h3>}
        {keyParams.length > 0 && (
          <ul className="space-y-1 border-t border-steel-100 pt-2 text-[11.5px] text-steel-600">
            {keyParams.map((param) => (
              <li key={param.name} className="flex items-center justify-between gap-2">
                <span className="truncate">{param.name}</span>
                <span className="shrink-0 font-semibold text-steel-800">{param.value}{param.unit ? ` ${param.unit}` : ""}</span>
              </li>
            ))}
          </ul>
        )}

        <CardLive p={p} href={href} />
      </div>
    </article>
  );
}
