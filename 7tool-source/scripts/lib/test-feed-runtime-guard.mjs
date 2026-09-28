import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const STATUS_VALUES = new Set(["running", "complete", "failed"]);

function requiredFile(filePath, label) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new Error(`${label} отсутствует: ${filePath}`);
  }
  return filePath;
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

export function validateTestFeedRuntime({ appDir, storefrontBuildDir = "" }) {
  const resolvedAppDir = path.resolve(appDir);
  const requiredScripts = [
    "scripts/backup-data.mjs",
    "scripts/refresh-feed.mts",
    "scripts/finalize-catalog-snapshot.mjs",
    "scripts/test-feed-runtime-guard.mjs",
  ];
  for (const relativePath of requiredScripts) {
    requiredFile(path.join(resolvedAppDir, relativePath), "Runtime test-feed");
  }
  const databaseModule = resolveDependency(resolvedAppDir, "better-sqlite3", "Runtime test-feed");

  let resolvedBuildDir = null;
  let vinextModule = null;
  if (String(storefrontBuildDir || "").trim()) {
    resolvedBuildDir = path.resolve(storefrontBuildDir);
    requiredFile(path.join(resolvedBuildDir, "package.json"), "Storefront build: package.json");
    vinextModule = requiredFile(
      path.join(resolvedBuildDir, "node_modules", "vinext", "dist", "cli.js"),
      "Storefront build: Vinext CLI",
    );
  }

  return { appDir:resolvedAppDir, databaseModule, storefrontBuildDir:resolvedBuildDir, vinextModule };
}

function readPreviousStatus(statusPath) {
  if (!fs.existsSync(statusPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(statusPath, "utf8"));
  } catch {
    return null;
  }
}

function verifiedSnapshot(catalogPath, metadataPath) {
  const catalogSource = fs.readFileSync(requiredFile(path.resolve(catalogPath), "Опубликованный каталог"), "utf8");
  const metadata = JSON.parse(fs.readFileSync(requiredFile(path.resolve(metadataPath), "Метаданные каталога"), "utf8"));
  const catalogSha256 = createHash("sha256").update(catalogSource).digest("hex");
  if (metadata.status !== "complete" || metadata.catalogSha256 !== catalogSha256) {
    throw new Error("Опубликованный каталог и его метаданные не прошли SHA-256 проверку.");
  }
  if (!Number.isFinite(Date.parse(metadata.completedAt))) {
    throw new Error("Метаданные каталога не содержат корректный completedAt.");
  }
  return { catalogSha256, catalogCompletedAt:metadata.completedAt };
}

export function writeTestFeedRefreshStatus({
  statusPath,
  status,
  stage,
  exitCode = null,
  message = null,
  catalogPath = null,
  metadataPath = null,
  now = new Date(),
}) {
  if (!STATUS_VALUES.has(status)) throw new Error(`Недопустимый статус test-feed: ${status}`);
  const resolvedStatusPath = path.resolve(statusPath);
  const previous = readPreviousStatus(resolvedStatusPath);
  const timestamp = now.toISOString();
  const startedAt = status === "running" ? timestamp : previous?.startedAt || timestamp;
  const snapshot = status === "complete" ? verifiedSnapshot(catalogPath, metadataPath) : {};
  const payload = {
    schemaVersion:1,
    status,
    stage:String(stage || "unknown"),
    startedAt,
    updatedAt:timestamp,
    finishedAt:status === "running" ? null : timestamp,
    exitCode:status === "failed" ? Number(exitCode) : 0,
    message:message ? String(message).slice(0, 240) : null,
    ...snapshot,
  };
  fs.mkdirSync(path.dirname(resolvedStatusPath), { recursive:true });
  const temporaryPath = `${resolvedStatusPath}.tmp-${process.pid}`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  fs.renameSync(temporaryPath, resolvedStatusPath);
  return payload;
}
