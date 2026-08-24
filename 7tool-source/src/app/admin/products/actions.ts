"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { exportDbToJson } from "@/lib/db-export";
import { updateProduct } from "@/lib/products-db";

export async function saveProductSortOrderAction(
  id: string,
  category: string | null,
  formData: FormData,
) {
  await requireAdmin();
  const raw = String(formData.get("manualSortOrder") ?? "").trim();
  const parsed = raw === "" ? null : Number(raw);
  updateProduct(id, {
    manualSortOrder: parsed !== null && Number.isFinite(parsed) ? Math.trunc(parsed) : null,
  });
  exportDbToJson();
  revalidatePath("/");
  if (category) revalidatePath(`/c/${category}`);
}
