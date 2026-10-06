import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getCatalogBlockingProductIds, getCatalogQualityReport } from "../../data/catalogQuality.ts";
import { formatFeedPrice, getFeedProductImage, getPublishedFeedCatalogSnapshot, type FeedProduct, type FeedVariant } from "../../data/feedCatalog.ts";
import { requireManagerPageAccess } from "../../data/managerAccessPage.ts";
import { publicProductPath } from "../../data/publicUrls.ts";
import { getShippingRuntimeDiagnostic } from "../../data/shippingRuntimeSettings.mjs";
import { resolveYandexAdvertisingPictureUrl, summarizeYandexAdvertisingCatalog } from "../../data/yandexAdvertisingFeed.ts";
import { Breadcrumbs } from "../../ui/Breadcrumbs";
import { PilotFooter } from "../../ui/PilotFooter";
import { PilotHeader } from "../../ui/PilotHeader";

export const metadata: Metadata = { title:"Каталог и рекламный фид — 7TOOL", robots:{ index:false, follow:false, nocache:true } };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ q?: string; category?: string; state?: string; page?: string }>;
type CatalogState = "all" | "available" | "advertisable" | "missing-price" | "unavailable";

const PAGE_SIZE = 40;

export default async function CatalogAdminPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const query = String(raw.q ?? "").trim().slice(0, 120);
  const state = normalizeState(raw.state);
  const snapshot = getPublishedFeedCatalogSnapshot();
  const quality = getCatalogQualityReport();
  const blockedProductIds = getCatalogBlockingProductIds(quality);
  const diagnostic = getShippingRuntimeDiagnostic();
  const advertising = summarizeYandexAdvertisingCatalog(snapshot, blockedProductIds);
  const categoryBySlug = new Map(snapshot.categories.map((category) => [category.slug, category]));
  const category = categoryBySlug.has(String(raw.category)) ? String(raw.category) : "all";
  const returnParams = new URLSearchParams();
  if (query) returnParams.set("q", query);
  if (category !== "all") returnParams.set("category", category);
  if (state !== "all") returnParams.set("state", state);
  if (raw.page) returnParams.set("page", String(raw.page));
  const returnTo = `/admin/catalog${returnParams.size ? `?${returnParams}` : ""}`;
  const actor = await requireManagerPageAccess("catalog:audit", returnTo);

  const normalizedQuery = query.toLocaleLowerCase("ru-RU");
  const matching = snapshot.products.filter((product) => {
    if (category !== "all" && product.category !== category) return false;
    if (state !== "all" && !matchesState(product, state, blockedProductIds)) return false;
    if (!normalizedQuery) return true;
    return [product.title, product.brand, product.sku, product.id, ...product.variants.flatMap((variant) => [variant.sku, variant.name])]
      .filter(Boolean).join(" ").toLocaleLowerCase("ru-RU").includes(normalizedQuery);
  });
  const pageCount = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
  const page = Math.min(normalizePage(raw.page), pageCount);
  const offset = (page - 1) * PAGE_SIZE;
  const products = matching.slice(offset, offset + PAGE_SIZE);

  return <div className="site-shell"><PilotHeader managerMode managerActor={actor} /><main className="inner-page catalog-admin-page">
    <div className="container"><Breadcrumbs items={[{ label:"Главная", href:"/" }, { label:"Администрирование", href:"/admin" }, { label:"Каталог" }]} /></div>
    <section className="catalog-admin-hero"><div className="container"><div><p className="eyebrow">Единый источник витрины и Яндекс Директа</p><h1>Каталог, цены и остатки</h1><p>Здесь видно то, что сейчас опубликовано на сайте. Рекламный YML строится из этого же снимка и не передаёт позиции без цены, подтверждённого наличия или фотографии.</p></div><aside data-state={diagnostic.fresh && diagnostic.snapshotIdentityMatches ? "healthy" : "blocked"}><span>Снимок поставщика</span><b>{diagnostic.fresh && diagnostic.snapshotIdentityMatches ? "Актуален" : "Реклама остановлена"}</b><small>{diagnostic.completedAt ? formatDateTime(diagnostic.completedAt) : "Время обновления не подтверждено"}{diagnostic.ageMinutes != null ? ` · ${formatAge(diagnostic.ageMinutes)}` : ""}</small></aside></div></section>

    <section className="section catalog-admin-content"><div className="container">
      <div className="catalog-admin-summary" aria-label="Сводка каталога">
        <Summary label="Товарные группы" value={advertising.productCount} note={`${advertising.variantCount.toLocaleString("ru-RU")} исполнений`} />
        <Summary label="В рекламе" value={advertising.advertisableVariantCount} note="цена + наличие + фото" tone="success" />
        <Summary label="Без цены" value={advertising.excludedMissingPriceCount} note="остаются на витрине" />
        <Summary label="Нет в наличии" value={advertising.excludedUnavailableCount} note="не передаются в Директ" />
        <Summary label="Блокировка качества" value={advertising.excludedBlockedProductCount} note={`${quality.priorities.p0.issueCount.toLocaleString("ru-RU")} записей P0`} tone={advertising.excludedBlockedProductCount ? "warning" : "success"} />
      </div>

      <div className="catalog-admin-tools">
        <article><span>01</span><div><b>Проверить рекламный фид</b><p>{advertising.advertisableVariantCount.toLocaleString("ru-RU")} актуальных офферов, канонические ссылки и фото конкретных товаров.</p></div><a href="/feeds/yandex-dynamic.xml" target="_blank" rel="noreferrer">Открыть YML ↗</a></article>
        <article><span>02</span><div><b>Исправить характеристики</b><p>Черновик, проверка и публикация с журналом изменений.</p></div><Link href="/test/catalog-parameters">Редактор →</Link></article>
        <article><span>03</span><div><b>Разобрать проблемы данных</b><p>P0 блокирует рекламу, P1 мешает выбору, P2 снижает полноту карточки.</p></div><Link href="/test/catalog-quality">Качество →</Link></article>
      </div>

      <div className="catalog-admin-policy"><b>Почему цена и остаток здесь без ручной перезаписи</b><p>Коммерческие данные приходят из основного фида поставщика и обновляются атомарно. Это защищает сайт и Яндекс Директ от разных цен и ложного наличия. Ручные правки применяются к проверяемым характеристикам и фотографиям; цену или остаток исправляют в источнике, после чего следующий импорт обновляет всё сразу.</p></div>

      <form className="catalog-admin-filters" action="/admin/catalog" method="get" role="search">
        <label><span>Товар, модель или артикул</span><input type="search" name="q" defaultValue={query} placeholder="Например, LZHS-013" /></label>
        <label><span>Категория</span><select name="category" defaultValue={category}><option value="all">Все категории</option>{snapshot.categories.slice().sort((a, b) => a.title.localeCompare(b.title, "ru-RU")).map((entry) => <option value={entry.slug} key={entry.slug}>{entry.title}</option>)}</select></label>
        <label><span>Состояние</span><select name="state" defaultValue={state}><option value="all">Все позиции</option><option value="advertisable">Передаются в рекламу</option><option value="available">Есть в наличии</option><option value="missing-price">Нет цены</option><option value="unavailable">Нет в наличии</option></select></label>
        <button type="submit">Показать</button><Link href="/admin/catalog">Сбросить</Link>
      </form>

      <section className="catalog-admin-results" aria-labelledby="catalog-admin-results-title"><header><div><p className="eyebrow">Опубликованные данные</p><h2 id="catalog-admin-results-title">Товары и исполнения</h2></div><span>{matching.length.toLocaleString("ru-RU")} результатов{matching.length ? ` · ${offset + 1}–${Math.min(offset + products.length, matching.length)}` : ""}</span></header>
        {products.length ? <div className="catalog-admin-products">{products.map((product) => <ProductRow product={product} categoryTitle={categoryBySlug.get(product.category)?.title ?? product.category} blocked={blockedProductIds.has(product.id)} key={product.id} />)}</div> : <div className="catalog-admin-empty"><b>По выбранным условиям товаров нет</b><p>Сбросьте фильтры или проверьте артикул.</p></div>}
        {pageCount > 1 ? <nav className="catalog-admin-pagination" aria-label="Страницы каталога"><span>Страница {page} из {pageCount}</span><div>{page > 1 ? <Link href={pageHref(query, category, state, page - 1)}>← Предыдущая</Link> : null}{page < pageCount ? <Link href={pageHref(query, category, state, page + 1)}>Следующая →</Link> : null}</div></nav> : null}
      </section>
    </div></section>
  </main><PilotFooter /></div>;
}

