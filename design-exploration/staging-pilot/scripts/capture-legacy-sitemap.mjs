import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = process.argv[2];
if (!sourcePath) throw new Error("Usage: node scripts/capture-legacy-sitemap.mjs <legacy-sitemap.xml>");
const source = await readFile(path.resolve(sourcePath), "utf8");
const urls = [...source.matchAll(/<loc>([^<]+)<\/loc>/gu)].map((match) => match[1].trim());
if (!urls.length) throw new Error("No <loc> entries were found in the sitemap.");
const snapshot = {
  version:1,
  capturedAt:new Date().toISOString(),
  source:"https://7tool.ru/sitemap.xml",
  sourceSha256:createHash("sha256").update(source).digest("hex"),
  urls,
};
await writeFile(path.resolve(appRoot, "app/data/generatedLegacyUrlSnapshot.json"), `${JSON.stringify(snapshot)}\n`, "utf8");
console.log(`Captured ${urls.length} legacy sitemap URLs.`);
