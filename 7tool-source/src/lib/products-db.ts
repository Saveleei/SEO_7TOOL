import { db } from "./db";
import type { Category, Product, Variant, CategoryIcon } from "./data";
import { compareCatalogProducts, variantSlug } from "./catalog";
import { getSeoConflictProductIds } from "./seo-conflicts";

type DbCategory = {
  slug: string;
  title: string;
  icon: string | null;
  sort_order: number | null;
};

type DbProduct = {
  id: string;
  slug: string;
  title: string;
  brand: string | null;
  sku: string | null;
  category: string | null;
  icon: string | null;
  description: string | null;
  images: string;
  accessories: string;
  is_group: number;
  stock: number;
  param_axes: string;
  price_from: number | null;
  price_to: number | null;
  discount_pct: number | null;
  draft: number;
  meta_title: string | null;
  meta_description: string | null;
  seo_text: string | null;
  seo_fingerprint: string | null;
  seo_source: string | null;
  seo_generated_at: number | null;
  sort_order: number | null;
  manual_sort_order: number | null;
  feed_category_id: string | null;
  updated_at: number;
};

type DbVariant = {
  id: string;
  product_id: string;
  sku: string | null;
  name: string | null;
  barcode: string | null;
  price: number | null;
  old_price: number | null;
  quantity: number | null;
  available: number;
  params: string;
  images: string | null;
  sort_order: number | null;
};

function parseJson<T>(s: string | null, fallback: T): T {
  if (!s) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
}

function rowToProduct(p: DbProduct, vs: DbVariant[]): Product {
  const variants: Variant[] = vs.map((v) => ({
    id: v.id,
    sku: v.sku || "",
    name: v.name || undefined,
    barcode: v.barcode || undefined,
    price: v.price ?? undefined,
    oldPrice: v.old_price ?? undefined,
    quantity: v.quantity ?? undefined,
    available: !!v.available,
    params: parseJson(v.params, []),
    images: v.images ? parseJson(v.images, undefined as unknown as string[]) : undefined,
  }));
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    brand: p.brand || "—",
    sku: p.sku || "",
    category: p.category || "",
    icon: (p.icon || "fixture") as CategoryIcon,
    description: p.description ?? undefined,
    metaTitle: p.meta_title ?? undefined,
    metaDescription: p.meta_description ?? undefined,
    seoText: p.seo_text ?? undefined,
    seoFingerprint: p.seo_fingerprint ?? undefined,
    seoSource: p.seo_source ?? undefined,
    seoGeneratedAt: p.seo_generated_at ?? undefined,
    images: parseJson(p.images, []),
    accessories: parseJson(p.accessories, []),
    isGroup: !!p.is_group,
    variants,
    stock: p.stock,
    paramAxes: parseJson(p.param_axes, []),
    priceFrom: p.price_from ?? undefined,
    priceTo: p.price_to ?? undefined,
    discountPct: p.discount_pct ?? undefined,
    manualSortOrder: p.manual_sort_order ?? undefined,
    feedCategoryId: p.feed_category_id ?? undefined,
    draft: p.draft ? true : undefined,
  };
}

function hasProductImage(product: Product): boolean {
  return product.images.some(Boolean) || product.variants.some((variant) => variant.images?.some(Boolean));
}

const PUBLIC_PRODUCT_SQL = `
  p.draft = 0
  AND EXISTS (SELECT 1 FROM categories c WHERE c.slug = p.category AND c.published = 1)
  AND (p.images != '[]' OR EXISTS (
    SELECT 1 FROM variants image_variant
     WHERE image_variant.product_id = p.id
       AND COALESCE(image_variant.images, '[]') != '[]'
  ))`;

function hydrateProducts(prows: DbProduct[]): Product[] {
  if (prows.length === 0) return [];
  const ids = prows.map((product) => product.id);
  const placeholders = ids.map(() => "?").join(",");
  const vrows = db()
    .prepare<unknown[], DbVariant>(
      `SELECT * FROM variants WHERE product_id IN (${placeholders}) ORDER BY sort_order ASC, ROWID ASC`,
    )
    .all(...ids);
  const byProduct = new Map<string, DbVariant[]>();
  for (const variant of vrows) {
    byProduct.set(variant.product_id, [...(byProduct.get(variant.product_id) ?? []), variant]);
  }
  return prows.map((product) => rowToProduct(product, byProduct.get(product.id) ?? [])).filter(hasProductImage);
}

