import fs from "node:fs";
import path from "node:path";
import { enhanceImageLocally, generateSpecificationCard, generateWarehouseTrustCard, inspectImage } from "../src/lib/avito/image-pipeline.mjs";

function parse(argv) {
  const [command, input, ...rest] = argv;
  if (!command || !input) throw new Error("Usage: node scripts/avito-images.mjs <inspect|enhance|warehouse|spec> <input> [--output path]");
  const result = { command, input };
  for (let index = 0; index < rest.length; index += 2) {
    if (!rest[index]?.startsWith("--") || !rest[index + 1]) throw new Error(`Invalid argument: ${rest[index] ?? ""}`);
    result[rest[index].slice(2)] = rest[index + 1];
  }
  return result;
}

async function main() {
  const options = parse(process.argv.slice(2));
  const input = path.resolve(options.input);
  if (!fs.existsSync(input) || !fs.statSync(input).isFile()) throw new Error(`IMAGE_FILE_NOT_FOUND:${input}`);
  if (options.command === "inspect") {
    console.log(JSON.stringify(await inspectImage(fs.readFileSync(input)), null, 2));
    return;
  }
  if (options.command === "enhance") {
    const outputRoot = path.resolve(options.output ?? ".avito/images");
    console.log(JSON.stringify(await enhanceImageLocally(fs.readFileSync(input), outputRoot, path.parse(input).name), null, 2));
    return;
  }
  if (options.command === "warehouse") {
    const output = path.resolve(options.output ?? "public/avito/warehouse-proof.webp");
    console.log(JSON.stringify(await generateWarehouseTrustCard(input, output), null, 2));
    return;
  }
  if (options.command === "spec") {
    const output = path.resolve(options.output ?? "public/avito/specification.webp");
    const product = JSON.parse(fs.readFileSync(input, "utf8"));
    console.log(JSON.stringify(await generateSpecificationCard(product, output), null, 2));
    return;
  }
  throw new Error(`UNKNOWN_IMAGE_COMMAND:${options.command}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
