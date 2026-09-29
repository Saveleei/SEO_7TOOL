import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { validateStalexProductionCatalogCandidate } from "../validate-stalex-production-catalog-candidate.mjs";

const STATUS_VALUES = new Set(["running", "validated", "complete", "failed"]);

function requiredFile(filePath, label) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile() || fs.statSync(resolved).size === 0) {
    throw new Error(`${label} отсутствует или пуст: ${resolved}`);
  }
  return resolved;
}

function pathInside(root, candidate, label) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(candidate);
  const relative = path.relative(resolvedRoot, resolved);
  if (!relative || relative === ".") {
    throw new Error(`${label} должен быть отдельным путём внутри production shared root.`);
  }
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label} должен находиться внутри production shared root: ${resolvedRoot}`);
  }
  return resolved;
}

function assertProductionRoot(sharedRoot) {
  const resolved = path.resolve(sharedRoot);
  if (/(^|[\\/])7tool-test(?:-[^\\/]*)?(?:[\\/]|$)/iu.test(resolved)) {
    throw new Error(`Production shared root не может указывать на test-контур: ${resolved}`);
  }
  return resolved;
}

function resolveDependency(root, dependency, label) {
  const packagePath = requiredFile(path.join(root, "package.json"), `${label}: package.json`);
  const requireFromRoot = createRequire(packagePath);
  try {
    return requiredFile(requireFromRoot.resolve(dependency), `${label}: зависимость ${dependency}`);
  } catch {
    throw new Error(`${label}: зависимость ${dependency} недоступна из ${root}`);
  }
}

export function validateProductionFeedRuntime({
  appDir,
  sharedRoot,
  workDir,
  releasesDir,
  currentLink,
  reviewedReportPath,
  statusPath,
  lockPath,
  baseCatalogPath,
  baseMetadataPath,
  baseDatabasePath,
  stalexStatePath,
  stalexStatusPath,
  stalexLockPath,
  backupDir,
}) {
  const resolvedAppDir = path.resolve(appDir);
  if (/(^|[\\/])7tool-test(?:-[^\\/]*)?(?:[\\/]|$)/iu.test(resolvedAppDir)) {
    throw new Error(`Production feed runtime не может указывать на test-контур: ${resolvedAppDir}`);
  }
  const resolvedSharedRoot = assertProductionRoot(sharedRoot);
  const paths = {
    workDir:pathInside(resolvedSharedRoot, workDir, "PRODUCTION_FEED_WORK_DIR"),
    releasesDir:pathInside(resolvedSharedRoot, releasesDir, "PRODUCTION_CATALOG_RELEASES_DIR"),
    currentLink:pathInside(resolvedSharedRoot, currentLink, "PRODUCTION_CATALOG_CURRENT_LINK"),
    reviewedReportPath:pathInside(resolvedSharedRoot, reviewedReportPath, "STALEX_REVIEWED_REPORT_PATH"),
    statusPath:pathInside(resolvedSharedRoot, statusPath, "PRODUCTION_FEED_STATUS_PATH"),
    lockPath:pathInside(resolvedSharedRoot, lockPath, "PRODUCTION_FEED_LOCK_PATH"),
    baseCatalogPath:pathInside(resolvedSharedRoot, baseCatalogPath, "BASE_CATALOG_PATH"),
    baseMetadataPath:pathInside(resolvedSharedRoot, baseMetadataPath, "BASE_METADATA_PATH"),
    baseDatabasePath:pathInside(resolvedSharedRoot, baseDatabasePath, "BASE_DATABASE_PATH"),
    stalexStatePath:pathInside(resolvedSharedRoot, stalexStatePath, "STALEX_STATE_PATH"),
    stalexStatusPath:pathInside(resolvedSharedRoot, stalexStatusPath, "STALEX_STATUS_PATH"),
    stalexLockPath:pathInside(resolvedSharedRoot, stalexLockPath, "STALEX_LOCK_PATH"),
    backupDir:pathInside(resolvedSharedRoot, backupDir, "BACKUP_DIR"),
  };
  const requiredScripts = [
    "scripts/backup-data.mjs",
    "scripts/refresh-feed.mts",
    "scripts/refresh-stalex-feed.mjs",
    "scripts/build-stalex-production-catalog.mjs",
    "scripts/validate-stalex-production-catalog-candidate.mjs",
    "scripts/production-feed-runtime.mjs",
  ];
  for (const relativePath of requiredScripts) requiredFile(path.join(resolvedAppDir, relativePath), "Production feed runtime");
  const databaseModule = resolveDependency(resolvedAppDir, "better-sqlite3", "Production feed runtime");
  requiredFile(paths.reviewedReportPath, "Рассмотренный Stalex report");
  if (paths.currentLink === paths.releasesDir || paths.currentLink === paths.workDir || paths.workDir === paths.releasesDir) {
    throw new Error("Production feed work, releases и current link должны быть разными путями.");
  }
  return { appDir:resolvedAppDir, sharedRoot:resolvedSharedRoot, databaseModule, ...paths };
}

function readJson(filePath, label) {
  const resolved = requiredFile(filePath, label);
  return { resolved, source:fs.readFileSync(resolved, "utf8") };
}

export function verifyProductionCatalogCandidate({
  catalogPath,
  metadataPath,
  reportPath,
  reviewedReportPath,
  maxAgeMinutes = 26 * 60,
  now = new Date(),
}) {
  const validation = validateStalexProductionCatalogCandidate({ catalogPath, metadataPath, reportPath, reviewedReportPath });
  const catalogFile = readJson(catalogPath, "Production catalog candidate");
  const metadataFile = readJson(metadataPath, "Production catalog metadata");
  const metadata = JSON.parse(metadataFile.source);
  const completedAt = new Date(metadata.completedAt);
  const ageMinutes = (now.getTime() - completedAt.getTime()) / 60_000;
  if (!Number.isFinite(completedAt.getTime()) || ageMinutes < -5) throw new Error("Production catalog completedAt некорректен или находится в будущем.");
  if (!Number.isFinite(maxAgeMinutes) || maxAgeMinutes < 15 || ageMinutes > maxAgeMinutes) {
    throw new Error(`Production catalog устарел: ${Math.round(ageMinutes)} мин.`);
  }
  if (!/^[a-f0-9]{64}$/u.test(String(metadata.baseCatalogSha256 || ""))) {
    throw new Error("Production metadata не содержит SHA-256 базового каталога.");
  }
  if (!Number.isFinite(Date.parse(metadata.stalexRefreshedAt))) {
    throw new Error("Production metadata не содержит подтверждённое время Stalex snapshot.");
  }
  const catalog = JSON.parse(catalogFile.source);
  if (!Array.isArray(catalog.categories) || !Array.isArray(catalog.products) || catalog.products.length === 0) {
    throw new Error("Production catalog имеет неподдерживаемую или пустую структуру.");
  }
  return {
    ...validation,
    completedAt:metadata.completedAt,
    ageMinutes,
    products:catalog.products.length,
    variants:catalog.products.reduce((total, product) => total + (Array.isArray(product.variants) ? product.variants.length : 0), 0),
  };
}

function atomicJson(targetPath, payload) {
  const resolved = path.resolve(targetPath);
  fs.mkdirSync(path.dirname(resolved), { recursive:true });
  const temporary = `${resolved}.${process.pid}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`, { encoding:"utf8", flag:"wx" });
    fs.renameSync(temporary, resolved);
  } finally {
    fs.rmSync(temporary, { force:true });
  }
}

function currentTarget(currentLink) {
  let stat;
  try {
    stat = fs.lstatSync(currentLink);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
  if (!stat.isSymbolicLink()) throw new Error(`Current catalog pointer не является symlink: ${currentLink}`);
  return path.resolve(path.dirname(currentLink), fs.readlinkSync(currentLink));
}

function swapSymlink(currentLink, targetPath) {
  const temporary = `${currentLink}.next-${process.pid}-${randomUUID()}`;
  const relativeTarget = path.relative(path.dirname(currentLink), targetPath) || ".";
  fs.mkdirSync(path.dirname(currentLink), { recursive:true });
  try {
    fs.symlinkSync(process.platform === "win32" ? targetPath : relativeTarget, temporary, process.platform === "win32" ? "junction" : "dir");
    if (process.platform === "win32" && fs.existsSync(currentLink)) fs.rmSync(currentLink, { force:true });
    fs.renameSync(temporary, currentLink);
  } finally {
    fs.rmSync(temporary, { force:true });
  }
}

export function publishProductionCatalog({
  sharedRoot,
  releasesDir,
  currentLink,
  catalogPath,
  metadataPath,
  reportPath,
  reviewedReportPath,
  maxAgeMinutes,
  now = new Date(),
}) {
  const resolvedRoot = assertProductionRoot(sharedRoot);
  const resolvedReleases = pathInside(resolvedRoot, releasesDir, "Production catalog releases");
  const resolvedCurrent = pathInside(resolvedRoot, currentLink, "Production catalog current link");
  const resolvedCatalog = pathInside(resolvedRoot, catalogPath, "Production catalog candidate");
  const resolvedMetadata = pathInside(resolvedRoot, metadataPath, "Production catalog metadata");
  const resolvedReport = pathInside(resolvedRoot, reportPath, "Production Stalex report");
  const resolvedReviewedReport = pathInside(resolvedRoot, reviewedReportPath, "Reviewed Stalex report");
  const verified = verifyProductionCatalogCandidate({
    catalogPath:resolvedCatalog,
    metadataPath:resolvedMetadata,
    reportPath:resolvedReport,
    reviewedReportPath:resolvedReviewedReport,
    maxAgeMinutes,
    now,
  });
  const completed = verified.completedAt.replace(/[^0-9]/gu, "").slice(0, 14);
  const generationName = `${completed}-${verified.catalogSha256.slice(0, 12)}`;
  const generationDir = path.join(resolvedReleases, generationName);
  const previousTarget = currentTarget(resolvedCurrent);
  if (previousTarget) pathInside(resolvedReleases, previousTarget, "Предыдущий production catalog target");

  fs.mkdirSync(resolvedReleases, { recursive:true });
  if (!fs.existsSync(generationDir)) {
    const incomingDir = path.join(resolvedReleases, `.incoming-${generationName}-${process.pid}-${randomUUID()}`);
    fs.mkdirSync(incomingDir, { recursive:false });
    try {
      fs.copyFileSync(resolvedCatalog, path.join(incomingDir, "products.json"));
      fs.copyFileSync(resolvedMetadata, path.join(incomingDir, "catalog-snapshot-meta.json"));
      fs.copyFileSync(resolvedReport, path.join(incomingDir, "stalex-report.json"));
      atomicJson(path.join(incomingDir, "publication-manifest.json"), {
        schemaVersion:1,
        publishedAt:now.toISOString(),
        completedAt:verified.completedAt,
        catalogSha256:verified.catalogSha256,
        products:verified.products,
        variants:verified.variants,
        previousTarget,
      });
      fs.renameSync(incomingDir, generationDir);
    } finally {
      fs.rmSync(incomingDir, { recursive:true, force:true });
    }
  } else {
    const generationHash = createHash("sha256").update(fs.readFileSync(path.join(generationDir, "products.json"))).digest("hex");
    if (generationHash !== verified.catalogSha256) throw new Error(`Generation уже существует с другим SHA: ${generationDir}`);
    verifyProductionCatalogCandidate({
      catalogPath:path.join(generationDir, "products.json"),
      metadataPath:path.join(generationDir, "catalog-snapshot-meta.json"),
      reportPath:path.join(generationDir, "stalex-report.json"),
      reviewedReportPath:resolvedReviewedReport,
      maxAgeMinutes,
      now,
    });
  }

  swapSymlink(resolvedCurrent, generationDir);
  return { ...verified, generationDir, currentLink:resolvedCurrent, previousTarget };
}

export function rollbackProductionCatalog({ sharedRoot, releasesDir, currentLink, targetPath }) {
  const resolvedRoot = assertProductionRoot(sharedRoot);
  const resolvedReleases = pathInside(resolvedRoot, releasesDir, "Production catalog releases");
  const resolvedCurrent = pathInside(resolvedRoot, currentLink, "Production catalog current link");
  const resolvedTarget = pathInside(resolvedReleases, targetPath, "Production catalog rollback target");
  requiredFile(path.join(resolvedTarget, "products.json"), "Rollback catalog");
  requiredFile(path.join(resolvedTarget, "catalog-snapshot-meta.json"), "Rollback metadata");
  const previousTarget = currentTarget(resolvedCurrent);
  swapSymlink(resolvedCurrent, resolvedTarget);
  return { currentLink:resolvedCurrent, targetPath:resolvedTarget, previousTarget };
}

function readPreviousStatus(statusPath) {
  if (!fs.existsSync(statusPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(statusPath, "utf8"));
  } catch {
    return null;
  }
}

export function writeProductionFeedStatus({
  statusPath,
  status,
  stage,
  mode,
  target = "production",
  exitCode = null,
  message = null,
  catalogSha256 = null,
  catalogCompletedAt = null,
  generationDir = null,
  now = new Date(),
}) {
  if (!STATUS_VALUES.has(status)) throw new Error(`Недопустимый production feed status: ${status}`);
  if (!["dry-run", "publish"].includes(mode)) throw new Error(`Недопустимый production feed mode: ${mode}`);
  const resolvedStatusPath = path.resolve(statusPath);
  const previous = readPreviousStatus(resolvedStatusPath);
  const timestamp = now.toISOString();
  const payload = {
    schemaVersion:1,
    status,
    mode,
    target,
    stage:String(stage || "unknown"),
    startedAt:status === "running" ? timestamp : previous?.startedAt || timestamp,
    updatedAt:timestamp,
    finishedAt:status === "running" ? null : timestamp,
    exitCode:status === "failed" ? Number(exitCode) : 0,
    message:message ? String(message).slice(0, 240) : null,
    catalogSha256:catalogSha256 || null,
    catalogCompletedAt:catalogCompletedAt || null,
    generationDir:generationDir || null,
  };
  atomicJson(resolvedStatusPath, payload);
  return payload;
}