export function getAllCategories(): Category[] {
  const d = db();
  const rows = d
    .prepare<unknown[], DbCategory>(
      "SELECT slug, title, icon, sort_order FROM categories ORDER BY sort_order ASC, title ASC",
    )
    .all();
  // count живых (не draft) продуктов
  const counts = d
    .prepare<unknown[], { category: string; n: number }>(
      `SELECT p.category, COUNT(*) AS n
         FROM products p
        WHERE p.draft = 0
          AND (p.images != '[]' OR EXISTS (
            SELECT 1 FROM variants v WHERE v.product_id = p.id AND COALESCE(v.images, '[]') != '[]'
          ))
        GROUP BY p.category`,
    )
    .all() as { category: string; n: number }[];
  const map = new Map(counts.map((c) => [c.category, c.n]));
  return rows
    .map((r) => ({
      slug: r.slug,
      title: r.title,
      icon: (r.icon || "fixture") as CategoryIcon,
      count: map.get(r.slug) ?? 0,
    }))
    .filter((c) => c.count > 0);
}

export function getAllProducts(): Product[] {
  const d = db();
  const prows = d
    .prepare<unknown[], DbProduct>(
      `SELECT * FROM products WHERE draft = 0
        ORDER BY (stock > 0) DESC, (price_from IS NULL) ASC,
                 (CASE WHEN images != '[]' THEN 0 ELSE 1 END) ASC,
                 price_from ASC`,
    )
    .all();
  if (prows.length === 0) return [];
  const ids = prows.map((p) => p.id);
  const placeholders = ids.map(() => "?").join(",");
  const vrows = d
    .prepare<unknown[], DbVariant>(
      `SELECT * FROM variants WHERE product_id IN (${placeholders}) ORDER BY sort_order ASC, ROWID ASC`,
    )
    .all(...ids);
  const byProd = new Map<string, DbVariant[]>();
  for (const v of vrows) {
    const arr = byProd.get(v.product_id) ?? [];
    arr.push(v);
    byProd.set(v.product_id, arr);
  }
  return prows
    .map((p) => rowToProduct(p, byProd.get(p.id) ?? []))
    .filter(hasProductImage)
    .sort(compareCatalogProducts);
}

export function getProductsByCategory(category: string): Product[] {
  const d = db();
  const prows = d
    .prepare<unknown[], DbProduct>(
      `SELECT * FROM products
        WHERE draft = 0 AND category = ?
        ORDER BY (manual_sort_order IS NULL) ASC, manual_sort_order ASC,
                 (stock > 0) DESC, (price_from IS NULL) ASC,
                 (CASE WHEN images != '[]' THEN 0 ELSE 1 END) ASC,
                 price_from ASC, title ASC`,
    )
    .all(category);
  if (prows.length === 0) return [];
  const ids = prows.map((p) => p.id);
  const placeholders = ids.map(() => "?").join(",");
  const vrows = d
    .prepare<unknown[], DbVariant>(
      `SELECT * FROM variants WHERE product_id IN (${placeholders}) ORDER BY sort_order ASC, ROWID ASC`,
    )
    .all(...ids);
  const byProd = new Map<string, DbVariant[]>();
  for (const variant of vrows) {
    const variants = byProd.get(variant.product_id) ?? [];
    variants.push(variant);
    byProd.set(variant.product_id, variants);
  }
  return prows
    .map((product) => rowToProduct(product, byProd.get(product.id) ?? []))
    .filter(hasProductImage)
    .sort(compareCatalogProducts);
}

export function getProductById(id: string): Product | undefined {
  const d = db();
  const p = d
    .prepare<unknown[], DbProduct>("SELECT * FROM products WHERE id = ?")
    .get(id);
  if (!p) return undefined;
  const vs = d
    .prepare<unknown[], DbVariant>(
      "SELECT * FROM variants WHERE product_id = ? ORDER BY sort_order ASC, ROWID ASC",
    )
    .all(id);
  return rowToProduct(p, vs);
}

