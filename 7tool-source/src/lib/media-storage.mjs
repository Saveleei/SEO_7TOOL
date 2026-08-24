import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { descriptiveImageFilename } from "./image-seo.mjs";

const MAX_SOURCE_BYTES = 50 * 1024 * 1024;
const MAX_INPUT_PIXELS = 80_000_000;
const TARGET_WIDTHS = [320, 640, 960, 1280];
const INPUT_FORMATS = new Set(["jpeg", "png", "webp", "avif"]);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function mediaRoot() {
  return path.resolve(process.env.MEDIA_ROOT || path.join(process.cwd(), ".media"));
}

function validateAssetId(assetId) {
  if (!/^[a-z0-9][a-z0-9-]{9,79}$/i.test(assetId)) throw new Error("Invalid media asset id");
  return assetId;
}

export function resolveMediaStorageKey(storageKey) {
  const normalized = String(storageKey ?? "").replace(/\\/g, "/");
  if (!/^[a-z0-9][a-z0-9-]{9,79}\/\d{2,4}\.(?:webp|avif)$/i.test(normalized)) return null;
  const root = mediaRoot();
  const resolved = path.resolve(root, "variants", ...normalized.split("/"));
  return resolved.startsWith(`${path.resolve(root, "variants")}${path.sep}`) ? resolved : null;
}

export function storageKeyFromPublicMediaPath(publicPath) {
  const normalized = String(publicPath ?? "").replace(/\\/g, "/");
  if (resolveMediaStorageKey(normalized)) return normalized;
  const match = normalized.match(/^([a-z0-9][a-z0-9-]{9,79})\/(\d{2,4})-[a-z0-9][a-z0-9-]{0,64}\.(webp|avif)$/i);
  if (!match) return null;
  const storageKey = `${match[1]}/${match[2]}.${match[3].toLocaleLowerCase("en")}`;
  return resolveMediaStorageKey(storageKey) ? storageKey : null;
}

export function mediaPublicUrl(storageKey, description) {
  if (!resolveMediaStorageKey(storageKey)) throw new Error("Invalid public media storage key");
  const normalized = String(storageKey).replace(/\\/g, "/");
  if (!String(description ?? "").trim()) return `/media/${normalized}`;
  const [assetId, variant] = normalized.split("/");
  const [width, format] = variant.split(".");
  return `/media/${assetId}/${descriptiveImageFilename(description, Number(width), format)}`;
}

async function writeImmutable(filePath, buffer) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  try {
    await fs.writeFile(filePath, buffer, { flag: "wx" });
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    const existing = await fs.readFile(filePath);
    if (sha256(existing) !== sha256(buffer)) throw new Error(`Immutable media collision: ${filePath}`);
  }
}

async function averageHash(buffer) {
  const pixels = await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" })
    .rotate()
    .greyscale()
    .resize(8, 8, { fit: "fill" })
    .raw()
    .toBuffer();
  const average = pixels.reduce((sum, value) => sum + value, 0) / pixels.length;
  let bits = "";
  for (const value of pixels) bits += value >= average ? "1" : "0";
  return BigInt(`0b${bits}`).toString(16).padStart(16, "0");
}

export async function processMediaFile({ inputPath, assetId }) {
  validateAssetId(assetId);
  const sourcePath = path.resolve(inputPath);
  const stat = await fs.stat(sourcePath);
  if (!stat.isFile() || stat.size <= 0 || stat.size > MAX_SOURCE_BYTES) throw new Error("Media source must be a regular file up to 50 MB");
  const source = await fs.readFile(sourcePath);
  const metadata = await sharp(source, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" }).metadata();
  if (!metadata.width || !metadata.height || !metadata.format || !INPUT_FORMATS.has(metadata.format)) throw new Error("Unsupported media file; expected JPEG, PNG, WebP or AVIF");
  if ((metadata.pages ?? 1) !== 1) throw new Error("Animated or multi-page media is not supported");
  const sourceChecksum = sha256(source);
  const originalExtension = metadata.format === "jpeg" ? "jpg" : metadata.format;
  const originalKey = `originals/${sourceChecksum}.${originalExtension}`;
  await writeImmutable(path.resolve(mediaRoot(), ...originalKey.split("/")), source);
  const perceptualHash = await averageHash(source);
  const swapsAxes = new Set([5, 6, 7, 8]).has(metadata.orientation ?? 1);
  const orientedWidth = swapsAxes ? metadata.height : metadata.width;
  const widths = [...new Set(TARGET_WIDTHS.map((width) => Math.min(width, orientedWidth)).filter((width) => width > 0))].sort((a, b) => a - b);
  const variants = [];
  for (const width of widths) {
    for (const format of ["webp", "avif"]) {
      const pipeline = sharp(source, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" })
        .rotate()
        .resize({ width, withoutEnlargement: true });
      const output = format === "webp"
        ? await pipeline.webp({ quality: 82, effort: 5 }).toBuffer()
        : await pipeline.avif({ quality: 55, effort: 5 }).toBuffer();
      const outputMetadata = await sharp(output).metadata();
      const actualWidth = outputMetadata.width;
      const actualHeight = outputMetadata.height;
      if (!actualWidth || !actualHeight) throw new Error("Generated media variant has invalid dimensions");
      const storageKey = `${assetId}/${actualWidth}.${format}`;
      const filePath = resolveMediaStorageKey(storageKey);
      if (!filePath) throw new Error("Generated invalid media storage key");
      await writeImmutable(filePath, output);
      variants.push({
        width: actualWidth,
        height: actualHeight,
        format: format.toUpperCase(),
        mime: `image/${format}`,
        storageKey,
        checksum: sha256(output),
        bytes: output.length,
      });
    }
  }
  return {
    originalStorageKey: originalKey,
    sha256: sourceChecksum,
    perceptualHash,
    width: orientedWidth,
    height: swapsAxes ? metadata.width : metadata.height,
    bytes: source.length,
    mime: `image/${metadata.format === "jpeg" ? "jpeg" : metadata.format}`,
    variants,
  };
}
