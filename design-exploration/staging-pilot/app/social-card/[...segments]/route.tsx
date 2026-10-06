/* eslint-disable @next/next/no-img-element */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { SEO_SITE_ORIGIN } from "../../data/seoIndexing.mjs";
import { resolveSocialCardRoute, SOCIAL_CARD_HEIGHT, SOCIAL_CARD_WIDTH, versionedSocialCardPath } from "../../data/socialCards";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ segments: string[] }> };

const interFonts = Promise.all([
  readFont("Inter-Regular.ttf").then((data) => ({ name:"Inter", data, style:"normal" as const, weight:400 as const })),
  readFont("Inter-SemiBold.ttf").then((data) => ({ name:"Inter", data, style:"normal" as const, weight:600 as const })),
  readFont("Inter-Bold.ttf").then((data) => ({ name:"Inter", data, style:"normal" as const, weight:700 as const })),
  readFont("Inter-ExtraBold.ttf").then((data) => ({ name:"Inter", data, style:"normal" as const, weight:800 as const })),
  readFont("Inter-Black.ttf").then((data) => ({ name:"Inter", data, style:"normal" as const, weight:900 as const })),
]);

const imageDataCache = new Map<string, Promise<string>>();
const MAX_CACHED_SOURCE_IMAGES = 32;

