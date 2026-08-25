import dns from "node:dns/promises";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";

const DEFAULT_MAX_BYTES = 25 * 1024 * 1024;
const DEFAULT_MAX_PIXELS = 60_000_000;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function privateIpv4(address) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return true;
  return parts[0] === 10
    || parts[0] === 127
    || parts[0] === 0
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168)
    || (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127)
    || parts[0] >= 224;
}

function privateIp(address) {
  const version = net.isIP(address);
  if (version === 4) return privateIpv4(address);
  if (version === 6) {
    const normalized = address.toLocaleLowerCase("en-US");
    return normalized === "::1" || normalized === "::" || normalized.startsWith("fc")
      || normalized.startsWith("fd") || /^fe[89ab]/.test(normalized) || normalized.startsWith("::ffff:");
  }
  return true;
}

export async function validateRemoteImageUrl(value, allowedHosts = []) {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("IMAGE_URL_HTTPS_REQUIRED");
  if (url.username || url.password || url.port) throw new Error("IMAGE_URL_AUTH_OR_PORT_FORBIDDEN");
  const hosts = new Set(allowedHosts.map((host) => String(host).toLocaleLowerCase("en-US")));
  if (!hosts.size || !hosts.has(url.hostname.toLocaleLowerCase("en-US"))) throw new Error("IMAGE_HOST_NOT_ALLOWLISTED");
  const addresses = await dns.lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => privateIp(address))) throw new Error("IMAGE_HOST_RESOLVES_TO_PRIVATE_IP");
  return url;
}

async function readLimitedBody(response, maxBytes) {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new Error("IMAGE_TOO_LARGE");
  if (!response.body) throw new Error("IMAGE_BODY_MISSING");
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new Error("IMAGE_TOO_LARGE");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

export async function downloadRemoteImage(value, options = {}) {
  const maxBytes = Number(options.maxBytes ?? DEFAULT_MAX_BYTES);
  const url = await validateRemoteImageUrl(value, options.allowedHosts ?? []);
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(Number(options.timeoutMs ?? 15_000)),
    headers: { "user-agent": "7TOOL-Avito-ImagePipeline/1.0" },
  });
  if (!response.ok) throw new Error(`IMAGE_HTTP_${response.status}`);
  const mime = String(response.headers.get("content-type") ?? "").split(";", 1)[0].trim().toLocaleLowerCase("en-US");
  if (!ALLOWED_MIME.has(mime)) throw new Error(`IMAGE_MIME_UNSUPPORTED:${mime || "unknown"}`);
  return readLimitedBody(response, maxBytes);
}

async function averageHash(buffer) {
  const pixels = await sharp(buffer, { limitInputPixels: DEFAULT_MAX_PIXELS, failOn: "error" })
    .rotate().greyscale().resize(8, 8, { fit: "fill" }).raw().toBuffer();
  const average = pixels.reduce((sum, value) => sum + value, 0) / pixels.length;
  let bits = "";
  for (const value of pixels) bits += value >= average ? "1" : "0";
  return BigInt(`0b${bits}`).toString(16).padStart(16, "0");
}

function perceptualDistance(left, right) {
  if (!/^[a-f0-9]{16}$/i.test(left) || !/^[a-f0-9]{16}$/i.test(right)) return Number.POSITIVE_INFINITY;
  let value = BigInt(`0x${left}`) ^ BigInt(`0x${right}`);
  let distance = 0;
  while (value) { distance += Number(value & 1n); value >>= 1n; }
  return distance;
}

export function deduplicateByPerceptualHash(items, maxDistance = 2) {
  const kept = [];
  const rejected = [];
  for (const item of items) {
    const duplicate = kept.find((candidate) => perceptualDistance(candidate.perceptualHash, item.perceptualHash) <= maxDistance);
    if (duplicate) rejected.push({ ...item, duplicateOf: duplicate.id ?? duplicate.sha256, reason: "perceptual_duplicate" });
    else kept.push(item);
  }
  return { kept, rejected };
}

