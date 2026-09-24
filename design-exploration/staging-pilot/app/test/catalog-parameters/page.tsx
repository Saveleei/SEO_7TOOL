import type { Metadata } from "next";
import Link from "next/link";
import { catalogParameterOverrideState, getCatalogParameterOverrideSettings, type CatalogParameterOverrideRecord } from "../../data/catalogParameterOverrideStore.ts";
import { getCatalogQualityReport } from "../../data/catalogQuality.ts";
import { getPublishedFeedCatalogSnapshot } from "../../data/feedCatalog.ts";
import { requireManagerPageAccess } from "../../data/managerAccessPage.ts";
import { Breadcrumbs } from "../../ui/Breadcrumbs";
import { CatalogParameterManager, type CatalogParameterManagerItem } from "../../ui/CatalogParameterManager";
import { PilotFooter } from "../../ui/PilotFooter";
import { PilotHeader } from "../../ui/PilotHeader";

export const metadata: Metadata = { title:"Характеристики товаров — 7TOOL", robots:{ index:false, follow:false, nocache:true } };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ q?: string; category?: string; state?: string; product?: string }>;
const states = new Set(["all", "unmanaged", "draft", "published", "disabled"]);

export default async function CatalogParametersPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const query = String(raw.q ?? "").trim().slice(0, 120);
  const productId = String(raw.product ?? "").trim().slice(0, 180);
  const state = states.has(String(raw.state)) ? String(raw.state) : "all";
  const returnParams = new URLSearchParams();
  if (query) returnParams.set("q", query);
  if (productId) returnParams.set("product", productId);
  if (raw.category) returnParams.set("category", String(raw.category).slice(0, 120));
  if (state !== "all") returnParams.set("state", state);
  const returnTo = `/test/catalog-parameters${returnParams.size ? `?${returnParams}` : ""}`;
  const actor = await requireManagerPageAccess("catalog:manage", returnTo);
  const [settings, snapshot] = await Promise.all([getCatalogParameterOverrideSettings(), Promise.resolve(getPublishedFeedCatalogSnapshot())]);
  const report = getCatalogQualityReport();
  const categories = snapshot.categories.slice().sort((first, second) => first.title.localeCompare(second.title, "ru-RU"));
  const categorySlug = categories.some((category) => category.slug === raw.category) ? String(raw.category) : "all";
  const records = new Map(settings.records.map((record) => [record.id, record]));
  const missingByProduct = new Map<string, string[]>();
  const needsEnrichment = new Set<string>();
  for (const issue of report.issues.filter((entry) => entry.code === "not_filterable" || entry.code === "missing_parameter")) {
    needsEnrichment.add(issue.productId);
    const current = missingByProduct.get(issue.productId) ?? [];
    missingByProduct.set(issue.productId, Array.from(new Set([...current, ...(issue.missingParameters ?? [])])));
  }
  const normalized = normalize(query);
  const matching = snapshot.products.filter((product) => {
    const recordState = catalogParameterOverrideState(records.get(product.id));
    if (productId && product.id !== productId) return false;
    if (categorySlug !== "all" && product.category !== categorySlug) return false;
    if (state !== "all" && recordState !== state) return false;
    if (!normalized) return true;
    return normalize([product.title, product.brand, product.sku, ...product.variants.flatMap((variant) => [variant.name, variant.sku])].filter(Boolean).join(" ")).includes(normalized);
  }).sort((first, second) => workPriority(first.id, records, needsEnrichment) - workPriority(second.id, records, needsEnrichment) || first.title.localeCompare(second.title, "ru-RU"));
  const items = matching.slice(0, 16).map((product): CatalogParameterManagerItem => {
    const record = records.get(product.id);
    return {
      id:product.id,
      slug:product.slug,
      title:product.title,
      brand:product.brand,
      sku:product.sku,
      category:product.category,
      categoryTitle:categories.find((category) => category.slug === product.category)?.title ?? product.category,
      state:catalogParameterOverrideState(record),
      missingParameters:missingByProduct.get(product.id) ?? [],
      variants:product.variants.map((variant) => ({
        id:variant.id,
        sku:variant.sku,
        name:variant.name || product.title,
        params:variant.params.map((parameter) => ({ name:parameter.name, value:parameter.value, unit:parameter.unit })),
      })),
      record:record ? publicRecord(record) : undefined,
    };
  });
  const counts = stateCounts(snapshot.products.map((product) => records.get(product.id)));

  return <div className="site-shell"><PilotHeader managerMode managerActor={actor} /><main className="inner-page catalog-parameter-page">
    <div className="container"><Breadcrumbs items={[{ label:"Главная", href:"/" }, { label:"Качество каталога", href:"/test/catalog-quality" }, { label:"Характеристики" }]} /></div>
    <section className="catalog-parameter-hero"><div className="container"><div><p className="eyebrow">Административный контур · исходный фид не изменяется</p><h1>Проверенные характеристики</h1><p>Сохраните данные из паспорта как черновик, проверьте область применения и только затем опубликуйте поверх фида. Размер конкретного исполнения не распространяется на всю серию автоматически.</p></div><aside><b>{settings.revision}</b><span>ревизия хранилища</span><small>{counts.published.toLocaleString("ru-RU")} опубликовано · {counts.draft.toLocaleString("ru-RU")} черновиков</small></aside></div></section>
    <section className="section catalog-parameter-content"><div className="container">
      <div className="catalog-parameter-summary"><Summary value={report.issues.filter((issue) => issue.code === "not_filterable").length} label="не участвуют в подборе" tone="priority" /><Summary value={counts.draft} label="черновиков" /><Summary value={counts.published} label="опубликовано" tone="success" /><Summary value={counts.disabled} label="отключено" /></div>
      <form className="catalog-parameter-filters" action="/test/catalog-parameters" method="get" role="search"><label><span>Товар, бренд или артикул</span><input name="q" type="search" defaultValue={query} placeholder="Например, STEYR-35" /></label><label><span>Категория</span><select name="category" defaultValue={categorySlug}><option value="all">Все категории</option>{categories.map((category) => <option value={category.slug} key={category.slug}>{category.title}</option>)}</select></label><label><span>Состояние</span><select name="state" defaultValue={state}><option value="all">Все состояния</option><option value="unmanaged">Не начато</option><option value="draft">Черновик</option><option value="published">Опубликовано</option><option value="disabled">Отключено</option></select></label><button type="submit">Найти</button><Link href="/test/catalog-parameters">Сбросить</Link></form>
      <div className="catalog-parameter-policy"><b>Перед публикацией</b><p>Сверьте точную модель и исполнение, приложите публичную ссылку на паспорт или страницу поставщика. «Для всей серии» выбирайте только для действительно общих параметров: материал, тип привода, стандарт или совместимость.</p></div>
      <CatalogParameterManager initialRevision={settings.revision} items={items} totalMatching={matching.length} />
    </div></section>
  </main><PilotFooter /></div>;
}