export function getProductBySlug(slug: string): Product | undefined {
  const d = db();
  const p = d
    .prepare<unknown[], DbProduct>("SELECT * FROM products WHERE slug = ?")
    .get(slug);
  if (!p) return undefined;
  const vs = d
    .prepare<unknown[], DbVariant>(
      "SELECT * FROM variants WHERE product_id = ? ORDER BY sort_order ASC, ROWID ASC",
    )
    .all(p.id);
  return rowToProduct(p, vs);
}

export type ResolvedPublicProduct = {
  product: Product;
  variant?: Variant;
  isVariant: boolean;
};

/**
 * Product pages, visible HTML and JSON-LD use the same current SQLite row.
 * A variant URL always starts with its product slug followed by `--`.
 */
export function resolvePublicProductSlug(slug: string): ResolvedPublicProduct | undefined {
  const d = db();
  const direct = d
    .prepare<unknown[], DbProduct>(`SELECT p.* FROM products p WHERE p.slug = ? AND ${PUBLIC_PRODUCT_SQL}`)
    .get(slug);
  if (direct) {
    const product = hydrateProducts([direct])[0];
    return product ? { product, isVariant: false } : undefined;
  }

  const separator = slug.indexOf("--");
  if (separator <= 0) return undefined;
  const baseSlug = slug.slice(0, separator);
  const row = d
    .prepare<unknown[], DbProduct>(`SELECT p.* FROM products p WHERE p.slug = ? AND ${PUBLIC_PRODUCT_SQL}`)
    .get(baseSlug);
  if (!row) return undefined;
  const product = hydrateProducts([row])[0];
  if (!product) return undefined;
  const variant = product.variants.find((candidate) => variantSlug(product, candidate) === slug);
  return variant ? { product, variant, isVariant: true } : undefined;
}

export function getPublicRelatedProducts(category: string, excludeId: string, limit = 4): Product[] {
  const rows = db()
    .prepare<unknown[], DbProduct>(
      `SELECT p.* FROM products p
        WHERE p.category = ? AND p.id != ? AND ${PUBLIC_PRODUCT_SQL}
        ORDER BY (p.manual_sort_order IS NULL) ASC, p.manual_sort_order ASC,
                 (p.stock > 0) DESC, (p.price_from IS NULL) ASC, p.price_from ASC, p.title ASC
        LIMIT ?`,
    )
    .all(category, excludeId, limit);
  return hydrateProducts(rows).sort(compareCatalogProducts);
}

export type PublicBrandStats = {
  productCount: number;
  variantCount: number;
  stockedCount: number;
  saleCount: number;
  categories: Array<{ slug: string; title: string; count: number }>;
};

export function listPublicBrands(): string[] {
  return db()
    .prepare<unknown[], { brand: string }>(
      `SELECT DISTINCT p.brand AS brand FROM products p
        WHERE ${PUBLIC_PRODUCT_SQL} AND p.brand IS NOT NULL AND p.brand NOT IN ('', '—')
        ORDER BY p.brand COLLATE NOCASE`,
    )
    .all()
    .map((row) => row.brand);
}

export function getPublicBrandProducts(
  brand: string,
  limit = 24,
  offset = 0,
): { items: Product[]; total: number } {
  const d = db();
  const total = (d.prepare(
    `SELECT COUNT(*) AS n FROM products p WHERE p.brand = ? AND ${PUBLIC_PRODUCT_SQL}`,
  ).get(brand) as { n: number }).n;
  const rows = d
    .prepare<unknown[], DbProduct>(
      `SELECT p.* FROM products p
        WHERE p.brand = ? AND ${PUBLIC_PRODUCT_SQL}
        ORDER BY (p.stock > 0) DESC, (p.price_from IS NULL) ASC, p.price_from ASC, p.title ASC
        LIMIT ? OFFSET ?`,
    )
    .all(brand, limit, offset);
  return { items: hydrateProducts(rows), total };
}

export function getPublicBrandStats(brand: string): PublicBrandStats | undefined {
  const d = db();
  const totals = d.prepare(
    `SELECT COUNT(*) AS productCount,
            COALESCE(SUM((SELECT COUNT(*) FROM variants v WHERE v.product_id = p.id)), 0) AS variantCount,
            COALESCE(SUM(CASE WHEN p.stock > 0 THEN 1 ELSE 0 END), 0) AS stockedCount,
            COALESCE(SUM(CASE WHEN p.discount_pct > 0 THEN 1 ELSE 0 END), 0) AS saleCount
       FROM products p WHERE p.brand = ? AND ${PUBLIC_PRODUCT_SQL}`,
  ).get(brand) as Omit<PublicBrandStats, "categories">;
  if (!totals.productCount) return undefined;
  const categories = d.prepare<unknown[], { slug: string; title: string; count: number }>(
    `SELECT c.slug, c.title, COUNT(*) AS count
       FROM products p JOIN categories c ON c.slug = p.category
      WHERE p.brand = ? AND ${PUBLIC_PRODUCT_SQL}
      GROUP BY c.slug, c.title ORDER BY count DESC, c.title ASC`,
  ).all(brand);
  return { ...totals, categories };
}

