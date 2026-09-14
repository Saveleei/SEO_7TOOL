const DEFAULT_TIME_ZONE = "Europe/Moscow";
const DEFAULT_CUTOFF_HOUR = 18;
const DEFAULT_WORKING_DAYS = Object.freeze([1, 2, 3, 4, 5]);

/**
 * A promise shown to the buyer. It is deliberately derived only from an exact,
 * positive supplier-feed quantity and the server clock.
 *
 * @typedef {{
 *   available: boolean;
 *   state: "today" | "next-working-day" | "unconfirmed";
 *   label: string;
 *   shipmentLabel: string;
 *   detail: string;
 *   cutoffHour: number;
 *   timeZone: string;
 * }} ShippingPromise
 */

/**
 * @param {{ available?: unknown; quantity?: unknown } | null | undefined} variant
 */
export function hasConfirmedStock(variant) {
  return variant?.available === true
    && typeof variant.quantity === "number"
    && Number.isFinite(variant.quantity)
    && variant.quantity > 0;
}

/**
 * @param {{ available?: unknown; quantity?: unknown } | null | undefined} variant
 * @param {{ now?: Date; cutoffHour?: number; workingDays?: number[] | string; timeZone?: string; env?: Record<string, string | undefined> }} [options]
 * @returns {ShippingPromise}
 */
export function getVariantShippingPromise(variant, options = {}) {
  return getShippingPromiseForConfirmedStock(hasConfirmedStock(variant), options);
}

/**
 * Product-group cards can only promise shipping for the executions that have an
 * exact positive quantity. The count remains visible next to this presentation.
 *
 * @param {Array<{ available?: unknown; quantity?: unknown }>} variants
 * @param {{ now?: Date; cutoffHour?: number; workingDays?: number[] | string; timeZone?: string; env?: Record<string, string | undefined> }} [options]
 * @returns {ShippingPromise}
 */
export function getProductShippingPromise(variants, options = {}) {
  return getShippingPromiseForConfirmedStock(Array.isArray(variants) && variants.some(hasConfirmedStock), options);
}

/**
 * @param {boolean} confirmed
 * @param {{ now?: Date; cutoffHour?: number; workingDays?: number[] | string; timeZone?: string; env?: Record<string, string | undefined> }} [options]
 * @returns {ShippingPromise}
 */
export function getShippingPromiseForConfirmedStock(confirmed, options = {}) {
  const config = resolveShippingConfig(options);
  if (!confirmed) {
    return {
      available:false,
      state:"unconfirmed",
      label:"Наличие и срок уточняем",
      shipmentLabel:"",
      detail:"Менеджер подтвердит остаток и ближайшую дату отгрузки",
      cutoffHour:config.cutoffHour,
      timeZone:config.timeZone,
    };
  }

  const clock = getZonedClock(options.now ?? new Date(), config.timeZone);
  const shipsToday = config.workingDays.includes(clock.weekday) && clock.hour < config.cutoffHour;
  if (shipsToday) {
    return {
      available:true,
      state:"today",
      label:"В наличии · Отгрузка сегодня",
      shipmentLabel:"Отгрузка сегодня",
      detail:`Для заказов до ${formatHour(config.cutoffHour)} по Москве`,
      cutoffHour:config.cutoffHour,
      timeZone:config.timeZone,
    };
  }

  return {
    available:true,
    state:"next-working-day",
    label:"В наличии · Отгрузка в следующий рабочий день",
    shipmentLabel:"Отгрузка в следующий рабочий день",
    detail:"Ближайшая отгрузка — в следующий рабочий день",
    cutoffHour:config.cutoffHour,
    timeZone:config.timeZone,
  };
}

/**
 * @param {{ cutoffHour?: number; workingDays?: number[] | string; timeZone?: string; env?: Record<string, string | undefined> }} options
 */
export function resolveShippingConfig(options = {}) {
  const env = options.env ?? runtimeEnv();
  return {
    cutoffHour:normalizeCutoff(options.cutoffHour ?? env.SHIPPING_CUTOFF_HOUR),
    workingDays:normalizeWorkingDays(options.workingDays ?? env.SHIPPING_WORKING_DAYS),
    timeZone:normalizeTimeZone(options.timeZone ?? env.SHIPPING_TIME_ZONE),
  };
}

function runtimeEnv() {
  return typeof process !== "undefined" && process.env ? process.env : {};
}

function normalizeCutoff(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 23 ? parsed : DEFAULT_CUTOFF_HOUR;
}

function normalizeWorkingDays(value) {
  const candidate = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : DEFAULT_WORKING_DAYS;
  const days = Array.from(new Set(candidate.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)));
  return days.length > 0 ? days : [...DEFAULT_WORKING_DAYS];
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
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday:"short",
    hour:"2-digit",
    hourCycle:"h23",
  }).formatToParts(now);
  const weekdayName = parts.find((part) => part.type === "weekday")?.value ?? "Sun";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  return { weekday:({ Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 })[weekdayName] ?? 0, hour };
}

function formatHour(hour) {
  return `${String(hour).padStart(2, "0")}:00`;
}
