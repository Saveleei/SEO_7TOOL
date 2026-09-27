import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import { homepageAssetExists } from "./homepageAssetStore.ts";
import { DEFAULT_HOMEPAGE_CONTENT_SETTINGS, type HomepageContentSettings, type HomepageMediaItem } from "./homepageContentModel.ts";
import { QuoteWorkflowError } from "./quoteRequestStore.ts";
import { validateHomepageContentSettings } from "./homepageContentValidation.mjs";

export { DEFAULT_HOMEPAGE_CONTENT_SETTINGS } from "./homepageContentModel.ts";
export type { HomepageContentSettings, HomepageImageFit, HomepageImagePosition, HomepageMediaItem, HomepageTextSection } from "./homepageContentModel.ts";

type SaveInput = Omit<HomepageContentSettings, "updatedAt">;
type Options = { dataDir?: string; now?: string | Date };

let settingsWriteQueue: Promise<unknown> = Promise.resolve();

export async function getHomepageContentSettings(options: Options = {}): Promise<HomepageContentSettings> {
  try {
    const stored = JSON.parse(await readFile(settingsPath(resolveDataDir(options.dataDir)), "utf8")) as HomepageContentSettings;
    const validation = validateHomepageContentSettings(stored);
    if (!validation.ok) return cloneDefaults();
    const dataDir = resolveDataDir(options.dataDir);
    const assortmentItems = await removeMissingAssets(validation.value.assortmentItems, dataDir);
    const categoryItems = await removeMissingAssets(validation.value.categoryItems, dataDir);
    const categories = validation.value.categories.title === "Основные разделы каталога"
      ? { ...validation.value.categories, title:DEFAULT_HOMEPAGE_CONTENT_SETTINGS.categories.title }
      : validation.value.categories;
    return { ...validation.value, categories, assortmentItems, categoryItems, updatedAt:typeof stored.updatedAt === "string" ? stored.updatedAt : "" } as HomepageContentSettings;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT" || error instanceof SyntaxError) return cloneDefaults();
    throw error;
  }
}

export function saveHomepageContentSettings(input: SaveInput, options: Options = {}): Promise<HomepageContentSettings> {
  const task = settingsWriteQueue.then(() => saveHomepageContentSettingsSerial(input, options));
  settingsWriteQueue = task.catch(() => undefined);
  return task;
}

export function resetHomepageContentSettings(revision: number, options: Options = {}): Promise<HomepageContentSettings> {
  return saveHomepageContentSettings({ ...cloneDefaults(), revision }, options);
}

async function saveHomepageContentSettingsSerial(input: SaveInput, options: Options) {
  const validation = validateHomepageContentSettings(input);
  if (!validation.ok) throw new QuoteWorkflowError(validation.message, 400);
  const dataDir = resolveDataDir(options.dataDir);
  const current = await getHomepageContentSettings({ dataDir });
  if (validation.value.revision !== current.revision) throw new QuoteWorkflowError("Главная страница уже изменена в другой вкладке. Обновите страницу.", 409);
  for (const item of [...validation.value.assortmentItems, ...validation.value.categoryItems]) {
    if (item.imageAssetId && !(await homepageAssetExists(item.imageAssetId, { dataDir }))) throw new QuoteWorkflowError(`Фотография «${item.title}» не найдена. Загрузите её повторно.`, 400);
  }
  const next: HomepageContentSettings = { ...validation.value, revision:current.revision + 1, updatedAt:new Date(options.now || Date.now()).toISOString() } as HomepageContentSettings;
  const destination = settingsPath(dataDir);
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

async function removeMissingAssets(items: HomepageMediaItem[], dataDir: string): Promise<HomepageMediaItem[]> {
  return Promise.all(items.map(async (item) => item.imageAssetId && !(await homepageAssetExists(item.imageAssetId, { dataDir })) ? { ...item, imageAssetId:"" } : item));
}

function settingsPath(dataDir: string) {
  return path.join(dataDir, "settings", "homepage-content.json");
}

function resolveDataDir(override?: string) {
  return override || process.env.QUOTE_TEST_DATA_DIR || path.join(process.cwd(), "work", "quote-requests");
}

function cloneDefaults(): HomepageContentSettings {
  return JSON.parse(JSON.stringify(DEFAULT_HOMEPAGE_CONTENT_SETTINGS)) as HomepageContentSettings;
}