export function listPublicProductSlugs(): string[] {
  const d = db();
  const conflictIds = getSeoConflictProductIds();
  const rows = d.prepare<unknown[], { productId: string; productSlug: string; variantId: string | null; variantSku: string | null }>(
    `SELECT p.id AS productId, p.slug AS productSlug, v.id AS variantId, v.sku AS variantSku
       FROM products p LEFT JOIN variants v ON v.product_id = p.id
      WHERE ${PUBLIC_PRODUCT_SQL}
      ORDER BY p.slug, v.sort_order, v.ROWID`,
  ).all();
  const slugs = new Set<string>();
  for (const row of rows) {
    if (conflictIds.has(row.productId)) continue;
    slugs.add(row.productSlug);
    if (row.variantId) {
      slugs.add(variantSlug(
        { slug: row.productSlug },
        { id: row.variantId, sku: row.variantSku || "" },
      ));
    }
  }
  return Array.from(slugs);
}

export function listProductsForAdmin(opts: {
  q?: string;
  category?: string;
  brand?: string;
  draft?: boolean;
  limit?: number;
  offset?: number;
}): { rows: AdminProductRow[]; total: number } {
  const d = db();
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (opts.q) {
    where.push("(title LIKE ? OR slug LIKE ? OR sku LIKE ? OR brand LIKE ?)");
    const like = `%${opts.q}%`;
    args.push(like, like, like, like);
  }
  if (opts.category) { where.push("category = ?"); args.push(opts.category); }
  if (opts.brand) { where.push("brand = ?"); args.push(opts.brand); }
  if (typeof opts.draft === "boolean") { where.push("draft = ?"); args.push(opts.draft ? 1 : 0); }
  const wh = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = (d.prepare(`SELECT COUNT(*) AS n FROM products ${wh}`).get(...args) as { n: number }).n;
  const rows = d
    .prepare<unknown[], AdminProductRow>(
      `SELECT id, slug, title, brand, sku, category, stock, price_from, price_to, draft,
              manual_sort_order, updated_at,
              (SELECT COUNT(*) FROM variants v WHERE v.product_id = products.id) AS variant_count,
              (SELECT json_array_length(images)) AS image_count
         FROM products ${wh}
         ORDER BY updated_at DESC
         LIMIT ? OFFSET ?`,
    )
    .all(...args, opts.limit ?? 50, opts.offset ?? 0);
  return { rows, total };
}

export type AdminProductRow = {
  id: string;
  slug: string;
  title: string;
  brand: string | null;
  sku: string | null;
  category: string | null;
  stock: number;
  price_from: number | null;
  price_to: number | null;
  draft: number;
  updated_at: number;
  variant_count: number;
  image_count: number;
  manual_sort_order: number | null;
};

export type ProductPatch = Partial<{
  slug: string;
  title: string;
  brand: string;
  sku: string;
  category: string;
  description: string;
  images: string[];
  accessories: string[];
  metaTitle: string;
  metaDescription: string;
  seoText: string;
  seoFingerprint: string | null;
  seoSource: string | null;
  seoGeneratedAt: number | null;
  draft: boolean;
  paramAxes: string[];
  discountPct: number | null;
  manualSortOrder: number | null;
}>;