export async function inspectImage(buffer, options = {}) {
  const maxBytes = Number(options.maxBytes ?? DEFAULT_MAX_BYTES);
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > maxBytes) throw new Error("IMAGE_BUFFER_INVALID");
  const image = sharp(buffer, { limitInputPixels: Number(options.maxPixels ?? DEFAULT_MAX_PIXELS), failOn: "error" }).rotate();
  const metadata = await image.metadata();
  const mime = metadata.format === "jpeg" ? "image/jpeg" : `image/${metadata.format}`;
  if (!metadata.width || !metadata.height || !ALLOWED_MIME.has(mime)) throw new Error("IMAGE_FORMAT_UNSUPPORTED");
  if ((metadata.pages ?? 1) !== 1) throw new Error("IMAGE_ANIMATION_UNSUPPORTED");
  const stats = await image.clone().greyscale().resize({ width: 900, withoutEnlargement: true }).stats();
  const minWidth = Number(options.minWidth ?? 800);
  const minHeight = Number(options.minHeight ?? 600);
  const minSharpness = Number(options.minSharpness ?? 1.2);
  const issues = [];
  if (metadata.width < minWidth || metadata.height < minHeight) issues.push("low_resolution");
  if (Number.isFinite(stats.sharpness) && stats.sharpness < minSharpness) issues.push("likely_blurry");
  if (Number.isFinite(stats.entropy) && stats.entropy < 1.5) issues.push("low_detail");
  return {
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
    mime,
    bytes: buffer.length,
    sha256: sha256(buffer),
    perceptualHash: await averageHash(buffer),
    sharpness: stats.sharpness ?? null,
    entropy: stats.entropy ?? null,
    issues,
    requiresReview: issues.length > 0,
  };
}

function safeOutputPath(root, relative) {
  const resolvedRoot = path.resolve(root);
  const target = path.resolve(resolvedRoot, relative);
  if (!target.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error("IMAGE_OUTPUT_PATH_ESCAPE");
  return target;
}

export async function enhanceImageLocally(buffer, outputRoot, key, options = {}) {
  const inspected = await inspectImage(buffer, options);
  const allowUpscale = options.allowUpscale === true;
  const targetWidth = Math.max(1, Number(options.targetWidth ?? 1_600));
  const width = allowUpscale ? targetWidth : Math.min(inspected.width, targetWidth);
  const output = await sharp(buffer, { limitInputPixels: DEFAULT_MAX_PIXELS, failOn: "error" })
    .rotate()
    .resize({ width, withoutEnlargement: !allowUpscale, fit: "inside" })
    .normalize({ lower: 1, upper: 99 })
    .sharpen({ sigma: 0.7, m1: 0.5, m2: 1.5 })
    .webp({ quality: 88, effort: 5 })
    .toBuffer();
  const fileName = `${String(key).replace(/[^a-z0-9_.-]/gi, "-")}-${sha256(output).slice(0, 12)}.webp`;
  const outputPath = safeOutputPath(outputRoot, fileName);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, output, { flag: "wx" }).catch(async (error) => {
    if (error?.code !== "EEXIST") throw error;
    const existing = await fs.readFile(outputPath);
    if (sha256(existing) !== sha256(output)) throw new Error("IMAGE_OUTPUT_COLLISION");
  });
  return {
    source: inspected,
    output: await inspectImage(output, { ...options, minWidth: 1, minHeight: 1 }),
    outputPath,
    transformations: ["autorotate", "normalize", "conservative_sharpen", allowUpscale ? "upscale_requires_review" : "no_upscale"],
    requiresReview: inspected.requiresReview || allowUpscale,
  };
}

