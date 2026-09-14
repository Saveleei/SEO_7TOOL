import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import { QuoteWorkflowError } from "./quoteRequestStore.ts";
import { trustAssetExists } from "./trustAssetStore.ts";
import { DEFAULT_TRUST_CONTENT_SETTINGS, type TrustCard, type TrustContentSettings } from "./trustContentModel.ts";
import { validateTrustContentSettings } from "./trustContentValidation.mjs";

export { DEFAULT_TRUST_CONTENT_SETTINGS } from "./trustContentModel.ts";
export type { TrustCard, TrustCardId, TrustContentSettings } from "./trustContentModel.ts";

type SaveInput = Omit<TrustContentSettings, "updatedAt">;
type Options = { dataDir?: string; now?: string | Date };

let settingsWriteQueue: Promise<unknown> = Promise.resolve();

export async function getTrustContentSettings(options: Options = {}): Promise<TrustContentSettings> {
  try {
    const stored = JSON.parse(await readFile(settingsPath(resolveDataDir(options.dataDir)), "utf8")) as TrustContentSettings;
    const validation = validateTrustContentSettings(stored);
    if (!validation.ok) return cloneDefaults();
    const cards = await Promise.all(validation.value.cards.map(async (card: TrustCard) => card.imageAssetId && !(await trustAssetExists(card.imageAssetId, { dataDir:resolveDataDir(options.dataDir) })) ? { ...card, imageAssetId:"" } : card));
    return { ...validation.value, cards, updatedAt:typeof stored.updatedAt === "string" ? stored.updatedAt : "" } as TrustContentSettings;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT" || error instanceof SyntaxError) return cloneDefaults();
    throw error;
  }
}

export function saveTrustContentSettings(input: SaveInput, options: Options = {}): Promise<TrustContentSettings> {
  const task = settingsWriteQueue.then(() => saveTrustContentSettingsSerial(input, options));
  settingsWriteQueue = task.catch(() => undefined);
  return task;
}

export function resetTrustContentSettings(revision: number, options: Options = {}): Promise<TrustContentSettings> {
  return saveTrustContentSettings({ ...cloneDefaults(), revision }, options);
}

async function saveTrustContentSettingsSerial(input: SaveInput, options: Options) {
  const validation = validateTrustContentSettings(input);
  if (!validation.ok) throw new QuoteWorkflowError(validation.message, 400);
  const dataDir = resolveDataDir(options.dataDir);
  const current = await getTrustContentSettings({ dataDir });
  if (validation.value.revision !== current.revision) throw new QuoteWorkflowError("Содержимое уже изменено в другой вкладке. Обновите страницу.", 409);
  for (const card of validation.value.cards) {
    if (card.imageAssetId && !(await trustAssetExists(card.imageAssetId, { dataDir }))) throw new QuoteWorkflowError(`Фотография карточки «${card.title}» не найдена. Загрузите её повторно.`, 400);
  }
  const next: TrustContentSettings = { ...validation.value, revision:current.revision + 1, updatedAt:new Date(options.now || Date.now()).toISOString() } as TrustContentSettings;
  const destination = settingsPath(dataDir);
  const directory = path.dirname(destination);
  const temporary = `${destination}.${randomUUID()}.tmp`;
  await mkdir(directory, { recursive:true });
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

function settingsPath(dataDir: string) {
  return path.join(dataDir, "settings", "trust-content.json");
}

function resolveDataDir(override?: string) {
  return override || process.env.QUOTE_TEST_DATA_DIR || path.join(process.cwd(), "work", "quote-requests");
}

function cloneDefaults(): TrustContentSettings {
  return JSON.parse(JSON.stringify(DEFAULT_TRUST_CONTENT_SETTINGS)) as TrustContentSettings;
}
