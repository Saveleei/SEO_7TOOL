import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const [, , input, output] = process.argv;
if (!input || !output) {
  console.error("Usage: node scripts/optimize-og.mjs <input> <output>");
  process.exit(2);
}

await fs.mkdir(path.dirname(path.resolve(output)), { recursive: true });
await sharp(path.resolve(input), { limitInputPixels: 40_000_000 })
  .rotate()
  .resize({ width: 1200, height: 630, fit: "cover", position: "centre" })
  .png({ compressionLevel: 9, quality: 90 })
  .toFile(path.resolve(output));

const stat = await fs.stat(path.resolve(output));
console.log(`${output}: ${stat.size} bytes`);
