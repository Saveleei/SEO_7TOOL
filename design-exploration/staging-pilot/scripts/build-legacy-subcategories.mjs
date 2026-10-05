import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.resolve(appRoot, "../../7tool-source/src/lib");
const outputPath = path.resolve(appRoot, "app/data/generatedLegacySubcategories.json");
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "7tool-subcategories-"));
const sourceFiles = ["catalog.ts", "category-content.ts", "data.ts", "site-config.ts", "subcategories.ts"];

try {
  await writeFile(path.join(temporaryRoot, "package.json"), '{"type":"commonjs"}\n', "utf8");
  for (const filename of sourceFiles) {
    const source = await readFile(path.join(sourceRoot, filename), "utf8");
    const compiled = ts.transpileModule(source, {
      compilerOptions:{ module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022, esModuleInterop:true, resolveJsonModule:true },
      fileName:filename,
    }).outputText;
    await writeFile(path.join(temporaryRoot, filename.replace(/\.ts$/u, ".js")), compiled, "utf8");
  }
  for (const filename of ["products.json", "category-seo.json"]) {
    await writeFile(path.join(temporaryRoot, filename), await readFile(path.join(sourceRoot, filename)));
  }

  const require = createRequire(path.join(temporaryRoot, "package.json"));
  const { publishedSubcategories } = require(path.join(temporaryRoot, "subcategories.js"));
  const catalogSource = await readFile(path.join(sourceRoot, "products.json"), "utf8");
  const entries = publishedSubcategories().map((subcategory) => ({
    categorySlug:subcategory.categorySlug,
    categoryTitle:subcategory.categoryTitle,
    slug:subcategory.slug,
    title:subcategory.title,
    h1:subcategory.h1,
    shortDescription:subcategory.shortDescription,
    intro:subcategory.intro,
    seoTitle:subcategory.seoTitle,
    seoText:subcategory.seoText,
    metaTitle:subcategory.metaTitle,
    metaDescription:subcategory.metaDescription,
    image:subcategory.image,
    imageAlt:subcategory.imageAlt,
    faq:subcategory.faq ?? [],
    relatedLinks:subcategory.relatedLinks ?? [],
    productIds:subcategory.items.map((product) => product.id),
    count:subcategory.count,
  })).sort((first, second) => `${first.categorySlug}/${first.slug}`.localeCompare(`${second.categorySlug}/${second.slug}`, "ru-RU"));
  const artifact = {
    version:1,
    sourceSha256:createHash("sha256").update(catalogSource).digest("hex"),
    entries,
  };
  await writeFile(outputPath, `${JSON.stringify(artifact)}\n`, "utf8");
  console.log(`Generated ${entries.length} legacy-compatible subcategory landings.`);
} finally {
  await rm(temporaryRoot, { recursive:true, force:true });
}
