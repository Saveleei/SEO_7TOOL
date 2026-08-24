"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import {
  createCategory, updateCategory, renameCategorySlug, deleteCategory,
  type CategoryPatch,
} from "@/lib/categories-db";
import { exportDbToJson } from "@/lib/db-export";
import { storeImage } from "@/lib/upload-storage";
import { db } from "@/lib/db";
const TR: Record<string, string> = {"а":"a","б":"b","в":"v","г":"g","д":"d","е":"e","ё":"yo","ж":"zh","з":"z","и":"i","й":"y","к":"k","л":"l","м":"m","н":"n","о":"o","п":"p","р":"r","с":"s","т":"t","у":"u","ф":"f","х":"h","ц":"ts","ч":"ch","ш":"sh","щ":"sch","ъ":"","ы":"y","ь":"","э":"e","ю":"yu","я":"ya"};
function slugify(s: string) {
  return (s || "")
    .trim()
    .toLowerCase()
    .split("")
    .map((c) => TR[c] ?? c)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    || "x";
}

function bumpAll() {
  exportDbToJson();
  revalidatePath("/");
}

export async function createCategoryAction(formData: FormData) {
  await requireAdmin();
  const title = String(formData.get("title") ?? "").trim();
  const rawSlug = String(formData.get("slug") ?? "").trim();
  const slug = slugify(rawSlug || title);
  if (!title) redirect("/admin/categories/new?err=Заголовок обязателен");
  try {
    createCategory({
      slug,
      title,
      icon: String(formData.get("icon") ?? "fixture"),
      subtitle: String(formData.get("subtitle") ?? "") || null,
      cta_text: String(formData.get("cta_text") ?? "") || null,
      cover_image: String(formData.get("cover_image") ?? "") || null,
    });
  } catch (e) {
    const msg = e instanceof Error && e.message === "SLUG_TAKEN" ? "Такой slug уже занят" : "Не удалось создать";
    redirect(`/admin/categories/new?err=${encodeURIComponent(msg)}`);
  }
  bumpAll();
  redirect(`/admin/categories/${slug}`);
}

export async function saveCategoryAction(slug: string, formData: FormData) {
  await requireAdmin();
  const newSlugRaw = String(formData.get("slug") ?? "").trim();
  const newSlug = slugify(newSlugRaw || slug);
  if (newSlug !== slug) {
    try { renameCategorySlug(slug, newSlug); }
    catch (e) {
      const msg = e instanceof Error && e.message === "SLUG_TAKEN" ? "Такой slug уже занят" : "Ошибка переименования";
      redirect(`/admin/categories/${slug}?err=${encodeURIComponent(msg)}`);
    }
  }
  const sortRaw = String(formData.get("sort_order") ?? "");
  const sort = sortRaw ? Number(sortRaw) : null;
  const patch: CategoryPatch = {
    title: String(formData.get("title") ?? "").trim(),
    icon: String(formData.get("icon") ?? "") || null,
    subtitle: String(formData.get("subtitle") ?? "") || null,
    cta_text: String(formData.get("cta_text") ?? "") || null,
    cover_image: String(formData.get("cover_image") ?? "") || null,
    meta_title: String(formData.get("meta_title") ?? "") || null,
    meta_description: String(formData.get("meta_description") ?? "") || null,
    image_alt: String(formData.get("image_alt") ?? "") || null,
    h1: String(formData.get("h1") ?? "") || null,
    intro: String(formData.get("intro") ?? "") || null,
    seo_text: String(formData.get("seo_text") ?? "") || null,
    published: formData.get("published") === "1" ? 1 : 0,
  };
  if (sort !== null && Number.isFinite(sort)) patch.sort_order = sort;
  updateCategory(newSlug, patch);
  bumpAll();
  revalidatePath(`/c/${newSlug}`);
  redirect(`/admin/categories/${newSlug}?ok=1`);
}

export async function deleteCategoryAction(slug: string) {
  await requireAdmin();
  try { deleteCategory(slug); }
  catch (e) {
    if (e instanceof Error && e.message === "CATEGORY_NOT_EMPTY") {
      redirect(`/admin/categories/${slug}?err=${encodeURIComponent("В категории есть товары — переместите/удалите их сначала")}`);
    }
    throw e;
  }
  bumpAll();
  redirect("/admin/categories");
}

export async function uploadCategoryCover(formData: FormData): Promise<{ url: string }> {
  await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("FILE_REQUIRED");
  return { url: await storeImage(file, "categories", { width: 1600, height: 1200, quality: 82 }) };
}

export type CategoryProductPhoto = {
  productId: string;
  productTitle: string;
  url: string;
};

export async function searchCategoryProductPhotos(
  categorySlug: string,
  query: string,
): Promise<CategoryProductPhoto[]> {
  await requireAdmin();
  const normalized = query.trim();
  const where = normalized
    ? "category = ? AND draft = 0 AND images != '[]' AND (title LIKE ? OR sku LIKE ? OR brand LIKE ?)"
    : "category = ? AND draft = 0 AND images != '[]'";
  const args = normalized
    ? [categorySlug, `%${normalized}%`, `%${normalized}%`, `%${normalized}%`]
    : [categorySlug];
  const rows = db()
    .prepare<unknown[], { id: string; title: string; images: string }>(
      `SELECT id, title, images FROM products
        WHERE ${where}
        ORDER BY (manual_sort_order IS NULL) ASC, manual_sort_order ASC,
                 (stock > 0) DESC, title ASC
        LIMIT 50`,
    )
    .all(...args);

  const photos: CategoryProductPhoto[] = [];
  for (const row of rows) {
    let images: string[] = [];
    try { images = JSON.parse(row.images || "[]") as string[]; } catch {}
    for (const url of images.slice(0, 4)) {
      if (typeof url !== "string" || !url) continue;
      photos.push({ productId: row.id, productTitle: row.title, url });
      if (photos.length >= 100) return photos;
    }
  }
  return photos;
}