export async function GET(_request: Request, { params }: RouteContext) {
  const { segments } = await params;
  const resolved = resolveSocialCardRoute(segments);
  if (!resolved) return new Response("Social card not found", { status:404, headers:{ "Cache-Control":"public, max-age=300" } });
  if (resolved.requestedRevision && !resolved.isCurrentVersion) {
    return new Response(null, {
      status:307,
      headers:{
        "Location":new URL(versionedSocialCardPath(resolved.kind, resolved.slugs, resolved.revision), SEO_SITE_ORIGIN).toString(),
        "Cache-Control":"public, max-age=300, s-maxage=300",
      },
    });
  }
  const card = resolved.content;
  const photo = await loadCachedImageDataUrl(card.image).catch(() => loadCachedImageDataUrl("/site/why-stock.webp")).catch(() => "");
  const logo = await loadCachedImageDataUrl("/brand/7tool-inverse.svg").catch(() => "");
  const fonts = await interFonts;
  const title = clampText(card.title, 92);
  const context = clampText(card.context, 78);

  return new ImageResponse(
    <div style={{ width:"100%", height:"100%", display:"flex", color:"#fff", background:"#07172d", fontFamily:"Inter" }}>
      <div style={{ width:"54%", height:"100%", display:"flex", flexDirection:"column", justifyContent:"space-between", padding:"64px 54px 54px 66px", background:"linear-gradient(135deg, #06152b 0%, #0a2444 100%)" }}>
        {logo
          ? <img src={logo} alt="7TOOL" width="246" height="64" style={{ width:"246px", height:"64px", objectFit:"contain", objectPosition:"left center" }} />
          : <div style={{ display:"flex", alignItems:"center", gap:"4px", fontSize:70, fontWeight:900, letterSpacing:"-4px" }}><span style={{ color:"#FF5A00" }}>7</span><span>TOOL</span></div>}
        <div style={{ display:"flex", flexDirection:"column", gap:"18px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"12px", color:"#ff8a4c", fontSize:22, fontWeight:700, letterSpacing:"1.4px", textTransform:"uppercase" }}>
            <span style={{ width:"46px", height:"5px", background:"#FF5A00" }} />{card.eyebrow}
          </div>
          <div style={{ display:"flex", fontSize:title.length > 64 ? 43 : 50, lineHeight:1.06, fontWeight:800, letterSpacing:"-1.8px" }}>{title}</div>
          <div style={{ display:"flex", color:"#bdc9d8", fontSize:22, lineHeight:1.3 }}>{context}</div>
        </div>
        <div style={{ display:"flex", color:"#fff", fontSize:18, fontWeight:600 }}>
          Цены с НДС <span style={{ color:"#FF5A00", margin:"0 10px" }}>•</span> Инженерный подбор <span style={{ color:"#FF5A00", margin:"0 10px" }}>•</span> Доставка по России
        </div>
      </div>
      <div style={{ position:"relative", width:"46%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", background:"#f4f6f2" }}>
        <div style={{ position:"absolute", left:0, top:0, width:"10px", height:"100%", background:"#FF5A00" }} />
        {photo
          ? <img src={photo} alt={card.imageAlt} width="552" height="630" style={{ width:"100%", height:"100%", objectFit:"contain", objectPosition:"center", padding:"28px 24px 28px 34px" }} />
          : <div style={{ display:"flex", color:"#0a2444", fontSize:42, fontWeight:800 }}>7TOOL</div>}
        <div style={{ position:"absolute", right:"24px", bottom:"20px", display:"flex", padding:"8px 13px", borderRadius:"999px", color:"#0a2444", background:"rgba(255,255,255,.92)", fontSize:18, fontWeight:700 }}>7tool.ru</div>
      </div>
    </div>,
    {
      width:SOCIAL_CARD_WIDTH,
      height:SOCIAL_CARD_HEIGHT,
      fonts,
      headers:{
        "Cache-Control":resolved.isCurrentVersion
          ? "public, max-age=31536000, s-maxage=31536000, immutable"
          : "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
        "Content-Disposition":"inline",
        "X-Content-Type-Options":"nosniff",
      },
    },
  );
}

function loadCachedImageDataUrl(source?: string): Promise<string> {
  const cacheKey = source ?? "";
  const cached = imageDataCache.get(cacheKey);
  if (cached) {
    imageDataCache.delete(cacheKey);
    imageDataCache.set(cacheKey, cached);
    return cached;
  }
  const loading = (cacheKey.endsWith(".svg") ? loadLocalSvgDataUrl(cacheKey) : loadImageDataUrl(cacheKey))
    .catch((error) => {
      imageDataCache.delete(cacheKey);
      throw error;
    });
  imageDataCache.set(cacheKey, loading);
  while (imageDataCache.size > MAX_CACHED_SOURCE_IMAGES) imageDataCache.delete(imageDataCache.keys().next().value!);
  return loading;
}

async function loadImageDataUrl(source?: string): Promise<string> {
  if (!source) throw new Error("Social card image is missing.");
  if (source.startsWith("/")) {
    const relative = source.replace(/^\/+/, "");
    if (!relative || relative.split("/").includes("..") || !/^[A-Za-z0-9_./-]+$/u.test(relative)) throw new Error("Invalid local social image path.");
    const file = await readFile(path.join(process.cwd(), "public", ...relative.split("/")));
    if (file.byteLength > 5_000_000) throw new Error("Local social image is too large.");
    return `data:${mimeType(relative)};base64,${file.toString("base64")}`;
  }
  const url = new URL(source);
  if (url.protocol !== "https:" || url.hostname !== "s3.export.k2tool.ru" || !url.pathname.startsWith("/pim/images/product/preview/")) throw new Error("External social image host is not allowed.");
  const response = await fetch(url, { signal:AbortSignal.timeout(5_000), headers:{ "User-Agent":"7TOOL social card renderer" } });
  if (!response.ok) throw new Error(`Social image returned HTTP ${response.status}.`);
  const contentType = String(response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) throw new Error("Unsupported social image type.");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength > 5_000_000) throw new Error("External social image is too large.");
  return `data:${contentType};base64,${bytes.toString("base64")}`;
}

async function loadLocalSvgDataUrl(source: string): Promise<string> {
  const relative = source.replace(/^\/+/, "");
  if (!relative || relative.split("/").includes("..") || !/^[A-Za-z0-9_./-]+\.svg$/u.test(relative)) throw new Error("Invalid local SVG path.");
  const file = await readFile(path.join(process.cwd(), "public", ...relative.split("/")));
  if (file.byteLength > 250_000) throw new Error("Local SVG is too large.");
  return `data:image/svg+xml;base64,${file.toString("base64")}`;
}

function mimeType(file: string): string {
  if (/\.png$/iu.test(file)) return "image/png";
  if (/\.jpe?g$/iu.test(file)) return "image/jpeg";
  if (/\.webp$/iu.test(file)) return "image/webp";
  throw new Error("Unsupported local social image type.");
}

function clampText(value: string, limit: number): string {
  const clean = String(value || "").replace(/\s+/gu, " ").trim();
  if (clean.length <= limit) return clean;
  const clipped = clean.slice(0, limit - 1);
  return `${clipped.replace(/\s+\S*$/u, "").trim()}…`;
}

async function readFont(fileName: string): Promise<ArrayBuffer> {
  const bytes = await readFile(path.join(process.cwd(), "assets", "fonts", fileName));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
