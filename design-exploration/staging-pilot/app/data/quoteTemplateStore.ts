import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import { quoteTemplateStampAssetExists } from "./quoteAssetStore.ts";
import { QuoteWorkflowError } from "./quoteRequestStore.ts";
import { validateQuoteTemplateSettings } from "./quoteTemplateValidation.mjs";

export type QuoteTemplateSeller = {
  brandName: string;
  legalName: string;
  inn: string;
  kpp: string;
  ogrn: string;
  legalAddress: string;
  phone: string;
  email: string;
  website: string;
  bankName: string;
  bik: string;
  checkingAccount: string;
  correspondentAccount: string;
};

export type QuoteTemplateSender = { id: string; name: string; role: string; phone: string; email: string };
export type QuoteTemplateDefaults = { validityDays: number; vatRate: number; paymentTerms: string; deliveryTerms: string; managerComment: string };
export type QuoteTemplateDocument = { title: string; introText: string; footerText: string; showBankDetails: boolean };
export type QuoteTemplateSettings = {
  revision: number;
  updatedAt: string;
  seller: QuoteTemplateSeller;
  senders: QuoteTemplateSender[];
  defaultSenderId: string;
  defaults: QuoteTemplateDefaults;
  document: QuoteTemplateDocument;
  stampAssetId: string;
  includeStampByDefault: boolean;
};

type SaveInput = Omit<QuoteTemplateSettings, "updatedAt">;
type Options = { dataDir?: string; now?: string | Date };

export const DEFAULT_QUOTE_TEMPLATE_SETTINGS: QuoteTemplateSettings = Object.freeze({
  revision:0,
  updatedAt:"",
  seller:{
    brandName:"7TOOL",
    legalName:"ООО «7TOOL»",
    inn:"",
    kpp:"",
    ogrn:"",
    legalAddress:"Москва, Рябиновая улица, 63, стр. 4",
    phone:"+7 (962) 611-24-19",
    email:"info@7tool.ru",
    website:"https://7tool.ru",
    bankName:"",
    bik:"",
    checkingAccount:"",
    correspondentAccount:"",
  },
  senders:[{ id:"evgeny-savelev", name:"Евгений Савельев", role:"Персональный менеджер 7TOOL", phone:"+7 (962) 611-24-19", email:"info@7tool.ru" }],
  defaultSenderId:"evgeny-savelev",
  defaults:{ validityDays:10, vatRate:22, paymentTerms:"", deliveryTerms:"", managerComment:"" },
  document:{
    title:"Коммерческое предложение",
    introText:"Предложение по вашему запросу",
    footerText:"Цена, наличие и срок действительны только в пределах условий этого предложения.",
    showBankDetails:false,
  },
  stampAssetId:"",
  includeStampByDefault:false,
});

let settingsWriteQueue: Promise<unknown> = Promise.resolve();

export async function getQuoteTemplateSettings(options: Options = {}): Promise<QuoteTemplateSettings> {
  try {
    const stored = JSON.parse(await readFile(settingsPath(resolveDataDir(options.dataDir)), "utf8")) as QuoteTemplateSettings;
    const validation = validateQuoteTemplateSettings(stored);
    if (!validation.ok) return cloneDefaults();
    return { ...validation.value, updatedAt:typeof stored.updatedAt === "string" ? stored.updatedAt : "" } as QuoteTemplateSettings;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return cloneDefaults();
    if (error instanceof SyntaxError) return cloneDefaults();
    throw error;
  }
}

export function saveQuoteTemplateSettings(input: SaveInput, options: Options = {}): Promise<QuoteTemplateSettings> {
  const task = settingsWriteQueue.then(() => saveQuoteTemplateSettingsSerial(input, options));
  settingsWriteQueue = task.catch(() => undefined);
  return task;
}

export function defaultQuoteSender(settings: QuoteTemplateSettings) {
  const sender = settings.senders.find((candidate) => candidate.id === settings.defaultSenderId) ?? settings.senders[0];
  return { name:sender.name, role:sender.role, phone:sender.phone, email:sender.email };
}

async function saveQuoteTemplateSettingsSerial(input: SaveInput, options: Options) {
  const validation = validateQuoteTemplateSettings(input);
  if (!validation.ok) throw new QuoteWorkflowError(validation.message, 400);
  const dataDir = resolveDataDir(options.dataDir);
  const current = await getQuoteTemplateSettings({ dataDir });
  if (validation.value.revision !== current.revision) throw new QuoteWorkflowError("Настройки уже изменены в другой вкладке. Обновите страницу.", 409);
  if (validation.value.stampAssetId && !(await quoteTemplateStampAssetExists(validation.value.stampAssetId, { dataDir }))) throw new QuoteWorkflowError("Файл печати и подписи не найден. Загрузите его повторно.", 400);
  const next: QuoteTemplateSettings = { ...validation.value, revision:current.revision + 1, updatedAt:new Date(options.now || Date.now()).toISOString() };
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
  return path.join(dataDir, "settings", "quote-template.json");
}

function resolveDataDir(override?: string) {
  return override || process.env.QUOTE_TEST_DATA_DIR || path.join(process.cwd(), "work", "quote-requests");
}

function cloneDefaults(): QuoteTemplateSettings {
  return JSON.parse(JSON.stringify(DEFAULT_QUOTE_TEMPLATE_SETTINGS)) as QuoteTemplateSettings;
}
