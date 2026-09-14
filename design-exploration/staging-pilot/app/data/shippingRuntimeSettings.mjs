import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import snapshotMetaJson from "../../../../7tool-source/src/lib/catalog-snapshot-meta.json" with { type:"json" };
import { DEFAULT_SHIPPING_SETTINGS, validateShippingSettings } from "./shippingSettingsValidation.mjs";

let cachedPath = "";
let cachedMtime = -1;
let cachedSettings = null;
let cacheCheckedAt = 0;

export function getRuntimeShippingSettings(env = process.env) {
  const defaults = settingsFromEnv(env);
  const filePath = env.SHIPPING_SETTINGS_PATH || path.join(env.QUOTE_TEST_DATA_DIR || path.join(process.cwd(), "work", "quote-requests"), "settings", "shipping.json");
  const checkedAt = Date.now();
  if (cachedPath === filePath && cachedSettings && checkedAt - cacheCheckedAt < 1_000) return cachedSettings;
  try {
    const mtime = statSync(filePath).mtimeMs;
    cacheCheckedAt = checkedAt;
    if (cachedPath === filePath && cachedMtime === mtime && cachedSettings) return cachedSettings;
    const validation = validateShippingSettings(JSON.parse(readFileSync(filePath, "utf8")));
    if (!validation.ok) return cacheSettings(filePath, mtime, { ...defaults, todayShippingEnabled:false }, checkedAt);
    cachedPath = filePath;
    cachedMtime = mtime;
    cachedSettings = validation.value;
    return cachedSettings;
  } catch (error) {
    const fallback = error?.code === "ENOENT" ? defaults : { ...defaults, todayShippingEnabled:false };
    return cacheSettings(filePath, -1, fallback, checkedAt);
  }
}

export function invalidateShippingRuntimeSettingsCache() {
  cachedPath = "";
  cachedMtime = -1;
  cachedSettings = null;
  cacheCheckedAt = 0;
}

export function getCatalogSnapshotCompletedAt(env = process.env) {
  const candidate = env.CATALOG_SNAPSHOT_UPDATED_AT || (snapshotMetaJson.status === "complete" ? snapshotMetaJson.completedAt : "");
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : "";
}

function cacheSettings(filePath, mtime, value, checkedAt) {
  cachedPath = filePath;
  cachedMtime = mtime;
  cachedSettings = value;
  cacheCheckedAt = checkedAt;
  return value;
}

export function getShippingRuntimeDiagnostic(now = new Date(), env = process.env) {
  const settings = getRuntimeShippingSettings(env);
  const completedAt = getCatalogSnapshotCompletedAt(env);
  const parsed = Date.parse(completedAt);
  const ageMinutes = Number.isFinite(parsed) ? Math.floor((now.getTime() - parsed) / 60_000) : null;
  const future = ageMinutes != null && ageMinutes < -5;
  const fresh = ageMinutes != null && !future && ageMinutes <= settings.maxSnapshotAgeMinutes;
  return {
    completedAt,
    ageMinutes,
    fresh,
    reason:!completedAt || ageMinutes == null ? "missing" : future ? "future" : fresh ? "fresh" : "stale",
    settings,
  };
}

function settingsFromEnv(env) {
  const raw = {
    revision:0,
    todayShippingEnabled:env.SHIPPING_TODAY_ENABLED !== "0",
    cutoffHour:env.SHIPPING_CUTOFF_HOUR ?? DEFAULT_SHIPPING_SETTINGS.cutoffHour,
    workingDays:String(env.SHIPPING_WORKING_DAYS || DEFAULT_SHIPPING_SETTINGS.workingDays.join(",")).split(","),
    holidays:String(env.SHIPPING_HOLIDAYS || "").split(",").map((value) => value.trim()).filter(Boolean),
    maxSnapshotAgeMinutes:env.SHIPPING_FEED_MAX_AGE_MINUTES ?? DEFAULT_SHIPPING_SETTINGS.maxSnapshotAgeMinutes,
  };
  const validation = validateShippingSettings(raw);
  return validation.ok ? validation.value : { ...DEFAULT_SHIPPING_SETTINGS, workingDays:[...DEFAULT_SHIPPING_SETTINGS.workingDays], holidays:[] };
}
