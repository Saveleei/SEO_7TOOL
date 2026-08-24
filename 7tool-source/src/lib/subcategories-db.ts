import "server-only";
import { db } from "./db";
import type { SubcategoryDefinition, SubcategoryRule } from "./subcategories";

export type AdminSubcategory = {
  id: number;
  category_slug: string;
  slug: string;
  title: string;
  short_description: string | null;
  intro: string | null;
  seo_text: string | null;
  meta_title: string | null;
  meta_description: string | null;
  image: string | null;
  image_alt: string | null;
  published: number;
  min_products: number;
  match_mode: "all" | "any";
  rules_json: string;
  manual_product_ids: string;
  sort_order: number;
  form_enabled: number;
  form_position: "after_subcategories" | "after_products";
};

export function ensureDefaultSubcategories(definitions: SubcategoryDefinition[]) {
  const statement = db().prepare(`
    INSERT OR IGNORE INTO subcategories (
      category_slug, slug, title, short_description, intro, seo_text,
      meta_title, meta_description, image, image_alt, published, min_products,
      match_mode, rules_json, manual_product_ids, sort_order, form_enabled, form_position
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const transaction = db().transaction(() => {
    definitions.forEach((item, index) => statement.run(
      item.categorySlug, item.slug, item.title, item.shortDescription, item.intro, item.seoText,
      item.metaTitle, item.metaDescription, item.image ?? null, item.imageAlt ?? null,
      item.published ? 1 : 0, item.minProducts, item.match, JSON.stringify(item.rules),
      JSON.stringify(item.manualProductIds ?? []), item.sortOrder ?? index,
      item.formEnabled === false ? 0 : 1, item.formPosition ?? "after_products",
    ));
  });
  transaction();
}

export function listAdminSubcategories(): AdminSubcategory[] {
  return db().prepare<unknown[], AdminSubcategory>(
    "SELECT * FROM subcategories ORDER BY category_slug, sort_order, title",
  ).all();
}

export function getAdminSubcategory(id: number): AdminSubcategory | undefined {
  return db().prepare<unknown[], AdminSubcategory>("SELECT * FROM subcategories WHERE id = ?").get(id);
}

export function saveAdminSubcategory(id: number | null, input: Omit<AdminSubcategory, "id">): number {
  JSON.parse(input.rules_json) as SubcategoryRule[];
  JSON.parse(input.manual_product_ids) as string[];
  if (id == null) {
    return Number(db().prepare(`
      INSERT INTO subcategories (
        category_slug, slug, title, short_description, intro, seo_text, meta_title,
        meta_description, image, image_alt, published, min_products, match_mode,
        rules_json, manual_product_ids, sort_order, form_enabled, form_position
      ) VALUES (@category_slug, @slug, @title, @short_description, @intro, @seo_text, @meta_title,
        @meta_description, @image, @image_alt, @published, @min_products, @match_mode,
        @rules_json, @manual_product_ids, @sort_order, @form_enabled, @form_position)
    `).run(input).lastInsertRowid);
  }
  db().prepare(`
    UPDATE subcategories SET
      category_slug=@category_slug, slug=@slug, title=@title,
      short_description=@short_description, intro=@intro, seo_text=@seo_text,
      meta_title=@meta_title, meta_description=@meta_description, image=@image,
      image_alt=@image_alt, published=@published, min_products=@min_products,
      match_mode=@match_mode, rules_json=@rules_json, manual_product_ids=@manual_product_ids,
      sort_order=@sort_order, form_enabled=@form_enabled, form_position=@form_position
    WHERE id=@id
  `).run({ ...input, id });
  return id;
}

export function deleteAdminSubcategory(id: number) {
  db().prepare("DELETE FROM subcategories WHERE id = ?").run(id);
}
