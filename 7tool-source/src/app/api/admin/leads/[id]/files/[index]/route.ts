import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import type { LeadUploadedFile } from "@/lib/leads";
import { resolvePrivateLeadFile } from "@/lib/specification-storage";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".csv": "text/csv; charset=utf-8",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; index: string }> }) {
  await requireAdmin();
  const { id, index } = await params;
  const leadId = Number(id);
  const fileIndex = Number(index);
  if (!Number.isInteger(leadId) || !Number.isInteger(fileIndex) || fileIndex < 0) return new NextResponse("Not found", { status: 404 });
  const row = db().prepare("SELECT uploaded_files FROM leads WHERE id = ?").get(leadId) as { uploaded_files: string | null } | undefined;
  if (!row?.uploaded_files) return new NextResponse("Not found", { status: 404 });
  let files: LeadUploadedFile[] = [];
  try { files = JSON.parse(row.uploaded_files) as LeadUploadedFile[]; } catch { return new NextResponse("Not found", { status: 404 }); }
  const file = files[fileIndex];
  const resolved = file?.path ? resolvePrivateLeadFile(file.path) : null;
  if (!file || !resolved) return new NextResponse("Not found", { status: 404 });
  try {
    const bytes = await readFile(resolved);
    const ext = path.extname(file.originalName || resolved).toLowerCase();
    return new NextResponse(bytes, {
      headers: {
        "content-type": MIME[ext] || "application/octet-stream",
        "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.originalName || path.basename(resolved))}`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