function ProductRow({ product, categoryTitle, blocked }: { product: FeedProduct; categoryTitle: string; blocked: boolean }) {
  const priced = product.variants.filter((variant) => Number.isFinite(variant.price) && Number(variant.price) > 0);
  const available = product.variants.filter((variant) => variant.available);
  const quantity = product.variants.reduce((sum, variant) => sum + (Number.isFinite(variant.quantity) && Number(variant.quantity) > 0 ? Number(variant.quantity) : 0), 0);
  const advertised = blocked ? 0 : product.variants.filter((variant) => isAdvertisable(product, variant)).length;
  const image = getFeedProductImage(product);
  return <article className="catalog-admin-product"><div className="catalog-admin-product-main"><div className="catalog-admin-product-image">{image ? <Image src={image} alt="" width={112} height={96} unoptimized /> : <span>Нет фото</span>}</div><div className="catalog-admin-product-copy"><div className="catalog-admin-product-badges"><span>{categoryTitle}</span>{blocked ? <span data-tone="blocked">P0 · реклама заблокирована</span> : advertised ? <span data-tone="success">В рекламе: {advertised}</span> : <span>Не рекламируется</span>}</div><h3><Link href={publicProductPath(product)}>{product.title}</Link></h3><p>{product.brand || "Бренд не указан"}{product.sku ? ` · ${product.sku}` : ""} · ID {product.id}</p><div className="catalog-admin-product-actions"><Link href={publicProductPath(product)}>Карточка товара ↗</Link><Link href={`/test/catalog-parameters?product=${encodeURIComponent(product.id)}`}>Характеристики →</Link>{!image ? <Link href={`/test/catalog-media?q=${encodeURIComponent(product.sku || product.title)}`}>Добавить фото →</Link> : null}</div></div></div><dl className="catalog-admin-commerce"><div><dt>Цена</dt><dd>{priceRange(priced)}</dd><small>{priced.length} из {product.variants.length} с ценой</small></div><div><dt>Наличие</dt><dd>{quantity > 0 ? `${quantity.toLocaleString("ru-RU")} шт.` : available.length ? "Подтверждено" : "Нет"}</dd><small>{available.length} из {product.variants.length} исполнений</small></div></dl><details className="catalog-admin-variants"><summary>Посмотреть исполнения ({product.variants.length})</summary><div><div className="catalog-admin-variant catalog-admin-variant--head"><span>Артикул / исполнение</span><span>Цена с НДС</span><span>Остаток</span><span>Реклама</span></div>{product.variants.slice(0, 24).map((variant) => <VariantRow product={product} variant={variant} blocked={blocked} key={`${product.id}:${variant.id}`} />)}{product.variants.length > 24 ? <p>Показаны первые 24 исполнения. Найдите нужный артикул через поиск выше.</p> : null}</div></details></article>;
}