function escapeSvg(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function generateWarehouseTrustCard(inputPath, outputPath, options = {}) {
  const label = escapeSvg(options.label ?? "Склад 7TOOL, Москва");
  const sublabel = escapeSvg(options.sublabel ?? "Проверяем наличие перед оплатой · Доставка по России");
  const width = Number(options.width ?? 1_280);
  const height = Number(options.height ?? 960);
  const source = await fs.readFile(path.resolve(inputPath));
  await inspectImage(source, { minWidth: 1, minHeight: 1 });
  const overlay = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="${height - 190}" width="${width}" height="190" fill="#101820" fill-opacity="0.92"/>
    <text x="56" y="${height - 105}" fill="#ffffff" font-family="Arial, sans-serif" font-size="46" font-weight="700">${label}</text>
    <text x="56" y="${height - 52}" fill="#dce6ef" font-family="Arial, sans-serif" font-size="28">${sublabel}</text>
  </svg>`);
  const output = await sharp(source, { limitInputPixels: DEFAULT_MAX_PIXELS, failOn: "error" })
    .rotate().resize(width, height, { fit: "cover", position: "centre" })
    .composite([{ input: overlay, top: 0, left: 0 }])
    .webp({ quality: 88, effort: 5 }).toBuffer();
  const target = path.resolve(outputPath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, output);
  return { outputPath: target, ...(await inspectImage(output, { minWidth: 1, minHeight: 1 })) };
}

function svgLine(value, maxLength = 68) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return escapeSvg(text.length <= maxLength ? text : `${text.slice(0, maxLength - 1).trim()}…`);
}

export async function generateSpecificationCard(product, outputPath, options = {}) {
  if (!product?.title || !product?.sku || !Number.isFinite(Number(product?.price))) throw new Error("SPEC_CARD_FACTS_REQUIRED");
  const width = Number(options.width ?? 1_280);
  const height = Number(options.height ?? 960);
  const params = (Array.isArray(product.params) ? product.params : []).slice(0, 6);
  const price = new Intl.NumberFormat("ru-RU").format(Number(product.price)).replace(/\u00a0/g, " ");
  const paramLines = params.map((item, index) => {
    const label = svgLine(`${item.name}: ${item.value}${item.unit ? ` ${item.unit}` : ""}`, 74);
    return `<text x="80" y="${410 + index * 68}" fill="#25384a" font-family="Arial, sans-serif" font-size="31">• ${label}</text>`;
  }).join("\n");
  const svg = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${height}" fill="#f5f7f9"/>
    <rect x="0" y="0" width="${width}" height="22" fill="#e8a317"/>
    <text x="80" y="105" fill="#101820" font-family="Arial, sans-serif" font-size="34" font-weight="700">7TOOL · характеристики</text>
    <text x="80" y="190" fill="#101820" font-family="Arial, sans-serif" font-size="47" font-weight="700">${svgLine(product.title, 48)}</text>
    <text x="80" y="255" fill="#536779" font-family="Arial, sans-serif" font-size="29">Артикул: ${svgLine(product.sku, 45)}</text>
    <rect x="80" y="298" rx="18" width="430" height="78" fill="#101820"/>
    <text x="108" y="350" fill="#ffffff" font-family="Arial, sans-serif" font-size="37" font-weight="700">${price} ₽${options.vatIncluded === false ? "" : " · с НДС"}</text>
    ${paramLines}
    <rect x="80" y="850" width="1120" height="2" fill="#d7dfe6"/>
    <text x="80" y="905" fill="#536779" font-family="Arial, sans-serif" font-size="27">Проверим совместимость и наличие перед оплатой</text>
  </svg>`);
  const output = await sharp(svg).webp({ quality: 92, effort: 5 }).toBuffer();
  const target = path.resolve(outputPath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, output);
  return { outputPath: target, ...(await inspectImage(output, { minWidth: 1, minHeight: 1 })) };
}

export async function runAiImageEnhancer(buffer, enhancer) {
  if (typeof enhancer !== "function") return { status: "disabled", buffer: null, requiresHumanReview: false };
  const before = await inspectImage(buffer, { minWidth: 1, minHeight: 1 });
  const enhanced = await enhancer(buffer);
  const after = await inspectImage(enhanced, { minWidth: 1, minHeight: 1 });
  return {
    status: "generated_pending_review",
    buffer: enhanced,
    before,
    after,
    requiresHumanReview: true,
  };
}
