import type { Metadata } from "next";
import Link from "next/link";
import { classifyMissingProductMedia, mediaRecoveryClasses } from "../../data/catalogMediaRecovery.mjs";
import { catalogProductMediaAssetUrl, catalogProductMediaState, getCatalogProductMediaSettings, type CatalogProductMediaRecord } from "../../data/catalogProductMediaStore.ts";
import { formatFeedPrice, getFeedProductImage, getPublishedFeedCatalogSnapshot } from "../../data/feedCatalog.ts";
import { requireManagerPageAccess } from "../../data/managerAccessPage.ts";
import { Breadcrumbs } from "../../ui/Breadcrumbs";
import { CatalogMediaManager, type CatalogMediaManagerItem } from "../../ui/CatalogMediaManager";
import { PilotFooter } from "../../ui/PilotFooter";
import { PilotHeader } from "../../ui/PilotHeader";

export const metadata: Metadata = { title:"Фотографии товаров — 7TOOL", robots:{ index:false, follow:false, nocache:true } };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ q?: string; queue?: string; state?: string }>;
const queueCodes = new Set(Object.keys(mediaRecoveryClasses));
const states = new Set(["all", "unmanaged", "draft", "published", "disabled"]);

export default async function CatalogMediaPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const query = String(raw.q ?? "").trim().slice(0, 120);
  const queue = raw.queue === "all" || queueCodes.has(String(raw.queue)) ? String(raw.queue) : "stocked_source_ready";
  const state = states.has(String(raw.state)) ? String(raw.state) : "all";
  const returnParams = new URLSearchParams();
  if (query) returnParams.set("q", query);
  if (queue !== "stocked_source_ready") returnParams.set("queue", queue);
  if (state !== "all") returnParams.set("state", state);
  const returnTo = `/test/catalog-media${returnParams.size ? `?${returnParams}` : ""}`;
  const actor = await requireManagerPageAccess("settings:manage", returnTo);
  const [settings, snapshot] = await Promise.all([getCatalogProductMediaSettings(), Promise.resolve(getPublishedFeedCatalogSnapshot())]);
  const records = new Map(settings.records.map((record) => [record.id, record]));
  const candidates = snapshot.products.filter((product) => !hasNativeMedia(product) || records.has(product.id));
  const counts = queueCounts(candidates, records);
  const normalizedQuery = query.toLocaleLowerCase("ru-RU");
  const matching = candidates.filter((product) => {
    const record = records.get(product.id);
    const recovery = classifyMissingProductMedia(product);
    const recordState = catalogProductMediaState(record);
    if (queue !== "all" && recovery.code !== queue) return false;
    if (state !== "all" && recordState !== state) return false;
    if (!normalizedQuery) return true;
    return [product.title, product.brand, product.sku, product.id, ...product.variants.map((variant) => variant.sku)].join(" ").toLocaleLowerCase("ru-RU").includes(normalizedQuery);
  });
  const items = matching.slice(0, 100).map((product): CatalogMediaManagerItem => {
    const record = records.get(product.id);
    const recovery = classifyMissingProductMedia(product);
    const draftVersion = record?.versions.find((version) => version.assetId === record.draftAssetId);
    const publishedVersion = record?.versions.find((version) => version.assetId === record.publishedAssetId);
    return {
      id:product.id,
      slug:product.slug,
      title:product.title,
      brand:product.brand,
      sku:product.sku,
      category:product.category,
      stock:product.stock,
      variantCount:product.variants.length,
      price:formatFeedPrice(product.priceFrom) ?? "Цена по запросу",
      queueCode:recovery.code,
      queueLabel:recovery.label,
      queueInstruction:recovery.instruction,
      state:catalogProductMediaState(record),
      image:draftVersion ? catalogProductMediaAssetUrl(draftVersion.assetId) : publishedVersion ? catalogProductMediaAssetUrl(publishedVersion.assetId) : getFeedProductImage(product),
      record:record ? publicRecord(record) : undefined,
    };
  });

  return <div className="site-shell"><PilotHeader managerMode managerActor={actor} /><main className="inner-page catalog-media-page">
    <div className="container"><Breadcrumbs items={[{ label:"Главная", href:"/" }, { label:"Качество каталога", href:"/test/catalog-quality?priority=p1&issue=missing_image" }, { label:"Фотографии товаров" }]} /></div>
    <section className="catalog-media-hero"><div className="container"><div><p className="eyebrow">Администратор · безопасное обогащение фида</p><h1>Фотографии товаров</h1><p>Загрузите точное фото, проверьте его в макете карточки и опубликуйте. Фото из фида всегда имеет приоритет, а каждое действие остаётся в журнале.</p></div><aside><span>Приоритетная очередь</span><b>{counts.stockedSourceReady.toLocaleString("ru-RU")} товаров в наличии</b><small>с брендом и идентификатором для поиска точного источника</small></aside></div></section>
    <section className="section catalog-media-content"><div className="container">
      <div className="catalog-media-summary" aria-label="Сводка фотографий"><Summary value={counts.total} label="Без фото фида" /><Summary value={counts.stockedSourceReady} label="В наличии · можно искать" tone="priority" /><Summary value={counts.identityFirst} label="Сначала идентификация" /><Summary value={settings.records.filter((record) => catalogProductMediaState(record) === "draft").length} label="Черновики" /><Summary value={settings.records.filter((record) => catalogProductMediaState(record) === "published").length} label="Опубликовано" tone="success" /></div>
      <form className="catalog-media-filters" action="/test/catalog-media" method="get" role="search">
        <label><span>Очередь</span><select name="queue" defaultValue={queue}><option value="stocked_source_ready">В наличии · точный источник</option><option value="stocked_identity_first">В наличии · сначала идентификация</option><option value="unstocked_source_ready">Без остатка · точный источник</option><option value="unstocked_identity_first">Без остатка · сначала идентификация</option><option value="all">Все очереди</option></select></label>
        <label><span>Статус работы</span><select name="state" defaultValue={state}><option value="all">Все статусы</option><option value="unmanaged">Не начато</option><option value="draft">Черновик</option><option value="published">Опубликовано</option><option value="disabled">Отключено</option></select></label>
        <label className="catalog-media-search"><span>Товар, модель или артикул</span><input type="search" name="q" defaultValue={query} placeholder="Например, BM-25S" /></label>
        <button type="submit">Показать</button><Link href="/test/catalog-media">Сбросить</Link>
      </form>
      <div className="catalog-media-policy"><b>Правило публикации</b><p>Публикуйте только фото точного товара или доказуемой серии. Ссылка на источник обязательна. Похожая модель, изображение конкурента, логотип и сгенерированная картинка не заменяют фотографию товара.</p></div>
      <CatalogMediaManager initialRevision={settings.revision} items={items} totalMatching={matching.length} />
    </div></section>
  </main><PilotFooter /></div>;
}

function Summary({ value, label, tone = "neutral" }: { value: number; label: string; tone?: "neutral" | "priority" | "success" }) {
  return <div className={`catalog-media-summary-card catalog-media-summary-card--${tone}`}><b>{value.toLocaleString("ru-RU")}</b><span>{label}</span></div>;
}

function hasNativeMedia(product: ReturnType<typeof getPublishedFeedCatalogSnapshot>["products"][number]): boolean {
  return Boolean(product.images?.some(Boolean) || product.variants.some((variant) => variant.images?.some(Boolean)));
}

function queueCounts(products: ReturnType<typeof getPublishedFeedCatalogSnapshot>["products"], records: Map<string, CatalogProductMediaRecord>) {
  const missing = products.filter((product) => !hasNativeMedia(product));
  return {
    total:missing.length,
    stockedSourceReady:missing.filter((product) => classifyMissingProductMedia(product).code === "stocked_source_ready").length,
    identityFirst:missing.filter((product) => classifyMissingProductMedia(product).code.endsWith("identity_first")).length,
    managed:records.size,
  };
}

function publicRecord(record: CatalogProductMediaRecord): CatalogProductMediaRecord {
  return JSON.parse(JSON.stringify(record)) as CatalogProductMediaRecord;
}

