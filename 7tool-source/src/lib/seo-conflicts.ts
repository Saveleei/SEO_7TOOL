import fs from "node:fs";
import path from "node:path";

type Cache = { mtimeMs: number; ids: Set<string> };
let cache: Cache | undefined;

export function getSeoConflictProductIds(): Set<string> {
  const manifest = path.join(process.cwd(), ".analysis", "seo-data-conflicts.json");
  try {
    const mtimeMs = fs.statSync(manifest).mtimeMs;
    if (cache?.mtimeMs === mtimeMs) return cache.ids;
    const payload = JSON.parse(fs.readFileSync(manifest, "utf8")) as { productIds?: unknown[] };
    cache = { mtimeMs, ids: new Set((payload.productIds ?? []).map(String)) };
    return cache.ids;
  } catch {
    return new Set();
  }
}

export function hasSeoDataConflict(productId: string): boolean {
  return getSeoConflictProductIds().has(String(productId));
}
