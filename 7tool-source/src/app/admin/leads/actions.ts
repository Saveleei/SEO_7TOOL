"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { retryLeadNotifications as retryNotifications } from "@/lib/leads";
import { queueOfflineConversion } from "@/lib/offline-conversions";

const STATUSES = new Set(["new", "contacted", "qualified", "won", "lost", "spam", "duplicate", "test"]);

export async function updateLeadStatus(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const status = String(formData.get("status") || "");
  const revenueRaw = String(formData.get("revenue") || "").replace(/\s/g, "");
  const revenue = revenueRaw ? Math.max(0, Math.round(Number(revenueRaw))) : null;
  if (!Number.isInteger(id) || id <= 0 || !STATUSES.has(status) || (revenue != null && !Number.isFinite(revenue))) return;
  const now = Date.now();
  db().transaction(() => {
    db().prepare(`UPDATE leads SET status = ?, revenue = ?,
      qualified_at = CASE WHEN ? = 'qualified' AND qualified_at IS NULL THEN ? ELSE qualified_at END,
      won_at = CASE WHEN ? = 'won' AND won_at IS NULL THEN ? ELSE won_at END
      WHERE id = ?`).run(status, revenue, status, now, status, now, id);
    if (status === "qualified") queueOfflineConversion(id, "lead_qualified", now, null);
    if (status === "won") queueOfflineConversion(id, "lead_won", now, revenue);
  })();
  revalidatePath("/admin/leads");
}

export async function retryLeadNotifications(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;
  await retryNotifications(id);
  revalidatePath("/admin/leads");
}
