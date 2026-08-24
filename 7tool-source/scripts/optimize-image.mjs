import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const [, , input, output] = process.argv;
if (!input || !output) {
  console.error("Usage: node scripts/optimize-image.mjs <input> <output>");
  process.exit(2);
}

await fs.mkdir(path.dirname(path.resolve(output)), { recursive: true });
await sharp(path.resolve(input), { limitInputPixels: 80_000_000 })
  .rotate()
  .resize({ width: 1280, height: 960, fit: "cover", position: "attention", withoutEnlargement: true })
  .webp({ quality: 80, effort: 5 })
  .toFile(path.resolve(output));

const stat = await fs.stat(path.resolve(output));
console.log(`${output}: ${stat.size} bytes`);
