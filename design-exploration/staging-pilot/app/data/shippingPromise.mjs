import { getCatalogSnapshotCompletedAt, getRuntimeShippingSettings } from "./shippingRuntimeSettings.mjs";

const DEFAULT_TIME_ZONE = "Europe/Moscow";

/**
 * A buyer-facing promise derived only from exact positive stock, a fresh
 * catalog snapshot, the server clock and administrator-owned rules.
 *
 * @typedef {{
 *   available: boolean;
 *   state: "today" | "next-working-day" | "unconfirmed";
 *   reason: "none" | "stock-unconfirmed" | "shipping-disabled" | "feed-missing" | "feed-stale" | "feed-future";
 *   label: string;
 *   shipmentLabel: string;
 *   detail: string;
 *   cutoffHour: number;
 *   timeZone: string;
 * }} ShippingPromise
 */

/** @param {{ available?: unknown; quantity?: unknown } | null | undefined} variant */
export function hasConfirmedStock(variant) {
  return variant?.available === true
    && typeof variant.quantity === "number"
    && Number.isFinite(variant.quantity)
    && variant.quantity > 0;
}

/**
 * @param {{ available?: unknown; quantity?: unknown } | null | undefined} variant
 * @param {ShippingOptions} [options]
 * @returns {ShippingPromise}
 */
export function getVariantShippingPromise(variant, options = {}) {
  return getShippingPromiseForConfirmedStock(hasConfirmedStock(variant), options);
}

/**
 * @param {Array<{ available?: unknown; quantity?: unknown }>} variants
 * @param {ShippingOptions} [options]
 * @returns {ShippingPromise}
 */
export function getProductShippingPromise(variants, options = {}) {
  return getShippingPromiseForConfirmedStock(Array.isArray(variants) && variants.some(hasConfirmedStock), options);
}

/**
 * @typedef {{
 *   now?: Date;
 *   cutoffHour?: number;
 *   workingDays?: number[] | string;
 *   holidays?: string[] | string;
 *   timeZone?: string;
 *   todayShippingEnabled?: boolean;
 *   maxSnapshotAgeMinutes?: number;
 *   feedUpdatedAt?: string;
 *   env?: Record<string, string | undefined>;
 * }} ShippingOptions
 */

/**
 * @param {boolean} confirmed
 * @param {ShippingOptions} [options]
 * @returns {ShippingPromise}
 */
export function getShippingPromiseForConfirmedStock(confirmed, options = {}) {
  const config = resolveShippingConfig(options);
  if (!confirmed) return unconfirmedPromise(config, "stock-unconfirmed", "Менеджер подтвердит остаток и ближайшую дату отгрузки");
  if (!config.todayShippingEnabled) return unconfirmedPromise(config, "shipping-disabled", "Менеджер подтвердит остаток и дату отгрузки");

  const now = options.now ?? new Date();
  const freshness = getFeedFreshness(config.feedUpdatedAt, now, config.maxSnapshotAgeMinutes);
  if (!freshness.fresh) {
    const reason = freshness.reason === "missing" ? "feed-missing" : freshness.reason === "future" ? "feed-future" : "feed-stale";
    return unconfirmedPromise(config, reason, "Менеджер проверит актуальный остаток и дату отгрузки");
  }

  const clock = getZonedClock(now, config.timeZone);
  const shipsToday = config.workingDays.includes(clock.weekday)
    && !config.holidays.includes(dateKey(clock))
    && clock.hour < config.cutoffHour;
  if (shipsToday) {
    return {
      available:true,
      state:"today",
      reason:"none",
      label:"В наличии · Отгрузка сегодня",
      shipmentLabel:"Отгрузка сегодня",
      detail:`Для заказов до ${formatHour(config.cutoffHour)} по Москве`,
      cutoffHour:config.cutoffHour,
      timeZone:config.timeZone,
    };
  }

  const nextDate = nextWorkingDate(clock, config.workingDays, config.holidays);
  return {
    available:true,
    state:"next-working-day",
    reason:"none",
    label:"В наличии · Отгрузка в следующий рабочий день",
    shipmentLabel:"Отгрузка в следующий рабочий день",
    detail:nextDate ? `Ближайшая плановая отгрузка — ${formatRussianDate(nextDate)}` : "Ближайшую дату подтвердит менеджер",
    cutoffHour:config.cutoffHour,
    timeZone:config.timeZone,
  };
}

