import { createHash } from "node:crypto";
import { accessSync, constants, existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { isProductionSeoHost } from "../app/data/seoIndexing.mjs";
import { resolveYandexMetrikaId } from "../app/data/analyticsConfig.mjs";

const PASSWORD_HASH_PATTERN = /^pbkdf2-sha256\$(\d{6,7})\$([A-Za-z0-9_-]{16,128})\$([A-Za-z0-9_-]{32,128})$/u;
const MAX_FEED_AGE_MINUTES = 26 * 60;

export function validateProductionConfig(env = process.env, options = {}) {
  const errors = [];
  const checks = [];
  const now = new Date(options.now ?? Date.now());

  requireExact(env, "NODE_ENV", "production", errors, checks);
  requireExact(env, "HOST", "127.0.0.1", errors, checks);
  requireExact(env, "QUOTE_WORKSPACE_ENABLED", "1", errors, checks);
  if (env.QUOTE_TEST_MODE === "1") errors.push("QUOTE_TEST_MODE must be disabled on production.");
  else checks.push("test contour disabled");
  requireExact(env, "SEO_INDEXING_ENABLED", "1", errors, checks);
  if (resolveYandexMetrikaId(env) == null) errors.push("YANDEX_METRIKA_ID must contain a valid production counter id.");
  else checks.push("Yandex Metrica counter configured");

  const dataDir = requireAbsolutePath(env, "QUOTE_DATA_DIR", errors, checks);
  const catalogPath = requireAbsolutePath(env, "CATALOG_FEED_PATH", errors, checks);
  const metadataPath = requireAbsolutePath(env, "CATALOG_SNAPSHOT_META_PATH", errors, checks);
  if (String(env.QUOTE_TEST_DATA_DIR || "").trim()) errors.push("QUOTE_TEST_DATA_DIR must be empty on production.");
  if (String(env.MANAGER_AUTH_TEST_HOSTS || "").trim()) errors.push("MANAGER_AUTH_TEST_HOSTS must be empty on production.");

  validateManagerAccess(env, errors, checks);
  validateShipping(env, errors, checks);
  validatePort(env, errors, checks);

  if (options.checkFiles !== false) {
    validateWritableDirectory(dataDir, "QUOTE_DATA_DIR", errors, checks);
    validateCatalogSnapshot(catalogPath, metadataPath, now, env, errors, checks);
  }

  return { ok:errors.length === 0, errors, checks };
}

function validateManagerAccess(env, errors, checks) {
  const localHosts = splitList(env.MANAGER_AUTH_LOCAL_HOSTS);
  const localUsername = String(env.MANAGER_AUTH_LOCAL_USERNAME || "").trim();
  const localHash = String(env.MANAGER_AUTH_LOCAL_PASSWORD_HASH || "").trim();
  const platformAdmins = splitList(env.MANAGER_AUTH_ADMIN_EMAILS);
  const localRequested = localHosts.length > 0 || localUsername || localHash;

  if (localHosts.some((host) => !isProductionSeoHost(host))) errors.push("MANAGER_AUTH_LOCAL_HOSTS may contain only 7tool.ru and www.7tool.ru.");
  if (localRequested) {
    if (!localHosts.includes("7tool.ru")) errors.push("Local administrator access must include the exact 7tool.ru host.");
    if (localUsername.length < 3) errors.push("MANAGER_AUTH_LOCAL_USERNAME is not configured.");
    if (!validPasswordHash(localHash)) errors.push("MANAGER_AUTH_LOCAL_PASSWORD_HASH is not a valid PBKDF2 hash.");
    if (localHosts.includes("7tool.ru") && localUsername.length >= 3 && validPasswordHash(localHash)) checks.push("local administrator access configured");
  }
  if (platformAdmins.length > 0) checks.push("platform administrator allowlist configured");
  if (!localRequested && platformAdmins.length === 0) errors.push("Configure at least one production administrator access method.");
}

function validateShipping(env, errors, checks) {
  requireExact(env, "SHIPPING_TIME_ZONE", "Europe/Moscow", errors, checks);
  requireExact(env, "SHIPPING_TODAY_ENABLED", "1", errors, checks);
  const cutoff = integer(env.SHIPPING_CUTOFF_HOUR);
  if (cutoff == null || cutoff < 0 || cutoff > 23) errors.push("SHIPPING_CUTOFF_HOUR must be an integer from 0 to 23.");
  else checks.push("shipping cutoff configured");
  const workDays = splitList(env.SHIPPING_WORKING_DAYS).map(Number);
  if (!workDays.length || workDays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) errors.push("SHIPPING_WORKING_DAYS must contain valid weekday numbers.");
  else checks.push("shipping work days configured");
  const maxAge = integer(env.SHIPPING_FEED_MAX_AGE_MINUTES);
  if (maxAge == null || maxAge < 15 || maxAge > MAX_FEED_AGE_MINUTES) errors.push(`SHIPPING_FEED_MAX_AGE_MINUTES must be between 15 and ${MAX_FEED_AGE_MINUTES}.`);
  else checks.push("feed freshness window configured");
}

function validatePort(env, errors, checks) {
  const port = integer(env.PORT);
  if (port == null || port < 1024 || port > 65535) errors.push("PORT must be an integer from 1024 to 65535.");
  else checks.push("application port configured");
}

function validateWritableDirectory(value, label, errors, checks) {
  if (!value) return;
  try {
    if (!existsSync(value) || !statSync(value).isDirectory()) throw new Error("not a directory");
    accessSync(value, constants.R_OK | constants.W_OK);
    checks.push(`${label} is readable and writable`);
  } catch {
    errors.push(`${label} must be an existing readable and writable directory.`);
  }
}

function validateCatalogSnapshot(catalogPath, metadataPath, now, env, errors, checks) {
  if (!catalogPath || !metadataPath) return;
  try {
    const catalog = readFileSync(catalogPath);
    const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
    const actualHash = createHash("sha256").update(catalog).digest("hex");
    if (metadata.status !== "complete") errors.push("Catalog snapshot metadata is not complete.");
    if (metadata.catalogSha256 !== actualHash) errors.push("Catalog snapshot checksum does not match metadata.");
    const completedAt = new Date(metadata.completedAt);
    const ageMinutes = (now.getTime() - completedAt.getTime()) / 60_000;
    const maxAge = integer(env.SHIPPING_FEED_MAX_AGE_MINUTES);
    if (!Number.isFinite(completedAt.getTime()) || ageMinutes < 0) errors.push("Catalog snapshot completedAt is invalid.");
    else if (maxAge != null && ageMinutes > maxAge) errors.push("Catalog snapshot is older than the configured freshness window.");
    else checks.push("catalog checksum and freshness verified");
  } catch (error) {
    errors.push(`Catalog snapshot cannot be verified: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

function requireExact(env, name, expected, errors, checks) {
  if (String(env[name] || "") !== expected) errors.push(`${name} must equal ${expected}.`);
  else checks.push(`${name}=${expected}`);
}

function requireAbsolutePath(env, name, errors, checks) {
  const value = String(env[name] || "").trim();
  if (!value || !path.isAbsolute(value)) {
    errors.push(`${name} must be an absolute path.`);
    return "";
  }
  checks.push(`${name} configured`);
  return value;
}

function splitList(value) {
  return Array.from(new Set(String(value || "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean)));
}

function validPasswordHash(value) {
  const match = String(value || "").match(PASSWORD_HASH_PATTERN);
  return Boolean(match && Number(match[1]) >= 100_000 && Number(match[1]) <= 1_000_000);
}

function integer(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (entry === import.meta.url) {
  const result = validateProductionConfig();
  if (!result.ok) {
    console.error("Production preflight failed:");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`Production preflight passed: ${result.checks.length} checks.`);
  }
}
