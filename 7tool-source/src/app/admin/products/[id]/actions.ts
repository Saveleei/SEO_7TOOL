"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import {
  updateProduct, updateVariant, getProductById,
  type ProductPatch, type VariantPatch,
} from "@/lib/products-db";
import { exportDbToJson } from "@/lib/db-export";
import { storeImage } from "@/lib/upload-storage";

function revalidateProduct(slug: string, category?: string) {
  revalidatePath("/");
  revalidatePath(`/p/${slug}`);
  if (category) revalidatePath(`/c/${category}`);
}

export async function saveProductInfo(id: string, formData: FormData) {
  await requireAdmin();
  const current = getProductById(id);
  const metaTitle = String(formData.get("metaTitle") ?? "");
  const metaDescription = String(formData.get("metaDescription") ?? "");
  const seoText = String(formData.get("seoText") ?? "");
  const manualSeoChanged = !!current
    && (metaTitle !== (current.metaTitle ?? "") || metaDescription !== (current.metaDescription ?? "") || seoText !== (current.seoText ?? ""));
  const patch: ProductPatch = {
    title: String(formData.get("title") ?? "").trim(),
    slug: String(formData.get("slug") ?? "").trim(),
    brand: String(formData.get("brand") ?? "").trim(),
    sku: String(formData.get("sku") ?? "").trim(),
    category: String(formData.get("category") ?? "").trim(),
    description: String(formData.get("description") ?? ""),
    metaTitle,
    metaDescription,
    seoText,
    draft: formData.get("draft") === "1",
    manualSortOrder: (() => {
      const raw = String(formData.get("manualSortOrder") ?? "").trim();
      if (!raw) return null;
      const value = Number(raw);
      return Number.isFinite(value) ? Math.trunc(value) : null;
    })(),
  };
  if (manualSeoChanged) {
    patch.seoSource = "manual";
    patch.seoFingerprint = null;
    patch.seoGeneratedAt = null;
  }
  updateProduct(id, patch);
  const p = getProductById(id);
  if (p) { exportDbToJson(); revalidateProduct(p.slug, p.category); }
}

export async function saveImages(id: string, formData: FormData) {
  await requireAdmin();
  const raw = String(formData.get("images") ?? "[]");
  let images: string[] = [];
  try { images = JSON.parse(raw); } catch {}
  updateProduct(id, { images });
  const p = getProductById(id);
  if (p) { exportDbToJson(); revalidateProduct(p.slug, p.category); }
}

export async function uploadImage(formData: FormData): Promise<{ url: string }> {
  await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("FILE_REQUIRED");
  return { url: await storeImage(file, "products", { width: 1600, height: 1600, quality: 80 }) };
}

export async function saveVariant(variantId: string, formData: FormData) {
  await requireAdmin();
  const patch: VariantPatch = {};
  const sku = formData.get("sku");
  const name = formData.get("name");
  const barcode = formData.get("barcode");
  if (sku !== null) patch.sku = String(sku).trim();
  if (name !== null) patch.name = String(name).trim() || null;
  if (barcode !== null) patch.barcode = String(barcode).trim() || null;
  const num = (k: string): number | null => {
    const v = formData.get(k);
    if (v === null) return null;
    const s = String(v).trim();
    if (!s) return null;
    const n = Number(s.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) ? Math.round(n) : null;
  };
  patch.price = num("price");
  patch.oldPrice = num("oldPrice");
  patch.quantity = num("quantity");
  patch.available = formData.get("available") === "1";
  updateVariant(variantId, patch);

  // revalidate
  const product = getProductById(String(formData.get("productId") ?? ""));
  if (product) { exportDbToJson(); revalidateProduct(product.slug, product.category); }
}

export async function saveProductAndExit(id: string, formData: FormData) {
  await saveProductInfo(id, formData);
  redirect(`/admin/products/${id}`);
}
