import { db } from "./db";
import type { Category, CategoryIcon } from "./catalog";

export type AdminCategory = {
  slug: string;
  title: string;
  icon: string | null;
  sort_order: number;
  subtitle: string | null;
  cta_text: string | null;
  cover_image: string | null;
  meta_title: string | null;
  meta_description: string | null;
  image_alt: string | null;
  h1: string | null;
  intro: string | null;
  seo_text: string | null;
  published: number;
  product_count: number;
};

export function listAdminCategories(): AdminCategory[] {
  return db()
    .prepare<unknown[], AdminCategory>(
      `SELECT c.slug, c.title, c.icon, c.sort_order,
              c.subtitle, c.cta_text, c.cover_image,
              c.meta_title, c.meta_description, c.image_alt, c.h1, c.intro, c.seo_text, c.published,
              (SELECT COUNT(*) FROM products p WHERE p.category = c.slug) AS product_count
         FROM categories c
         ORDER BY c.sort_order ASC, c.title ASC`,
    )
    .all();
}

export function getAdminCategory(slug: string): AdminCategory | undefined {
  return db()
    .prepare<unknown[], AdminCategory>(
      `SELECT c.slug, c.title, c.icon, c.sort_order,
              c.subtitle, c.cta_text, c.cover_image,
              c.meta_title, c.meta_description, c.image_alt, c.h1, c.intro, c.seo_text, c.published,
              (SELECT COUNT(*) FROM products p WHERE p.category = c.slug) AS product_count
         FROM categories c WHERE c.slug = ?`,
    )
    .get(slug);
}

function rowToPublicCategory(row: AdminCategory): Category {
  return {
    slug: row.slug,
    title: row.title,
    icon: (row.icon || "fixture") as CategoryIcon,
    count: row.product_count,
    subtitle: row.subtitle ?? undefined,
    ctaText: row.cta_text ?? undefined,
    coverImage: row.cover_image ?? undefined,
    metaTitle: row.meta_title ?? undefined,
    metaDescription: row.meta_description ?? undefined,
    imageAlt: row.image_alt ?? undefined,
    h1: row.h1 ?? undefined,
    intro: row.intro ?? undefined,
    seoText: row.seo_text ?? undefined,
    published: !!row.published,
    sortOrder: row.sort_order,
  };
}

export function listPublicCategories(): Category[] {
  return listAdminCategories()
    .filter((row) => row.published === 1 && row.product_count > 0)
    .map(rowToPublicCategory);
}

export function getPublicCategory(slug: string): Category | undefined {
  const row = getAdminCategory(slug);
  if (!row || row.published !== 1 || row.product_count <= 0) return undefined;
  return rowToPublicCategory(row);
}

export type CategoryPatch = Partial<{
  title: string;
  icon: string | null;
  sort_order: number;
  subtitle: string | null;
  cta_text: string | null;
  cover_image: string | null;
  meta_title: string | null;
  meta_description: string | null;
  image_alt: string | null;
  h1: string | null;
  intro: string | null;
  seo_text: string | null;
  published: number;
}>;

export function updateCategory(slug: string, patch: CategoryPatch) {
  const map: Record<string, string> = {
    title: "title", icon: "icon", sort_order: "sort_order",
    subtitle: "subtitle", cta_text: "cta_text", cover_image: "cover_image",
    meta_title: "meta_title", meta_description: "meta_description",
    image_alt: "image_alt", h1: "h1", intro: "intro", seo_text: "seo_text", published: "published",
  };
  const fields: string[] = [];
  const args: (string | number | null)[] = [];
  for (const k of Object.keys(map) as (keyof CategoryPatch)[]) {
    const v = patch[k];
    if (v !== undefined) {
      fields.push(`${map[k as string]} = ?`);
      args.push(v as string | number | null);
    }
  }
  if (!fields.length) return;
  args.push(slug);
  db().prepare(`UPDATE categories SET ${fields.join(", ")} WHERE slug = ?`).run(...args);
}

export function renameCategorySlug(oldSlug: string, newSlug: string) {
  if (oldSlug === newSlug) return;
  const exists = db().prepare("SELECT 1 FROM categories WHERE slug = ?").get(newSlug);
  if (exists) throw new Error("SLUG_TAKEN");
  const tx = db().transaction(() => {
    db().prepare("INSERT INTO categories (slug, title, icon, sort_order, subtitle, cta_text, cover_image, meta_title, meta_description, image_alt, h1, intro, seo_text, published) SELECT ?, title, icon, sort_order, subtitle, cta_text, cover_image, meta_title, meta_description, image_alt, h1, intro, seo_text, published FROM categories WHERE slug = ?").run(newSlug, oldSlug);
    db().prepare("UPDATE products SET category = ? WHERE category = ?").run(newSlug, oldSlug);
    db().prepare("DELETE FROM categories WHERE slug = ?").run(oldSlug);
  });
  tx();
}

export function createCategory(c: {
  slug: string;
  title: string;
  icon?: string | null;
  subtitle?: string | null;
  cta_text?: string | null;
  cover_image?: string | null;
}) {
  const exists = db().prepare("SELECT 1 FROM categories WHERE slug = ?").get(c.slug);
  if (exists) throw new Error("SLUG_TAKEN");
  const sortOrder = (db()
    .prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM categories")
    .get() as { n: number }).n;
  db()
    .prepare(
      `INSERT INTO categories (slug, title, icon, sort_order, subtitle, cta_text, cover_image)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(c.slug, c.title, c.icon ?? null, sortOrder, c.subtitle ?? null, c.cta_text ?? null, c.cover_image ?? null);
}

export function deleteCategory(slug: string) {
  const has = (db()
    .prepare("SELECT COUNT(*) AS n FROM products WHERE category = ?")
    .get(slug) as { n: number }).n;
  if (has > 0) throw new Error("CATEGORY_NOT_EMPTY");
  db().prepare("DELETE FROM categories WHERE slug = ?").run(slug);
}
