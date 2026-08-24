import "server-only";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export function uploadRoot(): string {
  return path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), ".uploads"));
}

export async function storeImage(
  file: File,
  scope: "products" | "categories" | "landings",
  options: { width: number; height: number; quality: number },
): Promise<string> {
  if (!ALLOWED_MIME.has(file.type)) throw new Error("UNSUPPORTED_IMAGE_TYPE");
  if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) throw new Error("IMAGE_TOO_LARGE");
  const input = Buffer.from(await file.arrayBuffer());
  const output = await sharp(input, { limitInputPixels: 40_000_000, failOn: "error" })
    .rotate()
    .resize({ width: options.width, height: options.height, fit: "inside", withoutEnlargement: true })
    .webp({ quality: options.quality })
    .toBuffer();
  const name = `${crypto.randomBytes(16).toString("hex")}.webp`;
  const directory = path.join(uploadRoot(), scope);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, name), output, { flag: "wx" });
  return `/uploads/${scope}/${name}`;
}

export function resolvePublicUpload(parts: string[]): string | null {
  if (parts.length !== 2 || !["products", "categories", "landings"].includes(parts[0])) return null;
  if (!/^[a-f0-9]{32}\.webp$/i.test(parts[1])) return null;
  const root = uploadRoot();
  const resolved = path.resolve(root, parts[0], parts[1]);
  return resolved.startsWith(`${root}${path.sep}`) ? resolved : null;
}
