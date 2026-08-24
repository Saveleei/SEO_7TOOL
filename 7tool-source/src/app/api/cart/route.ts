import { NextResponse, type NextRequest } from "next/server";
import { variantById } from "@/lib/data";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const ids = Array.from(new Set(
    (request.nextUrl.searchParams.get("ids") || "").split(",").map((id) => id.trim()).filter(Boolean),
  )).slice(0, 80);
  const items = ids.flatMap((id) => {
    const ref = variantById(id);
    if (!ref) return [];
    const { product, variant } = ref;
    const paramSummary = product.paramAxes
      .map((axis) => variant.params.find((param) => param.name === axis))
      .filter(Boolean)
      .map((param) => `${param!.name}: ${param!.value}${param!.unit ? ` ${param!.unit}` : ""}`)
      .join(" · ");
    return [{
      productSlug: product.slug,
      title: product.title,
      brand: product.brand,
      category: product.category,
      sku: variant.sku || product.sku,
      icon: product.icon,
      images: variant.images ?? product.images,
      variantId: variant.id,
      price: variant.price,
      available: variant.available,
      paramSummary,
    }];
  });
  return NextResponse.json({ items }, { headers: { "cache-control": "private, max-age=60" } });
}
