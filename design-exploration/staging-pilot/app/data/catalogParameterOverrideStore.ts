import { randomUUID } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import { QuoteWorkflowError } from "./quoteRequestStore.ts";

const STORE_VERSION = 1;
const MAX_PARAMETERS = 40;

export type CatalogParameterProductIdentity = {
  id: string;
  slug: string;
  brand: string;
  sku: string;
  title: string;
  variants: Array<{ id: string; sku: string; name?: string }>;
};

export type CatalogParameterOverride = {
  target: "product" | "variant";
  variantId?: string;
  name: string;
  value: string;
  unit?: string;
};

export type CatalogParameterOverrideVersion = {
  id: string;
  parameters: CatalogParameterOverride[];
  sourceUrl: string;
  note: string;
  createdAt: string;
  createdBy: string;
};

export type CatalogParameterOverrideEvent = {
  id: string;
  action: "save_draft" | "publish" | "discard_draft" | "disable" | "enable" | "restore";
  at: string;
  actor: string;
  versionId?: string;
};

export type CatalogParameterOverrideRecord = Omit<CatalogParameterProductIdentity, "variants"> & {
  expectedBrand: string;
  expectedSku: string;
  expectedTitle: string;
  draftVersionId: string;
  publishedVersionId: string;
  disabled: boolean;
  versions: CatalogParameterOverrideVersion[];
  events: CatalogParameterOverrideEvent[];
  updatedAt: string;
};

export type CatalogParameterOverrideSettings = {
  version: number;
  revision: number;
  records: CatalogParameterOverrideRecord[];
};

type StoreOptions = { dataDir?: string; now?: string | Date };
type Actor = { id: string; name: string };
type RuntimeProduct = Omit<CatalogParameterProductIdentity, "variants"> & {
  variants: Array<{ id: string; sku: string; name?: string; params: Array<{ name: string; value: string; unit?: string; derivedFromTitle?: true; manualOverride?: true }> }>;
  paramAxes?: string[];
};

let writeQueue: Promise<unknown> = Promise.resolve();
let runtimeCache: { path: string; mtimeMs: number; size: number; settings: CatalogParameterOverrideSettings } | null = null;