function Summary({ value, label, tone = "neutral" }: { value: number; label: string; tone?: "neutral" | "priority" | "success" }) {
  return <div className={`catalog-parameter-summary-card catalog-parameter-summary-card--${tone}`}><b>{value.toLocaleString("ru-RU")}</b><span>{label}</span></div>;
}

function stateCounts(records: Array<CatalogParameterOverrideRecord | undefined>) {
  return records.reduce((counts, record) => {
    counts[catalogParameterOverrideState(record)] += 1;
    return counts;
  }, { unmanaged:0, draft:0, published:0, disabled:0 });
}

function publicRecord(record: CatalogParameterOverrideRecord): CatalogParameterOverrideRecord {
  return JSON.parse(JSON.stringify(record)) as CatalogParameterOverrideRecord;
}

function workPriority(productId: string, records: Map<string, CatalogParameterOverrideRecord>, needsEnrichment: Set<string>): number {
  const recordState = catalogParameterOverrideState(records.get(productId));
  if (recordState === "draft") return 0;
  if (needsEnrichment.has(productId)) return 1;
  if (recordState === "disabled") return 2;
  if (recordState === "published") return 3;
  return 4;
}

function normalize(value: string): string {
  return value.toLocaleLowerCase("ru-RU").replace(/ё/gu, "е").replace(/[^a-zа-я0-9]+/giu, " ").trim();
}
