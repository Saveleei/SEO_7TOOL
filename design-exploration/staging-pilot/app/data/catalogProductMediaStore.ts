import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { mkdir, open, readFile, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { QuoteWorkflowError } from "./quoteRequestStore.ts";

const MAX_PRODUCT_MEDIA_BYTES = 5_000_000;
const ASSET_PATTERN = /^catalog-(?<hash>[0-9a-f]{64})\.(?<extension>png|jpg|webp)$/u;
const STORE_VERSION = 1;

export type CatalogProductIdentity = {
  id: string;
  slug: string;
  brand: string;
  sku: string;
  title: string;
};

export type CatalogProductMediaVersion = {
  assetId: string;
  mime: string;
  size: number;
  sha256: string;
  sourceUrl: string;
  uploadedAt: string;
  uploadedBy: string;
};

export type CatalogProductMediaEvent = {
  id: string;
  action: "upload" | "publish" | "disable" | "enable" | "restore" | "discard_draft";
  at: string;
  actor: string;
  assetId?: string;
};

export type CatalogProductMediaRecord = CatalogProductIdentity & {
  expectedBrand: string;
  expectedSku: string;
  expectedTitle: string;
  draftAssetId: string;
  publishedAssetId: string;
  disabled: boolean;
  versions: CatalogProductMediaVersion[];
  events: CatalogProductMediaEvent[];
  updatedAt: string;
};

export type CatalogProductMediaSettings = {
  version: number;
  revision: number;
  records: CatalogProductMediaRecord[];
};

type StoreOptions = { dataDir?: string; now?: string | Date };
type Actor = { id: string; name: string };

let writeQueue: Promise<unknown> = Promise.resolve();
let runtimeCache: { path: string; mtimeMs: number; settings: CatalogProductMediaSettings } | null = null;

export async function getCatalogProductMediaSettings(options: StoreOptions = {}): Promise<CatalogProductMediaSettings> {
  try {
    return validateStoredSettings(JSON.parse(await readFile(settingsPath(resolveDataDir(options.dataDir)), "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT" || error instanceof SyntaxError || error instanceof QuoteWorkflowError) return emptySettings();
    throw error;
  }
}

export async function uploadCatalogProductMedia(input: {
  product: CatalogProductIdentity;
  file: File;
  sourceUrl: unknown;
  revision: number;
  actor: Actor;
}, options: StoreOptions = {}): Promise<CatalogProductMediaSettings> {
  const task = writeQueue.then(async () => {
    const dataDir = resolveDataDir(options.dataDir);
    const current = await getCatalogProductMediaSettings({ dataDir });
    assertRevision(current, input.revision);
    const sourceUrl = normalizeSourceUrl(input.sourceUrl);
    const version = await saveAsset(input.file, sourceUrl, input.actor, dataDir, nowIso(options.now));
    const existing = current.records.find((record) => record.id === input.product.id);
    const record: CatalogProductMediaRecord = existing
      ? {
          ...existing,
          slug:input.product.slug,
          brand:input.product.brand,
          sku:input.product.sku,
          title:input.product.title,
          expectedBrand:input.product.brand,
          expectedSku:input.product.sku,
          expectedTitle:input.product.title,
          draftAssetId:version.assetId,
          versions:upsertVersion(existing.versions, version),
          events:appendEvent(existing.events, "upload", input.actor, version.assetId, version.uploadedAt),
          updatedAt:version.uploadedAt,
        }
      : {
          ...input.product,
          expectedBrand:input.product.brand,
          expectedSku:input.product.sku,
          expectedTitle:input.product.title,
          draftAssetId:version.assetId,
          publishedAssetId:"",
          disabled:false,
          versions:[version],
          events:appendEvent([], "upload", input.actor, version.assetId, version.uploadedAt),
          updatedAt:version.uploadedAt,
        };
    return persistSettings({ ...current, revision:current.revision + 1, records:upsertRecord(current.records, record) }, dataDir);
  });
  writeQueue = task.catch(() => undefined);
  return task;
}

export async function updateCatalogProductMedia(input: {
  product: CatalogProductIdentity;
  action: "publish" | "disable" | "enable" | "restore" | "discard_draft";
  assetId?: unknown;
  revision: number;
  actor: Actor;
}, options: StoreOptions = {}): Promise<CatalogProductMediaSettings> {
  const task = writeQueue.then(async () => {
    const dataDir = resolveDataDir(options.dataDir);
    const current = await getCatalogProductMediaSettings({ dataDir });
    assertRevision(current, input.revision);
    const existing = current.records.find((record) => record.id === input.product.id);
    if (!existing) throw new QuoteWorkflowError("Для товара ещё нет загруженной фотографии.", 404);
    assertExactIdentity(input.product, existing);
    const at = nowIso(options.now);
    let next = { ...existing, versions:[...existing.versions], events:[...existing.events], updatedAt:at };
    if (input.action === "publish") {
      if (!existing.draftAssetId) throw new QuoteWorkflowError("Сначала загрузите новую фотографию.", 400);
      await assertAssetExists(existing.draftAssetId, dataDir);
      next = { ...next, publishedAssetId:existing.draftAssetId, draftAssetId:"", disabled:false, events:appendEvent(next.events, "publish", input.actor, existing.draftAssetId, at) };
    } else if (input.action === "restore") {
      const assetId = normalizeAssetId(input.assetId);
      if (!existing.versions.some((version) => version.assetId === assetId)) throw new QuoteWorkflowError("Эта версия фотографии не относится к товару.", 400);
      await assertAssetExists(assetId, dataDir);
      next = { ...next, publishedAssetId:assetId, draftAssetId:"", disabled:false, events:appendEvent(next.events, "restore", input.actor, assetId, at) };
    } else if (input.action === "disable") {
      next = { ...next, disabled:true, events:appendEvent(next.events, "disable", input.actor, existing.publishedAssetId || undefined, at) };
    } else if (input.action === "enable") {
      if (!existing.publishedAssetId) throw new QuoteWorkflowError("Нет опубликованной версии для восстановления.", 400);
      await assertAssetExists(existing.publishedAssetId, dataDir);
      next = { ...next, disabled:false, events:appendEvent(next.events, "enable", input.actor, existing.publishedAssetId, at) };
    } else {
      if (!existing.draftAssetId) throw new QuoteWorkflowError("Черновика уже нет.", 400);
      next = { ...next, draftAssetId:"", events:appendEvent(next.events, "discard_draft", input.actor, existing.draftAssetId, at) };
    }
    return persistSettings({ ...current, revision:current.revision + 1, records:upsertRecord(current.records, next) }, dataDir);
  });
  writeQueue = task.catch(() => undefined);
  return task;
}

export async function readCatalogProductMediaAsset(assetId: string, options: StoreOptions = {}): Promise<{ bytes: Buffer; mime: string } | null> {
  const parsed = parseAssetId(assetId);
  if (!parsed) return null;
  try {
    const bytes = await readFile(path.join(assetDirectory(resolveDataDir(options.dataDir)), assetId));
    const detected = detectImageFormat(bytes);
    if (!detected || detected.extension !== parsed.extension || createHash("sha256").update(bytes).digest("hex") !== parsed.hash) return null;
    return { bytes, mime:detected.mime };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function catalogProductMediaAssetAccess(assetId: string, options: StoreOptions = {}): Promise<"published" | "private" | "missing"> {
  if (!parseAssetId(assetId)) return "missing";
  const settings = await getCatalogProductMediaSettings(options);
  const published = settings.records.some((record) => !record.disabled && record.publishedAssetId === assetId && matchesRecordIdentity(record, record));
  if (published) return "published";
  return settings.records.some((record) => record.versions.some((version) => version.assetId === assetId)) ? "private" : "missing";
}

export function getRuntimeCatalogProductMediaUrl(product: CatalogProductIdentity, options: StoreOptions = {}): string | undefined {
  const settings = readRuntimeSettings(resolveDataDir(options.dataDir));
  const record = settings.records.find((entry) => entry.id === product.id);
  if (!record || record.disabled || !record.publishedAssetId || !matchesRecordIdentity(product, record)) return undefined;
  if (!parseAssetId(record.publishedAssetId) || !existsSync(path.join(assetDirectory(resolveDataDir(options.dataDir)), record.publishedAssetId))) return undefined;
  return `/api/catalog-media/assets/${record.publishedAssetId}`;
}

export function catalogProductMediaState(record?: CatalogProductMediaRecord): "unmanaged" | "draft" | "published" | "disabled" {
  if (!record) return "unmanaged";
  if (record.disabled) return "disabled";
  if (record.draftAssetId) return "draft";
  return record.publishedAssetId ? "published" : "unmanaged";
}

export function catalogProductMediaAssetUrl(assetId: string): string {
  return `/api/catalog-media/assets/${encodeURIComponent(assetId)}`;
}

function readRuntimeSettings(dataDir: string): CatalogProductMediaSettings {
  const destination = settingsPath(dataDir);
  try {
    const mtimeMs = statSync(destination).mtimeMs;
    if (runtimeCache?.path === destination && runtimeCache.mtimeMs === mtimeMs) return runtimeCache.settings;
    const settings = validateStoredSettings(JSON.parse(readFileSync(destination, "utf8")));
    runtimeCache = { path:destination, mtimeMs, settings };
    return settings;
  } catch {
    return emptySettings();
  }
}

async function saveAsset(file: File, sourceUrl: string, actor: Actor, dataDir: string, uploadedAt: string): Promise<CatalogProductMediaVersion> {
  if (file.size <= 0 || file.size > MAX_PRODUCT_MEDIA_BYTES) throw new QuoteWorkflowError("Фотография должна быть не больше 5 МБ.", 413);
  const bytes = Buffer.from(await file.arrayBuffer());
  const format = detectImageFormat(bytes);
  if (!format) throw new QuoteWorkflowError("Загрузите PNG, JPG или WebP с корректным содержимым.", 400);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const assetId = `catalog-${sha256}.${format.extension}`;
  const directory = assetDirectory(dataDir);
  await mkdir(directory, { recursive:true });
  try {
    const handle = await open(path.join(directory, assetId), "wx");
    try {
      await handle.writeFile(bytes);
      await handle.sync();
    } finally {
      await handle.close();
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  return { assetId, mime:format.mime, size:bytes.length, sha256, sourceUrl, uploadedAt, uploadedBy:actorLabel(actor) };
}

async function persistSettings(settings: CatalogProductMediaSettings, dataDir: string): Promise<CatalogProductMediaSettings> {
  const destination = settingsPath(dataDir);
  const temporary = `${destination}.${randomUUID()}.tmp`;
  await mkdir(path.dirname(destination), { recursive:true });
  const handle = await open(temporary, "wx");
  try {
    await handle.writeFile(`${JSON.stringify(settings, null, 2)}\n`, "utf8");
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
  runtimeCache = null;
  return settings;
}

function validateStoredSettings(value: unknown): CatalogProductMediaSettings {
  if (!value || typeof value !== "object") throw new QuoteWorkflowError("Хранилище фотографий повреждено.", 500);
  const candidate = value as Partial<CatalogProductMediaSettings>;
  if (candidate.version !== STORE_VERSION || !Number.isInteger(candidate.revision) || !Array.isArray(candidate.records)) throw new QuoteWorkflowError("Хранилище фотографий имеет неизвестный формат.", 500);
  const records = candidate.records.filter(isStoredRecord);
  if (records.length !== candidate.records.length) throw new QuoteWorkflowError("В хранилище есть некорректная запись.", 500);
  return { version:STORE_VERSION, revision:Number(candidate.revision), records };
}

function isStoredRecord(value: unknown): value is CatalogProductMediaRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<CatalogProductMediaRecord>;
  return [record.id, record.slug, record.brand, record.sku, record.title, record.expectedBrand, record.expectedSku, record.expectedTitle, record.draftAssetId, record.publishedAssetId, record.updatedAt].every((item) => typeof item === "string")
    && typeof record.disabled === "boolean"
    && Array.isArray(record.versions)
    && Array.isArray(record.events)
    && record.versions.every((version) => Boolean(version && parseAssetId(version.assetId) && typeof version.sourceUrl === "string" && typeof version.uploadedAt === "string"));
}

function emptySettings(): CatalogProductMediaSettings {
  return { version:STORE_VERSION, revision:0, records:[] };
}

function assertRevision(settings: CatalogProductMediaSettings, revision: number) {
  if (!Number.isInteger(revision) || revision !== settings.revision) throw new QuoteWorkflowError("Фотографии уже изменены в другой вкладке. Обновите страницу.", 409);
}

function assertExactIdentity(product: CatalogProductIdentity, record: CatalogProductMediaRecord) {
  if (!matchesRecordIdentity(product, record)) throw new QuoteWorkflowError("Название, бренд или артикул товара изменились. Загрузите фотографию заново после проверки.", 409);
}

function matchesRecordIdentity(product: CatalogProductIdentity, record: CatalogProductMediaRecord): boolean {
  return product.id === record.id && product.brand === record.expectedBrand && product.sku === record.expectedSku && product.title === record.expectedTitle;
}

async function assertAssetExists(assetId: string, dataDir: string) {
  if (!parseAssetId(assetId)) throw new QuoteWorkflowError("Некорректный идентификатор фотографии.", 400);
  try {
    const file = await stat(path.join(assetDirectory(dataDir), assetId));
    if (!file.isFile() || file.size <= 0 || file.size > MAX_PRODUCT_MEDIA_BYTES) throw new QuoteWorkflowError("Файл фотографии недоступен.", 400);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new QuoteWorkflowError("Файл фотографии не найден.", 400);
    throw error;
  }
}

function normalizeSourceUrl(value: unknown): string {
  const raw = typeof value === "string" ? value.trim().slice(0, 1000) : "";
  try {
    const parsed = new URL(raw);
    if (!/^https?:$/u.test(parsed.protocol) || parsed.username || parsed.password) throw new Error("invalid");
    return parsed.toString();
  } catch {
    throw new QuoteWorkflowError("Укажите публичную ссылку на точную страницу производителя или поставщика.", 400);
  }
}

function normalizeAssetId(value: unknown): string {
  const assetId = typeof value === "string" ? value : "";
  if (!parseAssetId(assetId)) throw new QuoteWorkflowError("Некорректная версия фотографии.", 400);
  return assetId;
}

function parseAssetId(assetId: string) {
  return ASSET_PATTERN.exec(assetId)?.groups as { hash: string; extension: "png" | "jpg" | "webp" } | undefined;
}

function detectImageFormat(bytes: Buffer): { extension: "png" | "jpg" | "webp"; mime: string } | null {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { extension:"png", mime:"image/png" };
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { extension:"jpg", mime:"image/jpeg" };
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") return { extension:"webp", mime:"image/webp" };
  return null;
}

function appendEvent(events: CatalogProductMediaEvent[], action: CatalogProductMediaEvent["action"], actor: Actor, assetId: string | undefined, at: string): CatalogProductMediaEvent[] {
  return [...events, { id:randomUUID(), action, at, actor:actorLabel(actor), ...(assetId ? { assetId } : {}) }].slice(-80);
}

function actorLabel(actor: Actor): string {
  return `${actor.name || "Администратор"} (${actor.id})`.slice(0, 240);
}

function upsertVersion(versions: CatalogProductMediaVersion[], version: CatalogProductMediaVersion): CatalogProductMediaVersion[] {
  return [...versions.filter((item) => item.assetId !== version.assetId), version].slice(-20);
}

function upsertRecord(records: CatalogProductMediaRecord[], record: CatalogProductMediaRecord): CatalogProductMediaRecord[] {
  return [...records.filter((item) => item.id !== record.id), record].sort((first, second) => first.title.localeCompare(second.title, "ru-RU"));
}

function settingsPath(dataDir: string): string {
  return path.join(dataDir, "settings", "catalog-product-media.json");
}

function assetDirectory(dataDir: string): string {
  return path.join(dataDir, "settings", "catalog-product-media-assets");
}

function resolveDataDir(override?: string): string {
  return override || process.env.QUOTE_TEST_DATA_DIR || path.join(process.cwd(), "work", "quote-requests");
}

function nowIso(value?: string | Date): string {
  return new Date(value || Date.now()).toISOString();
}
