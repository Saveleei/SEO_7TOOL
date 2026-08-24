import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

type SearchRow = {
  id: string;
  slug: string;
  title: string;
  brand: string;
  sku: string;
  variant_skus: string;
  stock: number;
};

type IndexedSearchRow = SearchRow & {
  variantSkus: string[];
  haystack: string;
};

let cachedAt = 0;
let cachedIndex: IndexedSearchRow[] = [];

function searchIndex(): IndexedSearchRow[] {
  const now = Date.now();
  if (cachedIndex.length && now - cachedAt < 60_000) return cachedIndex;
  const rows = db().prepare<unknown[], SearchRow>(`
    SELECT p.id, p.slug, p.title, COALESCE(p.brand, '') AS brand,
           COALESCE(p.sku, '') AS sku, p.stock,
           COALESCE(GROUP_CONCAT(NULLIF(v.sku, ''), CHAR(31)), '') AS variant_skus
      FROM products p
      LEFT JOIN variants v ON v.product_id = p.id
     WHERE p.draft = 0
     GROUP BY p.id
  `).all();
  cachedIndex = rows.map((row) => {
    const variantSkus = row.variant_skus ? row.variant_skus.split(String.fromCharCode(31)) : [];
    return {
      ...row,
      variantSkus,
      haystack: [row.title, row.brand, row.sku, ...variantSkus].join(" ").toLocaleLowerCase("ru"),
    };
  });
  cachedAt = now;
  return cachedIndex;
}

export function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") || "").trim().toLocaleLowerCase("ru").slice(0, 80);
  if (query.length < 2) return NextResponse.json({ items: [] });
  const items = searchIndex()
    .filter((product) => product.haystack.includes(query))
    .sort((a, b) => {
      const aSku = a.sku.toLocaleLowerCase("ru");
      const bSku = b.sku.toLocaleLowerCase("ru");
      const aExact = aSku === query || a.variantSkus.some((sku) => sku.toLocaleLowerCase("ru") === query);
      const bExact = bSku === query || b.variantSkus.some((sku) => sku.toLocaleLowerCase("ru") === query);
      if (aExact !== bExact) return aExact ? -1 : 1;
      const aStarts = aSku.startsWith(query) || a.title.toLocaleLowerCase("ru").startsWith(query);
      const bStarts = bSku.startsWith(query) || b.title.toLocaleLowerCase("ru").startsWith(query);
      if (aStarts !== bStarts) return aStarts ? -1 : 1;
      return Number(b.stock > 0) - Number(a.stock > 0) || a.title.localeCompare(b.title, "ru");
    })
    .slice(0, 8)
    .map((product) => ({
      id: product.id,
      slug: product.slug,
      title: product.title,
      brand: product.brand,
      sku: product.sku,
      variantSkus: product.variantSkus,
    }));
  return NextResponse.json({ items }, {
    headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
  });
}
