import { NextResponse, type NextRequest } from "next/server";
import { productById } from "@/lib/data";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const ids = Array.from(new Set(
    (request.nextUrl.searchParams.get("ids") || "").split(",").map((id) => id.trim()).filter(Boolean),
  )).slice(0, 80);
  const items = ids.map(productById).filter(Boolean);
  return NextResponse.json({ items }, { headers: { "cache-control": "private, max-age=60" } });
}
