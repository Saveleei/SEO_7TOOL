"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { deleteAdminSubcategory, saveAdminSubcategory, type AdminSubcategory } from "@/lib/subcategories-db";
import { exportDbToJson } from "@/lib/db-export";

function string(formData: FormData, key: string, fallback = "") {
  return String(formData.get(key) ?? fallback).trim();
}

export async function saveSubcategoryAction(id: number | null, formData: FormData) {
  await requireAdmin();
  const input: Omit<AdminSubcategory, "id"> = {
    category_slug: string(formData, "category_slug"),
    slug: string(formData, "slug").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, ""),
    title: string(formData, "title"),
    short_description: string(formData, "short_description") || null,
    intro: string(formData, "intro") || null,
    seo_text: string(formData, "seo_text") || null,
    meta_title: string(formData, "meta_title") || null,
    meta_description: string(formData, "meta_description") || null,
    image: string(formData, "image") || null,
    image_alt: string(formData, "image_alt") || null,
    published: formData.get("published") === "1" ? 1 : 0,
    min_products: Math.max(1, Number(string(formData, "min_products", "2")) || 2),
    match_mode: string(formData, "match_mode") === "all" ? "all" : "any",
    rules_json: string(formData, "rules_json", "[]"),
    manual_product_ids: JSON.stringify(string(formData, "manual_product_ids").split(/[\s,;]+/).filter(Boolean)),
    sort_order: Number(string(formData, "sort_order", "0")) || 0,
    form_enabled: formData.get("form_enabled") === "1" ? 1 : 0,
    form_position: string(formData, "form_position") === "after_subcategories" ? "after_subcategories" : "after_products",
  };
  try {
    const savedId = saveAdminSubcategory(id, input);
    exportDbToJson();
    revalidatePath(`/c/${input.category_slug}`);
    redirect(`/admin/subcategories/${savedId}?ok=1`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка сохранения";
    redirect(`/admin/subcategories/${id ?? "new"}?err=${encodeURIComponent(message)}`);
  }
}

export async function deleteSubcategoryAction(id: number) {
  await requireAdmin();
  deleteAdminSubcategory(id);
  exportDbToJson();
  redirect("/admin/subcategories");
}
