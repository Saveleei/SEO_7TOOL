import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(scriptPath), "..");

export function finalizeCatalogSnapshot(options = {}) {
  const catalogPath = options.catalogPath ?? process.env.CATALOG_JSON_PATH ?? path.join(root, "src", "lib", "products.json");
  const metadataPath = options.metadataPath ?? process.env.CATALOG_META_PATH ?? path.join(path.dirname(catalogPath), "catalog-snapshot-meta.json");
  const publishDir = options.publishDir ?? process.env.CATALOG_PUBLISH_DIR ?? "";
  const catalogSource = fs.readFileSync(catalogPath, "utf8");
  const catalog = JSON.parse(catalogSource);
  if (!Array.isArray(catalog?.products) || !Array.isArray(catalog?.categories)) {
    throw new Error("Каталог не прошёл проверку структуры перед публикацией");
  }

  const existingMetadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
  if (existingMetadata?.status !== "complete" || !Number.isFinite(Date.parse(existingMetadata?.completedAt))) {
    throw new Error("Метаданные успешного обновления отсутствуют; публикация отменена");
  }

  const metadata = {
    ...existingMetadata,
    catalogSha256:createHash("sha256").update(catalogSource).digest("hex"),
  };
  atomicWrite(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);

  if (publishDir) {
    fs.mkdirSync(publishDir, { recursive:true });
    const publishedCatalogPath = path.join(publishDir, "products.json");
    const publishedMetadataPath = path.join(publishDir, "catalog-snapshot-meta.json");
    // The data file is always renamed before its identity metadata. A failure
    // between the two renames is therefore detected as a hash mismatch and
    // can never make an old or partial catalog look fresh.
    atomicWrite(publishedCatalogPath, catalogSource);
    atomicWrite(publishedMetadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
  }

  return {
    completedAt:metadata.completedAt,
    catalogSha256:metadata.catalogSha256,
    products:catalog.products.length,
    publishDir:publishDir || null,
  };
}
function atomicWrite(targetPath, content) {
  const tempPath = `${targetPath}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tempPath, content, "utf8");
    fs.renameSync(tempPath, targetPath);
  } finally {
    fs.rmSync(tempPath, { force:true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  try {
    console.log(JSON.stringify(finalizeCatalogSnapshot(), null, 2));
  } catch (error) {
    console.error("ОШИБКА ПУБЛИКАЦИИ СНИМКА КАТАЛОГА:", error);
    process.exitCode = 1;
  }
}
