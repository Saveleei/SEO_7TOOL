import { createHash } from "node:crypto";
import { mkdir, open, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { QuoteWorkflowError } from "./quoteRequestStore.ts";

const MAX_HOMEPAGE_ASSET_BYTES = 2_000_000;
const ASSET_PATTERN = /^homepage-(?<hash>[0-9a-f]{64})\.(?<extension>png|jpg|webp)$/u;
type Options = { dataDir?: string };

export async function saveHomepageAsset(file: File, options: Options = {}) {
  if (file.size <= 0 || file.size > MAX_HOMEPAGE_ASSET_BYTES) throw new QuoteWorkflowError("Фотография должна быть не больше 2 МБ.", 413);
  const bytes = Buffer.from(await file.arrayBuffer());
  const format = detectImageFormat(bytes);
  if (!format) throw new QuoteWorkflowError("Загрузите PNG, JPG или WebP с корректным содержимым.", 400);
  const assetId = `homepage-${createHash("sha256").update(bytes).digest("hex")}.${format.extension}`;
  const directory = assetDirectory(resolveDataDir(options.dataDir));
  await mkdir(directory, { recursive:true });
  try {
    const handle = await open(path.join(directory, assetId), "wx");
    try {
      await handle.writeFile(bytes);
      await handle.sync();
    } finally {
      await handle.close();
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  return { assetId, mime:format.mime, size:bytes.length };
}

export async function readHomepageAsset(assetId: string, options: Options = {}): Promise<{ bytes: Buffer; mime: string } | null> {
  const parsed = parseAssetId(assetId);
  if (!parsed) return null;
  try {
    const bytes = await readFile(path.join(assetDirectory(resolveDataDir(options.dataDir)), assetId));
    const detected = detectImageFormat(bytes);
    if (!detected || detected.extension !== parsed.extension) return null;
    return { bytes, mime:detected.mime };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function homepageAssetExists(assetId: string, options: Options = {}): Promise<boolean> {
  if (!parseAssetId(assetId)) return false;
  try {
    const file = await stat(path.join(assetDirectory(resolveDataDir(options.dataDir)), assetId));
    return file.isFile() && file.size > 0 && file.size <= MAX_HOMEPAGE_ASSET_BYTES;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

function parseAssetId(assetId: string) {
  return ASSET_PATTERN.exec(assetId)?.groups as { hash: string; extension: "png" | "jpg" | "webp" } | undefined;
}

function assetDirectory(dataDir: string) {
  return path.join(dataDir, "settings", "homepage-content-assets");
}

function resolveDataDir(override?: string) {
  return override || process.env.QUOTE_DATA_DIR || process.env.QUOTE_TEST_DATA_DIR || path.join(process.cwd(), "work", "quote-requests");
}

function detectImageFormat(bytes: Buffer): { extension: "png" | "jpg" | "webp"; mime: string } | null {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { extension:"png", mime:"image/png" };
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { extension:"jpg", mime:"image/jpeg" };
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") return { extension:"webp", mime:"image/webp" };
  return null;
}
