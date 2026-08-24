import "server-only";
import fs from "node:fs";
import path from "node:path";
import { db } from "./db";

const JSON_PATH = path.join(process.cwd(), "src", "lib", "products.json");

/**
 * Дампит SQLite в products.json в текущем формате витрины.
 * Используется после правок в админке: фронт-компоненты читают этот файл (build-time
 * или import), поэтому держим snapshot в актуальном состоянии.
 */
export function exportDbToJson(): { categories: number; products: number } {
  const d = db();
  const cats = d
    .prepare<unknown[], {
      slug: string; title: string; icon: string | null; count: number;
      subtitle: string | null; cta_text: string | null; cover_image: string | null;
      meta_title: string | null; meta_description: string | null;
      image_alt: string | null; h1: string | null; intro: string | null;
      seo_text: string | null; published: number; sort_order: number;
    }>(
      `SELECT c.slug, c.title, c.icon,
              c.subtitle, c.cta_text, c.cover_image, c.meta_title, c.meta_description,
              c.image_alt, c.h1, c.intro, c.seo_text, c.published, c.sort_order,
              (SELECT COUNT(*) FROM products p WHERE p.category = c.slug AND p.draft = 0) AS count
         FROM categories c
         ORDER BY c.sort_order ASC, c.title ASC`,
    )
    .all()
    .filter((c) => c.count > 0)
    .map((c) => ({
      slug: c.slug,
      title: c.title,
      icon: c.icon,
      count: c.count,
      ...(c.subtitle ? { subtitle: c.subtitle } : {}),
      ...(c.cta_text ? { ctaText: c.cta_text } : {}),
      ...(c.cover_image ? { coverImage: c.cover_image } : {}),
      ...(c.meta_title ? { metaTitle: c.meta_title } : {}),
      ...(c.meta_description ? { metaDescription: c.meta_description } : {}),
      ...(c.image_alt ? { imageAlt: c.image_alt } : {}),
      ...(c.h1 ? { h1: c.h1 } : {}),
      ...(c.intro ? { intro: c.intro } : {}),
      ...(c.seo_text ? { seoText: c.seo_text } : {}),
      published: !!c.published,
      sortOrder: c.sort_order,
    }));

  type Row = {
    id: string; slug: string; title: string; brand: string | null; sku: string | null;
    category: string | null; icon: string | null; description: string | null;
    images: string; accessories: string; is_group: number; stock: number;
    param_axes: string; price_from: number | null; price_to: number | null;
    discount_pct: number | null; draft: number;
    meta_title: string | null; meta_description: string | null; seo_text: string | null;
    seo_fingerprint: string | null; seo_source: string | null; seo_generated_at: number | null;
    manual_sort_order: number | null; feed_category_id: string | null;
  };
  const prows = d
    .prepare<unknown[], Row>(
      `SELECT id, slug, title, brand, sku, category, icon, description, images, accessories,
              is_group, stock, param_axes, price_from, price_to, discount_pct, draft,
              meta_title, meta_description, seo_text, seo_fingerprint, seo_source, seo_generated_at,
              manual_sort_order, feed_category_id
         FROM products
         ORDER BY sort_order ASC, ROWID ASC`,
    )
    .all();
  const ids = prows.map((p) => p.id);
  const placeholders = ids.map(() => "?").join(",") || "''";
  type VRow = {
    id: string; product_id: string; sku: string | null; name: string | null;
    barcode: string | null; price: number | null; old_price: number | null;
    quantity: number | null; available: number; params: string; images: string | null;
    sort_order: number | null;
  };
  const vrows = ids.length
    ? d
        .prepare<unknown[], VRow>(
          `SELECT * FROM variants WHERE product_id IN (${placeholders}) ORDER BY sort_order ASC, ROWID ASC`,
        )
        .all(...ids)
    : [];
  const byProd = new Map<string, VRow[]>();
  for (const v of vrows) {
    const arr = byProd.get(v.product_id) ?? [];
    arr.push(v);
    byProd.set(v.product_id, arr);
  }

  const products = prows.map((p) => {
    const variants = (byProd.get(p.id) ?? []).map((v) => {
      const o: Record<string, unknown> = {
        id: v.id,
        sku: v.sku ?? "",
        params: JSON.parse(v.params || "[]"),
        available: !!v.available,
      };
      if (v.name) o.name = v.name;
      if (v.barcode) o.barcode = v.barcode;
      if (v.price != null) o.price = v.price;
      if (v.old_price != null) o.oldPrice = v.old_price;
      if (v.quantity != null) o.quantity = v.quantity;
      if (v.images) o.images = JSON.parse(v.images);
      return o;
    });
    const out: Record<string, unknown> = {
      id: p.id,
      slug: p.slug,
      title: p.title,
      brand: p.brand ?? "—",
      sku: p.sku ?? "",
      category: p.category ?? "",
      icon: p.icon ?? "fixture",
      description: p.description ?? "",
      images: JSON.parse(p.images || "[]"),
      accessories: JSON.parse(p.accessories || "[]"),
      isGroup: !!p.is_group,
      variants,
      stock: p.stock,
      paramAxes: JSON.parse(p.param_axes || "[]"),
    };
    if (p.price_from != null) out.priceFrom = p.price_from;
    if (p.price_to != null) out.priceTo = p.price_to;
    if (p.discount_pct != null) out.discountPct = p.discount_pct;
    if (p.meta_title) out.metaTitle = p.meta_title;
    if (p.meta_description) out.metaDescription = p.meta_description;
    if (p.seo_text) out.seoText = p.seo_text;
    if (p.seo_fingerprint) out.seoFingerprint = p.seo_fingerprint;
    if (p.seo_source) out.seoSource = p.seo_source;
    if (p.seo_generated_at != null) out.seoGeneratedAt = p.seo_generated_at;
    if (p.manual_sort_order != null) out.manualSortOrder = p.manual_sort_order;
    if (p.feed_category_id) out.feedCategoryId = p.feed_category_id;
    if (p.draft) out.draft = true;
    return out;
  });

  const subcategories = d.prepare<unknown[], {
    category_slug: string; slug: string; title: string; short_description: string | null;
    intro: string | null; seo_text: string | null; meta_title: string | null;
    meta_description: string | null; image: string | null; image_alt: string | null;
    published: number; min_products: number; match_mode: "all" | "any";
    rules_json: string; manual_product_ids: string; sort_order: number;
    form_enabled: number; form_position: "after_subcategories" | "after_products";
  }>("SELECT * FROM subcategories ORDER BY category_slug, sort_order, title").all().map((row) => ({
    categorySlug: row.category_slug,
    slug: row.slug,
    title: row.title,
    shortDescription: row.short_description ?? "",
    intro: row.intro ?? "",
    seoText: row.seo_text ?? "",
    metaTitle: row.meta_title ?? "",
    metaDescription: row.meta_description ?? "",
    image: row.image ?? undefined,
    imageAlt: row.image_alt ?? undefined,
    published: !!row.published,
    minProducts: row.min_products,
    match: row.match_mode,
    rules: JSON.parse(row.rules_json || "[]"),
    manualProductIds: JSON.parse(row.manual_product_ids || "[]"),
    sortOrder: row.sort_order,
    formEnabled: !!row.form_enabled,
    formPosition: row.form_position,
  }));

  fs.writeFileSync(
    JSON_PATH,
    JSON.stringify({ categories: cats, subcategories, products }, null, 0),
    "utf8",
  );
  return { categories: cats.length, products: products.length };
}