/** @param {ShippingOptions} options */
export function resolveShippingConfig(options = {}) {
  const env = options.env ?? runtimeEnv();
  const settings = getRuntimeShippingSettings(env);
  return {
    cutoffHour:normalizeCutoff(options.cutoffHour ?? settings.cutoffHour),
    workingDays:normalizeWorkingDays(options.workingDays ?? settings.workingDays),
    holidays:normalizeHolidays(options.holidays ?? settings.holidays),
    timeZone:normalizeTimeZone(options.timeZone ?? env.SHIPPING_TIME_ZONE),
    todayShippingEnabled:typeof options.todayShippingEnabled === "boolean" ? options.todayShippingEnabled : settings.todayShippingEnabled,
    maxSnapshotAgeMinutes:normalizeMaxAge(options.maxSnapshotAgeMinutes ?? settings.maxSnapshotAgeMinutes),
    feedUpdatedAt:String(options.feedUpdatedAt ?? getCatalogSnapshotCompletedAt(env) ?? "").trim(),
  };
}

export function getFeedFreshness(feedUpdatedAt, now = new Date(), maxAgeMinutes = 180) {
  const parsed = Date.parse(String(feedUpdatedAt || ""));
  if (!Number.isFinite(parsed)) return { fresh:false, reason:"missing", ageMinutes:null };
  const ageMinutes = Math.floor((now.getTime() - parsed) / 60_000);
  if (ageMinutes < -5) return { fresh:false, reason:"future", ageMinutes };
  const fresh = ageMinutes <= normalizeMaxAge(maxAgeMinutes);
  return { fresh, reason:fresh ? "fresh" : "stale", ageMinutes };
}

function unconfirmedPromise(config, reason, detail) {
  return {
    available:false,
    state:"unconfirmed",
    reason,
    label:"Наличие и срок уточняем",
    shipmentLabel:"",
    detail,
    cutoffHour:config.cutoffHour,
    timeZone:config.timeZone,
  };
}

function runtimeEnv() {
  return typeof process !== "undefined" && process.env ? process.env : {};
}

function normalizeCutoff(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 23 ? parsed : 18;
}

function normalizeMaxAge(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 15 && parsed <= 1440 ? parsed : 180;
}

function normalizeWorkingDays(value) {
  const candidate = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [1, 2, 3, 4, 5];
  const days = Array.from(new Set(candidate.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))).sort((a, b) => a - b);
  return days.length > 0 ? days : [1, 2, 3, 4, 5];
}

function normalizeHolidays(value) {
  const candidate = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  return Array.from(new Set(candidate.map((item) => String(item).trim()).filter((item) => /^\d{4}-\d{2}-\d{2}$/u.test(item)))).sort();
}

function normalizeTimeZone(value) {
  if (typeof value !== "string" || !value.trim()) return DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("ru-RU", { timeZone:value }).format(new Date(0));
    return value;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

function getZonedClock(now, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    weekday:"short",
    year:"numeric",
    month:"2-digit",
    day:"2-digit",
    hour:"2-digit",
    hourCycle:"h23",
  }).formatToParts(now);
  const value = (type) => parts.find((part) => part.type === type)?.value ?? "";
  const weekdayName = value("weekday") || "Sun";
  return {
    weekday:({ Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 })[weekdayName] ?? 0,
    year:Number(value("year")),
    month:Number(value("month")),
    day:Number(value("day")),
    hour:Number(value("hour")),
  };
}

function nextWorkingDate(clock, workingDays, holidays) {
  const start = Date.UTC(clock.year, clock.month - 1, clock.day);
  for (let offset = 1; offset <= 370; offset += 1) {
    const candidate = new Date(start + offset * 86_400_000);
    const key = `${candidate.getUTCFullYear()}-${String(candidate.getUTCMonth() + 1).padStart(2, "0")}-${String(candidate.getUTCDate()).padStart(2, "0")}`;
    if (workingDays.includes(candidate.getUTCDay()) && !holidays.includes(key)) return candidate;
  }
  return null;
}

function dateKey(clock) {
  return `${clock.year}-${String(clock.month).padStart(2, "0")}-${String(clock.day).padStart(2, "0")}`;
}

function formatRussianDate(date) {
  return new Intl.DateTimeFormat("ru-RU", { day:"numeric", month:"long", timeZone:"UTC" }).format(date);
}

function formatHour(hour) {
  return `${String(hour).padStart(2, "0")}:00`;
}
