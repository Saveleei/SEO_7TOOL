import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import { QuoteWorkflowError } from "./quoteRequestStore.ts";
import { DEFAULT_SHIPPING_SETTINGS, validateShippingSettings } from "./shippingSettingsValidation.mjs";

export type ShippingSettings = {
  revision: number;
  updatedAt: string;
  todayShippingEnabled: boolean;
  cutoffHour: number;
  workingDays: number[];
  holidays: string[];
  maxSnapshotAgeMinutes: number;
};

type SaveInput = Omit<ShippingSettings, "updatedAt">;
type Options = { dataDir?: string; now?: string | Date };

let settingsWriteQueue: Promise<unknown> = Promise.resolve();

export async function getShippingSettings(options: Options = {}): Promise<ShippingSettings> {
  try {
    const stored = JSON.parse(await readFile(shippingSettingsPath(options.dataDir), "utf8")) as ShippingSettings;
    const validation = validateShippingSettings(stored);
    if (!validation.ok) return cloneDefaults();
    return { ...validation.value, updatedAt:typeof stored.updatedAt === "string" ? stored.updatedAt : "" } as ShippingSettings;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT" || error instanceof SyntaxError) return cloneDefaults();
    throw error;
  }
}

export function saveShippingSettings(input: SaveInput, options: Options = {}): Promise<ShippingSettings> {
  const task = settingsWriteQueue.then(() => saveShippingSettingsSerial(input, options));
  settingsWriteQueue = task.catch(() => undefined);
  return task;
}

async function saveShippingSettingsSerial(input: SaveInput, options: Options): Promise<ShippingSettings> {
  const validation = validateShippingSettings(input);
  if (!validation.ok) throw new QuoteWorkflowError(validation.message, 400);
  const current = await getShippingSettings({ dataDir:options.dataDir });
  if (validation.value.revision !== current.revision) throw new QuoteWorkflowError("Настройки уже изменены в другой вкладке. Обновите страницу.", 409);
  const next = { ...validation.value, revision:current.revision + 1, updatedAt:new Date(options.now || Date.now()).toISOString() } as ShippingSettings;
  const destination = shippingSettingsPath(options.dataDir);
  const temporary = `${destination}.${randomUUID()}.tmp`;
  await mkdir(path.dirname(destination), { recursive:true });
  const handle = await open(temporary, "wx");
  try {
    await handle.writeFile(`${JSON.stringify(next, null, 2)}\n`, { encoding:"utf8" });
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await rename(temporary, destination);
  } catch (error) {
    await rm(temporary, { force:true });
    throw error;
  }
  return next;
}

export function shippingSettingsPath(dataDir?: string): string {
  if (dataDir) return path.join(dataDir, "settings", "shipping.json");
  return process.env.SHIPPING_SETTINGS_PATH || path.join(resolveDataDir(), "settings", "shipping.json");
}

function resolveDataDir(): string {
  return process.env.QUOTE_DATA_DIR || process.env.QUOTE_TEST_DATA_DIR || path.join(process.cwd(), "work", "quote-requests");
}

function cloneDefaults(): ShippingSettings {
  const validation = validateShippingSettings({
    revision:0,
    todayShippingEnabled:process.env.SHIPPING_TODAY_ENABLED !== "0",
    cutoffHour:process.env.SHIPPING_CUTOFF_HOUR ?? DEFAULT_SHIPPING_SETTINGS.cutoffHour,
    workingDays:String(process.env.SHIPPING_WORKING_DAYS || DEFAULT_SHIPPING_SETTINGS.workingDays.join(",")).split(","),
    holidays:String(process.env.SHIPPING_HOLIDAYS || "").split(",").map((value) => value.trim()).filter(Boolean),
    maxSnapshotAgeMinutes:process.env.SHIPPING_FEED_MAX_AGE_MINUTES ?? DEFAULT_SHIPPING_SETTINGS.maxSnapshotAgeMinutes,
  });
  const value = validation.ok ? validation.value : DEFAULT_SHIPPING_SETTINGS;
  return { ...value, workingDays:[...value.workingDays], holidays:[...value.holidays], updatedAt:"" };
}