function VariantRow({ product, variant, blocked }: { product: FeedProduct; variant: FeedVariant; blocked: boolean }) {
  const advertised = !blocked && isAdvertisable(product, variant);
  return <div className="catalog-admin-variant"><span><b>{variant.sku || "Без артикула"}</b><small>{variant.name || variant.id}</small></span><span>{formatFeedPrice(variant.price) ?? "По запросу"}</span><span>{variant.available ? Number.isFinite(variant.quantity) ? `${Number(variant.quantity).toLocaleString("ru-RU")} шт.` : "Подтверждено" : "Нет"}</span><span data-state={advertised ? "yes" : "no"}>{advertised ? "Да" : exclusionReason(product, variant, blocked)}</span></div>;
}

function Summary({ label, value, note, tone = "neutral" }: { label: string; value: number; note: string; tone?: "neutral" | "success" | "warning" }) {
  return <div className={`catalog-admin-summary-card catalog-admin-summary-card--${tone}`}><span>{label}</span><b>{value.toLocaleString("ru-RU")}</b><small>{note}</small></div>;
}

function matchesState(product: FeedProduct, state: CatalogState, blocked: Set<string>): boolean {
  if (state === "available") return product.variants.some((variant) => variant.available);
  if (state === "advertisable") return !blocked.has(product.id) && product.variants.some((variant) => isAdvertisable(product, variant));
  if (state === "missing-price") return product.variants.some((variant) => !(Number.isFinite(variant.price) && Number(variant.price) > 0));
  if (state === "unavailable") return product.variants.every((variant) => !variant.available);
  return true;
}

function isAdvertisable(product: FeedProduct, variant: FeedVariant): boolean {
  const image = variant.images?.find(Boolean) ?? getFeedProductImage(product) ?? "";
  return Boolean(Number.isFinite(variant.price) && Number(variant.price) > 0 && variant.available && resolveYandexAdvertisingPictureUrl(image));
}

function exclusionReason(product: FeedProduct, variant: FeedVariant, blocked: boolean): string {
  if (blocked) return "P0";
  if (!(Number.isFinite(variant.price) && Number(variant.price) > 0)) return "Нет цены";
  if (!variant.available) return "Нет наличия";
  return "Нет фото";
}

function priceRange(variants: FeedVariant[]): string {
  const prices = variants.map((variant) => Number(variant.price)).filter((value) => Number.isFinite(value) && value > 0);
  if (!prices.length) return "По запросу";
  const minimum = Math.min(...prices);
  const maximum = Math.max(...prices);
  return minimum === maximum ? formatFeedPrice(minimum)! : `${formatFeedPrice(minimum)} — ${formatFeedPrice(maximum)}`;
}

function normalizeState(value?: string): CatalogState {
  return value === "available" || value === "advertisable" || value === "missing-price" || value === "unavailable" ? value : "all";
}

function normalizePage(value?: string): number {
  const parsed = Number.parseInt(String(value ?? "1"), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 10_000) : 1;
}

function pageHref(query: string, category: string, state: CatalogState, page: number): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (category !== "all") params.set("category", category);
  if (state !== "all") params.set("state", state);
  if (page > 1) params.set("page", String(page));
  return `/admin/catalog${params.size ? `?${params}` : ""}`;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", { dateStyle:"medium", timeStyle:"short", timeZone:"Europe/Moscow" }).format(date);
}

function formatAge(value: number): string {
  if (value < 60) return `${Math.max(0, value)} мин. назад`;
  return `${Math.floor(value / 60)} ч. назад`;
}
