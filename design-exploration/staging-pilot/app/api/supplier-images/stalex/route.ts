import { getStalexImageUpstreamUrl } from "../../../data/supplierImageProxy.mjs";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export const runtime = "nodejs";

export async function GET(request: Request) {
  const path = new URL(request.url).searchParams.get("path");
  const upstreamUrl = getStalexImageUpstreamUrl(path);
  if (!upstreamUrl) return new Response("Invalid image path", { status:400 });

  try {
    const upstream = await fetch(upstreamUrl, {
      headers:{ accept:"image/avif,image/webp,image/png,image/jpeg,*/*;q=0.5", "user-agent":"7TOOL-Test-Image-Proxy/1.0" },
      signal:AbortSignal.timeout(15_000),
    });
    if (!upstream.ok) return new Response("Supplier image is unavailable", { status:502 });

    const contentType = upstream.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() || "";
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) return new Response("Unsupported supplier image", { status:502 });
    const declaredLength = Number(upstream.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES) {
      return new Response("Supplier image is too large", { status:502 });
    }

    const image = await upstream.arrayBuffer();
    if (image.byteLength === 0 || image.byteLength > MAX_IMAGE_BYTES) {
      return new Response("Supplier image is invalid", { status:502 });
    }
    return new Response(image, {
      status:200,
      headers:{
        "cache-control":"public, max-age=86400, stale-while-revalidate=604800",
        "content-length":String(image.byteLength),
        "content-type":contentType,
        "x-content-type-options":"nosniff",
      },
    });
  } catch {
    return new Response("Supplier image is unavailable", { status:502 });
  }
}