export async function getCatalogParameterOverrideSettings(options: StoreOptions = {}): Promise<CatalogParameterOverrideSettings> {
  try {
    return validateStoredSettings(JSON.parse(await readFile(settingsPath(resolveDataDir(options.dataDir)), "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptySettings();
    throw error;
  }
}

export async function saveCatalogParameterOverrideDraft(input: {
  product: CatalogParameterProductIdentity;
  parameters: unknown;
  sourceUrl: unknown;
  note?: unknown;
  revision: number;
  actor: Actor;
}, options: StoreOptions = {}): Promise<CatalogParameterOverrideSettings> {
  const task = writeQueue.then(async () => {
    const dataDir = resolveDataDir(options.dataDir);
    const current = await getCatalogParameterOverrideSettings({ dataDir });
    assertRevision(current, input.revision);
    const existing = current.records.find((record) => record.id === input.product.id);
    if (existing) assertExactIdentity(input.product, existing);
    const at = nowIso(options.now);
    const version: CatalogParameterOverrideVersion = {
      id:randomUUID(),
      parameters:normalizeParameters(input.parameters, input.product),
      sourceUrl:normalizeSourceUrl(input.sourceUrl),
      note:cleanText(input.note, 600),
      createdAt:at,
      createdBy:actorLabel(input.actor),
    };
    const record: CatalogParameterOverrideRecord = existing
      ? {
          ...existing,
          slug:input.product.slug,
          brand:input.product.brand,
          sku:input.product.sku,
          title:input.product.title,
          expectedBrand:input.product.brand,
          expectedSku:input.product.sku,
          expectedTitle:input.product.title,
          draftVersionId:version.id,
          versions:[...existing.versions, version],
          events:appendEvent(existing.events, "save_draft", input.actor, version.id, at),
          updatedAt:at,
        }
      : {
          id:input.product.id,
          slug:input.product.slug,
          brand:input.product.brand,
          sku:input.product.sku,
          title:input.product.title,
          expectedBrand:input.product.brand,
          expectedSku:input.product.sku,
          expectedTitle:input.product.title,
          draftVersionId:version.id,
          publishedVersionId:"",
          disabled:false,
          versions:[version],
          events:appendEvent([], "save_draft", input.actor, version.id, at),
          updatedAt:at,
        };
    return persistSettings({ ...current, revision:current.revision + 1, records:upsertRecord(current.records, record) }, dataDir);
  });
  writeQueue = task.catch(() => undefined);
  return task;
}

export async function updateCatalogParameterOverride(input: {
  product: CatalogParameterProductIdentity;
  action: "publish" | "discard_draft" | "disable" | "enable" | "restore";
  versionId?: unknown;
  revision: number;
  actor: Actor;
}, options: StoreOptions = {}): Promise<CatalogParameterOverrideSettings> {
  const task = writeQueue.then(async () => {
    const dataDir = resolveDataDir(options.dataDir);
    const current = await getCatalogParameterOverrideSettings({ dataDir });
    assertRevision(current, input.revision);
    const existing = current.records.find((record) => record.id === input.product.id);
    if (!existing) throw new QuoteWorkflowError("Для товара ещё нет черновика характеристик.", 404);
    assertExactIdentity(input.product, existing);
    const at = nowIso(options.now);
    let next = { ...existing, versions:[...existing.versions], events:[...existing.events], updatedAt:at };
    if (input.action === "publish") {
      const version = versionById(existing, existing.draftVersionId, "Сначала сохраните черновик характеристик.");
      assertVersionTargets(version, input.product);
      next = { ...next, publishedVersionId:version.id, draftVersionId:"", disabled:false, events:appendEvent(next.events, "publish", input.actor, version.id, at) };
    } else if (input.action === "restore") {
      const version = versionById(existing, normalizeVersionId(input.versionId), "Выбранная версия не найдена.");
      assertVersionTargets(version, input.product);
      next = { ...next, publishedVersionId:version.id, draftVersionId:"", disabled:false, events:appendEvent(next.events, "restore", input.actor, version.id, at) };
    } else if (input.action === "disable") {
      if (!existing.publishedVersionId) throw new QuoteWorkflowError("Нет опубликованной версии для отключения.", 400);
      next = { ...next, disabled:true, events:appendEvent(next.events, "disable", input.actor, existing.publishedVersionId, at) };
    } else if (input.action === "enable") {
      const version = versionById(existing, existing.publishedVersionId, "Нет опубликованной версии для включения.");
      assertVersionTargets(version, input.product);
      next = { ...next, disabled:false, events:appendEvent(next.events, "enable", input.actor, version.id, at) };
    } else {
      if (!existing.draftVersionId) throw new QuoteWorkflowError("Черновика уже нет.", 400);
      next = { ...next, draftVersionId:"", events:appendEvent(next.events, "discard_draft", input.actor, existing.draftVersionId, at) };
    }
    return persistSettings({ ...current, revision:current.revision + 1, records:upsertRecord(current.records, next) }, dataDir);
  });
  writeQueue = task.catch(() => undefined);
  return task;
}

export function applyRuntimeCatalogParameterOverrides<T extends RuntimeProduct>(product: T, options: StoreOptions = {}): T {
  const settings = readRuntimeSettings(resolveDataDir(options.dataDir));
  return applyPublishedVersion(product, settings.records.find((entry) => entry.id === product.id));
}

export function applyRuntimeCatalogParameterOverridesToProducts<T extends RuntimeProduct>(products: T[], options: StoreOptions = {}): T[] {
  const settings = readRuntimeSettings(resolveDataDir(options.dataDir));
  if (settings.records.length === 0) return products;
  const records = new Map(settings.records.map((record) => [record.id, record]));
  return products.map((product) => applyPublishedVersion(product, records.get(product.id)));
}

function applyPublishedVersion<T extends RuntimeProduct>(product: T, record?: CatalogParameterOverrideRecord): T {
  if (!record || record.disabled || !record.publishedVersionId || !matchesRecordIdentity(product, record)) return product;
  const version = record.versions.find((entry) => entry.id === record.publishedVersionId);
  if (!version) return product;
  const common = version.parameters.filter((parameter) => parameter.target === "product");
  const variants = product.variants.map((variant) => {
    const specific = version.parameters.filter((parameter) => parameter.target === "variant" && parameter.variantId === variant.id);
    return { ...variant, params:mergeParameters(variant.params, [...common, ...specific]) };
  });
  const overrideNames = version.parameters.map((parameter) => parameter.name);
  return { ...product, variants, paramAxes:Array.from(new Set([...(product.paramAxes ?? []), ...overrideNames])) } as T;
}

export function getRuntimeCatalogParameterOverrideRevision(options: StoreOptions = {}): number {
  return readRuntimeSettings(resolveDataDir(options.dataDir)).revision;
}

export function catalogParameterOverrideState(record?: CatalogParameterOverrideRecord): "unmanaged" | "draft" | "published" | "disabled" {
  if (!record) return "unmanaged";
  if (record.disabled) return "disabled";
  if (record.draftVersionId) return "draft";
  return record.publishedVersionId ? "published" : "unmanaged";
}

function mergeParameters(current: RuntimeProduct["variants"][number]["params"], overrides: CatalogParameterOverride[]) {
  const merged = current.map((parameter) => ({ ...parameter }));
  for (const override of overrides) {
    const index = merged.findIndex((parameter) => normalizeKey(parameter.name) === normalizeKey(override.name));
    const parameter = { name:override.name, value:override.value, ...(override.unit ? { unit:override.unit } : {}), manualOverride:true as const };
    if (index >= 0) merged[index] = parameter;
    else merged.push(parameter);
  }
  return merged;
}

function normalizeParameters(value: unknown, product: CatalogParameterProductIdentity): CatalogParameterOverride[] {
  if (!Array.isArray(value) || value.length === 0) throw new QuoteWorkflowError("Добавьте хотя бы одну проверенную характеристику.", 400);
  if (value.length > MAX_PARAMETERS) throw new QuoteWorkflowError(`За один черновик можно добавить не больше ${MAX_PARAMETERS} характеристик.`, 400);
  const variantIds = new Set(product.variants.map((variant) => variant.id));
  const seen = new Set<string>();
  return value.map((raw) => {
    if (!raw || typeof raw !== "object") throw new QuoteWorkflowError("Некорректная строка характеристики.", 400);
    const candidate = raw as Partial<CatalogParameterOverride>;
    const target = candidate.target === "product" || candidate.target === "variant" ? candidate.target : "";
    const variantId = target === "variant" ? cleanText(candidate.variantId, 180) : "";
    const name = cleanText(candidate.name, 120);
    const parameterValue = cleanText(candidate.value, 240);
    const unit = cleanText(candidate.unit, 30);
    if (!target || !name || !parameterValue) throw new QuoteWorkflowError("Для каждой характеристики укажите область, название и значение.", 400);
    if (target === "variant" && !variantIds.has(variantId)) throw new QuoteWorkflowError("Выбранное исполнение отсутствует в текущем фиде.", 409);
    const key = `${target}:${variantId}:${normalizeKey(name)}`;
    if (seen.has(key)) throw new QuoteWorkflowError(`Характеристика «${name}» указана для одной области дважды.`, 400);
    seen.add(key);
    return { target, ...(variantId ? { variantId } : {}), name, value:parameterValue, ...(unit ? { unit } : {}) };
  });
}

function assertVersionTargets(version: CatalogParameterOverrideVersion, product: CatalogParameterProductIdentity) {
  normalizeParameters(version.parameters, product);
}

function versionById(record: CatalogParameterOverrideRecord, id: string, message: string): CatalogParameterOverrideVersion {
  const version = record.versions.find((entry) => entry.id === id);
  if (!version) throw new QuoteWorkflowError(message, 400);
  return version;
}

function readRuntimeSettings(dataDir: string): CatalogParameterOverrideSettings {
  const destination = settingsPath(dataDir);
  try {
    const file = statSync(destination);
    if (runtimeCache?.path === destination && runtimeCache.mtimeMs === file.mtimeMs && runtimeCache.size === file.size) return runtimeCache.settings;
    const settings = validateStoredSettings(JSON.parse(readFileSync(destination, "utf8")));
    runtimeCache = { path:destination, mtimeMs:file.mtimeMs, size:file.size, settings };
    return settings;
  } catch {
    return emptySettings();
  }
}

async function persistSettings(settings: CatalogParameterOverrideSettings, dataDir: string): Promise<CatalogParameterOverrideSettings> {
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

function validateStoredSettings(value: unknown): CatalogParameterOverrideSettings {
  if (!value || typeof value !== "object") throw new QuoteWorkflowError("Хранилище характеристик повреждено.", 500);
  const candidate = value as Partial<CatalogParameterOverrideSettings>;
  if (candidate.version !== STORE_VERSION || !Number.isInteger(candidate.revision) || !Array.isArray(candidate.records)) throw new QuoteWorkflowError("Хранилище характеристик имеет неизвестный формат.", 500);
  if (!candidate.records.every(isStoredRecord)) throw new QuoteWorkflowError("В хранилище характеристик есть некорректная запись.", 500);
  return { version:STORE_VERSION, revision:Number(candidate.revision), records:candidate.records };
}

function isStoredRecord(value: unknown): value is CatalogParameterOverrideRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<CatalogParameterOverrideRecord>;
  return [record.id, record.slug, record.brand, record.sku, record.title, record.expectedBrand, record.expectedSku, record.expectedTitle, record.draftVersionId, record.publishedVersionId, record.updatedAt].every((item) => typeof item === "string")
    && typeof record.disabled === "boolean"
    && Array.isArray(record.versions)
    && record.versions.every((version) => Boolean(version && typeof version.id === "string" && Array.isArray(version.parameters) && version.parameters.every(isStoredParameter) && typeof version.sourceUrl === "string" && /^https?:\/\//u.test(version.sourceUrl) && typeof version.note === "string" && typeof version.createdAt === "string" && typeof version.createdBy === "string"))
    && Array.isArray(record.events)
    && record.events.every((event) => Boolean(event && typeof event.id === "string" && ["save_draft", "publish", "discard_draft", "disable", "enable", "restore"].includes(event.action) && typeof event.at === "string" && typeof event.actor === "string"));
}

function isStoredParameter(value: unknown): value is CatalogParameterOverride {
  if (!value || typeof value !== "object") return false;
  const parameter = value as Partial<CatalogParameterOverride>;
  return (parameter.target === "product" || parameter.target === "variant")
    && (parameter.target === "product" ? parameter.variantId === undefined : typeof parameter.variantId === "string" && Boolean(parameter.variantId))
    && typeof parameter.name === "string" && Boolean(parameter.name)
    && typeof parameter.value === "string" && Boolean(parameter.value)
    && (parameter.unit === undefined || typeof parameter.unit === "string");
}

function emptySettings(): CatalogParameterOverrideSettings {
  return { version:STORE_VERSION, revision:0, records:[] };
}

function assertRevision(settings: CatalogParameterOverrideSettings, revision: number) {
  if (!Number.isInteger(revision) || revision !== settings.revision) throw new QuoteWorkflowError("Характеристики уже изменены в другой вкладке. Обновите страницу.", 409);
}

function assertExactIdentity(product: CatalogParameterProductIdentity, record: CatalogParameterOverrideRecord) {
  if (!matchesRecordIdentity(product, record)) throw new QuoteWorkflowError("Название, бренд или артикул товара изменились. Проверьте источник и создайте новый черновик.", 409);
}

function matchesRecordIdentity(product: Pick<CatalogParameterProductIdentity, "id" | "brand" | "sku" | "title">, record: CatalogParameterOverrideRecord): boolean {
  return product.id === record.id && product.brand === record.expectedBrand && product.sku === record.expectedSku && product.title === record.expectedTitle;
}

function normalizeSourceUrl(value: unknown): string {
  const raw = cleanText(value, 1000);
  try {
    const parsed = new URL(raw);
    if (!/^https?:$/u.test(parsed.protocol) || parsed.username || parsed.password) throw new Error("invalid");
    return parsed.toString();
  } catch {
    throw new QuoteWorkflowError("Укажите публичную ссылку на точную страницу, паспорт или каталог поставщика.", 400);
  }
}

function normalizeVersionId(value: unknown): string {
  const id = cleanText(value, 120);
  if (!/^[0-9a-f-]{36}$/iu.test(id)) throw new QuoteWorkflowError("Некорректная версия характеристик.", 400);
  return id;
}

function appendEvent(events: CatalogParameterOverrideEvent[], action: CatalogParameterOverrideEvent["action"], actor: Actor, versionId: string | undefined, at: string): CatalogParameterOverrideEvent[] {
  return [...events, { id:randomUUID(), action, at, actor:actorLabel(actor), ...(versionId ? { versionId } : {}) }];
}

function actorLabel(actor: Actor): string {
  return `${actor.name || "Администратор"} (${actor.id})`.slice(0, 240);
}

function upsertRecord(records: CatalogParameterOverrideRecord[], record: CatalogParameterOverrideRecord): CatalogParameterOverrideRecord[] {
  return [...records.filter((item) => item.id !== record.id), record].sort((first, second) => first.title.localeCompare(second.title, "ru-RU"));
}

function settingsPath(dataDir: string): string {
  return path.join(dataDir, "settings", "catalog-parameter-overrides.json");
}

function resolveDataDir(override?: string): string {
  return override || process.env.QUOTE_TEST_DATA_DIR || path.join(process.cwd(), "work", "quote-requests");
}

function nowIso(value?: string | Date): string {
  return new Date(value || Date.now()).toISOString();
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/gu, " ").replace(/\s+/gu, " ").trim().slice(0, maxLength) : "";
}

function normalizeKey(value: string): string {
  return value.toLocaleLowerCase("ru-RU").replace(/ё/gu, "е").replace(/[^a-zа-я0-9]+/giu, " ").trim();
}
