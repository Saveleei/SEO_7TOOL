import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { offlineCsvSnapshot, uploadPendingOfflineConversions } from "@/lib/offline-conversions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function isAdmin() {
  const session = await getCurrentSession();
  return session?.user.role === "admin";
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  const { csv } = offlineCsvSnapshot();
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="7tool-offline-conversions.csv"`,
      "cache-control": "no-store",
    },
  });
}

export async function POST() {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  const result = await uploadPendingOfflineConversions();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