export function updateProduct(id: string, patch: ProductPatch) {
  const d = db();
  const fields: string[] = [];
  const args: (string | number | null)[] = [];
  const map: Record<string, string> = {
    slug: "slug",
    title: "title",
    brand: "brand",
    sku: "sku",
    category: "category",
    description: "description",
    metaTitle: "meta_title",
    metaDescription: "meta_description",
    seoText: "seo_text",
    seoFingerprint: "seo_fingerprint",
    seoSource: "seo_source",
    seoGeneratedAt: "seo_generated_at",
  };
  for (const k of Object.keys(map) as (keyof typeof map)[]) {
    if (patch[k as keyof ProductPatch] !== undefined) {
      fields.push(`${map[k]} = ?`);
      args.push((patch[k as keyof ProductPatch] as string | null) ?? null);
    }
  }
  if (patch.images) { fields.push("images = ?"); args.push(JSON.stringify(patch.images)); }
  if (patch.accessories) { fields.push("accessories = ?"); args.push(JSON.stringify(patch.accessories)); }
  if (patch.paramAxes) { fields.push("param_axes = ?"); args.push(JSON.stringify(patch.paramAxes)); }
  if (patch.draft !== undefined) { fields.push("draft = ?"); args.push(patch.draft ? 1 : 0); }
  if (patch.discountPct !== undefined) { fields.push("discount_pct = ?"); args.push(patch.discountPct); }
  if (patch.manualSortOrder !== undefined) {
    fields.push("manual_sort_order = ?");
    args.push(patch.manualSortOrder);
  }
  if (!fields.length) return;
  fields.push("updated_at = ?");
  args.push(Date.now());
  args.push(id);
  d.prepare(`UPDATE products SET ${fields.join(", ")} WHERE id = ?`).run(...args);
  // Пересчёт price_from/price_to/stock
  recomputeProductAggregates(id);
}

export function recomputeProductAggregates(id: string) {
  const d = db();
  const v = d
    .prepare<unknown[], { stock: number; pmin: number | null; pmax: number | null }>(
      `SELECT
         COALESCE(SUM(CASE WHEN available = 1 AND quantity > 0 THEN quantity ELSE 0 END), 0) AS stock,
         COALESCE(
           MIN(CASE WHEN available = 1 AND quantity > 0 AND price > 0 THEN price END),
           MIN(CASE WHEN available = 1 AND price > 0 THEN price END)
         ) AS pmin,
         COALESCE(
           MAX(CASE WHEN available = 1 AND quantity > 0 AND price > 0 THEN price END),
           MAX(CASE WHEN available = 1 AND price > 0 THEN price END)
         ) AS pmax
       FROM variants WHERE product_id = ?`,
    )
    .get(id);
  if (v) {
    d.prepare("UPDATE products SET stock = ?, price_from = ?, price_to = ? WHERE id = ?")
      .run(v.stock, v.pmin, v.pmax, id);
  }
}

export type VariantPatch = Partial<{
  sku: string;
  name: string | null;
  barcode: string | null;
  price: number | null;
  oldPrice: number | null;
  quantity: number | null;
  available: boolean;
  params: { name: string; value: string; unit?: string }[];
  images: string[] | null;
}>;

export function updateVariant(id: string, patch: VariantPatch) {
  const d = db();
  const fields: string[] = [];
  const args: (string | number | null)[] = [];
  const map: Record<string, string> = {
    sku: "sku", name: "name", barcode: "barcode",
    price: "price", oldPrice: "old_price", quantity: "quantity",
  };
  for (const k of Object.keys(map) as (keyof typeof map)[]) {
    if (patch[k as keyof VariantPatch] !== undefined) {
      fields.push(`${map[k]} = ?`);
      args.push((patch[k as keyof VariantPatch] as string | number | null) ?? null);
    }
  }
  if (patch.available !== undefined) { fields.push("available = ?"); args.push(patch.available ? 1 : 0); }
  if (patch.params) { fields.push("params = ?"); args.push(JSON.stringify(patch.params)); }
  if (patch.images !== undefined) {
    fields.push("images = ?");
    args.push(patch.images ? JSON.stringify(patch.images) : null);
  }
  if (!fields.length) return;
  args.push(id);
  d.prepare(`UPDATE variants SET ${fields.join(", ")} WHERE id = ?`).run(...args);
  const row = d.prepare<unknown[], { product_id: string }>("SELECT product_id FROM variants WHERE id = ?").get(id);
  if (row) recomputeProductAggregates(row.product_id);
}

export function listBrands(): string[] {
  const d = db();
  const rows = d
    .prepare<unknown[], { brand: string }>("SELECT DISTINCT brand FROM products WHERE brand IS NOT NULL AND brand != '' ORDER BY brand")
    .all();
  return rows.map((r) => r.brand);
}
