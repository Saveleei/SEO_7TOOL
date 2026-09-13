import type { Metadata } from "next";
import Link from "next/link";
import { catalogQualityIssueLabel, getCatalogQualityReport, type CatalogQualityIssue, type CatalogQualityIssueCode, type CatalogQualityStatus } from "../../data/catalogQuality.ts";
import { requireManagerPageAccess } from "../../data/managerAccessPage.ts";
import { Breadcrumbs } from "../../ui/Breadcrumbs";
import { PilotFooter } from "../../ui/PilotFooter";
import { PilotHeader } from "../../ui/PilotHeader";

export const metadata: Metadata = { title:"Качество каталога — 7TOOL", robots:{ index:false, follow:false, nocache:true } };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ status?: string; issue?: string; category?: string; q?: string; page?: string }>;

const ISSUE_PAGE_SIZE = 100;

export default async function CatalogQualityPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const returnParams = new URLSearchParams();
  for (const key of ["status", "issue", "category", "q", "page"] as const) {
    const value = String(raw[key] ?? "").trim().slice(0, 100);
    if (value) returnParams.set(key, value);
  }
  const returnTo = `/test/catalog-quality${returnParams.size ? `?${returnParams}` : ""}`;
  const actor = await requireManagerPageAccess("catalog:audit", returnTo);
  const report = getCatalogQualityReport();
  const status = normalizeStatus(raw.status);
  const issueCode = normalizeIssue(raw.issue, report.issues);
  const categorySlug = report.categories.some((category) => category.slug === raw.category) ? raw.category ?? "all" : "all";
  const query = String(raw.q ?? "").trim().slice(0, 100);

  const visibleCategories = report.categories.filter((category) => (status === "all" || category.status === status) && (categorySlug === "all" || category.slug === categorySlug));
  const matchingIssues = report.issues.filter((issue) => (issueCode === "all" || issue.code === issueCode)
    && (status === "all" || report.categories.find((category) => category.slug === issue.categorySlug)?.status === status)
    && (categorySlug === "all" || issue.categorySlug === categorySlug)
    && matchesQuery(issue, query));
  const issuePageCount = Math.max(1, Math.ceil(matchingIssues.length / ISSUE_PAGE_SIZE));
  const issuePage = Math.min(normalizePage(raw.page), issuePageCount);
  const issueOffset = (issuePage - 1) * ISSUE_PAGE_SIZE;
  const visibleIssues = matchingIssues.slice(issueOffset, issueOffset + ISSUE_PAGE_SIZE);
  const issueCodes = Array.from(new Set(report.issues.map((issue) => issue.code))).sort((first, second) => catalogQualityIssueLabel(first).localeCompare(catalogQualityIssueLabel(second), "ru-RU"));

  return <div className="site-shell"><PilotHeader managerMode managerActor={actor} /><main className="inner-page catalog-quality-page">
    <div className="container"><Breadcrumbs items={[{ label:"Главная", href:"/" }, { label:"Заявки", href:"/test/requests" }, { label:"Качество каталога" }]} /></div>
    <section className="catalog-quality-hero"><div className="container"><div><p className="eyebrow">Только для администратора · без изменения фида</p><h1>Качество каталога</h1><p>Показывает, где данные мешают поиску, подбору, сравнению и подготовке КП. Любое исправление сначала проверяется в источнике поставщика.</p></div><aside><span>Источник отчёта</span><b>Текущий снимок фида</b><small>{report.productCount.toLocaleString("ru-RU")} товаров · {report.variantCount.toLocaleString("ru-RU")} исполнений</small></aside></div></section>

    <section className="section catalog-quality-content"><div className="container">
      <div className="catalog-quality-summary" aria-label="Сводка качества каталога">
        <SummaryCard label="Категории" value={report.categoryCount} note="все опубликованные" />
        <SummaryCard tone="critical" label="Критично" value={report.statuses.critical} note="сначала исправить" />
        <SummaryCard tone="review" label="Требуют проверки" value={report.statuses.review} note="не блокируют витрину" />
        <SummaryCard tone="healthy" label="Без замечаний" value={report.statuses.healthy} note="по текущим правилам" />
        <SummaryCard label="Затронуто товаров" value={report.affectedProductCount} note={`из ${report.productCount.toLocaleString("ru-RU")}`} />
      </div>

      <form className="catalog-quality-filters" action="/test/catalog-quality" method="get" role="search">
        <label><span>Статус категории</span><select name="status" defaultValue={status}><option value="all">Все статусы</option><option value="critical">Критично</option><option value="review">Требует проверки</option><option value="healthy">Без замечаний</option></select></label>
        <label><span>Категория</span><select name="category" defaultValue={categorySlug}><option value="all">Все категории</option>{report.categories.slice().sort((a, b) => a.title.localeCompare(b.title, "ru-RU")).map((category) => <option value={category.slug} key={category.slug}>{category.title}</option>)}</select></label>
        <label><span>Тип проблемы</span><select name="issue" defaultValue={issueCode}><option value="all">Все проблемы</option>{issueCodes.map((code) => <option value={code} key={code}>{catalogQualityIssueLabel(code)}</option>)}</select></label>
        <label className="catalog-quality-search"><span>Товар, бренд или артикул</span><input type="search" name="q" defaultValue={query} placeholder="Например, STEYR-35" /></label>
        <button type="submit">Применить</button><Link href="/test/catalog-quality">Сбросить</Link>
      </form>

      <div className="catalog-quality-explainer"><b>Как читать оценку</b><p>Баллы показывают полноту фото, цены, артикула и параметров подбора. Это не подтверждение технической корректности товара. Одна карточка может иметь несколько замечаний, поэтому число проблем больше числа товаров.</p></div>

      <section className="catalog-quality-section" aria-labelledby="category-health-title"><header><div><p className="eyebrow">Приоритет исправлений</p><h2 id="category-health-title">Состояние категорий</h2></div><span>{visibleCategories.length} из {report.categoryCount}</span></header>
        {visibleCategories.length > 0 ? <div className="catalog-quality-categories">{visibleCategories.map((category) => <details key={category.slug}><summary><StatusBadge status={category.status} /><div><b>{category.title}</b><small>{category.productCount.toLocaleString("ru-RU")} товаров · {category.variantCount.toLocaleString("ru-RU")} исполнений</small></div><strong>{category.score}<small>/100</small></strong><i aria-hidden="true">+</i></summary><div className="catalog-quality-category-body"><div className="catalog-quality-metrics"><Metric label="Фото" value={category.metrics.photoCoverage} /><Metric label="Цена" value={category.metrics.priceCoverage} /><Metric label="Артикул" value={category.metrics.skuCoverage} /><Metric label="Участвуют в подборе" value={category.metrics.selectionCoverage} /><Metric label="Ключевые параметры" value={category.metrics.criticalParameterCoverage} /></div><div className="catalog-quality-category-foot"><p><b>{category.affectedProductCount.toLocaleString("ru-RU")}</b> товаров с замечаниями · критичных записей: {category.criticalCount}, проверок: {category.warningCount}, уведомлений: {category.noticeCount}</p><div>{category.selectionKeywords.length > 0 ? <span>Подбор: {category.selectionKeywords.join(" · ")}</span> : <span>Подбор передаётся инженеру: структурированных параметров недостаточно</span>}<Link href={`/catalog/category/${category.slug}`}>Открыть категорию →</Link></div></div></div></details>)}</div> : <EmptyState />}
      </section>

      <section className="catalog-quality-section" aria-labelledby="quality-issues-title"><header><div><p className="eyebrow">Проверяемые записи</p><h2 id="quality-issues-title">Что требует внимания</h2></div><span>{matchingIssues.length.toLocaleString("ru-RU")} совпадений{matchingIssues.length > 0 ? ` · ${issueOffset + 1}–${Math.min(issueOffset + visibleIssues.length, matchingIssues.length)}` : ""}</span></header>
        {visibleIssues.length > 0 ? <ol className="catalog-quality-issues">{visibleIssues.map((issue) => <IssueRow issue={issue} key={issue.id} />)}</ol> : <EmptyState />}
        {matchingIssues.length > ISSUE_PAGE_SIZE ? <nav className="catalog-quality-pagination" aria-label="Страницы замечаний"><span>Страница {issuePage} из {issuePageCount}</span><div>{issuePage > 1 ? <Link href={qualityHref(status, categorySlug, issueCode, query, issuePage - 1)}>← Предыдущая</Link> : null}{issuePage < issuePageCount ? <Link href={qualityHref(status, categorySlug, issueCode, query, issuePage + 1)}>Следующая →</Link> : null}</div></nav> : null}
      </section>
    </div></section>
  </main><PilotFooter /></div>;
}

function SummaryCard({ label, value, note, tone = "neutral" }: { label: string; value: number; note: string; tone?: "neutral" | CatalogQualityStatus }) {
  return <div className={`catalog-quality-summary-card catalog-quality-summary-card--${tone}`}><span>{label}</span><b>{value.toLocaleString("ru-RU")}</b><small>{note}</small></div>;
}

function StatusBadge({ status }: { status: CatalogQualityStatus }) {
  return <span className={`catalog-quality-status catalog-quality-status--${status}`}>{status === "critical" ? "Критично" : status === "review" ? "Проверить" : "Готово"}</span>;
}

function Metric({ label, value }: { label: string; value: number | null }) {
  return <div><span>{label}</span><b>{value == null ? "—" : `${value}%`}</b><i aria-hidden="true"><em style={{ width:value == null ? "0" : `${value}%` }} /></i></div>;
}

function IssueRow({ issue }: { issue: CatalogQualityIssue }) {
  return <li><div className="catalog-quality-issue-head"><span className={`catalog-quality-severity catalog-quality-severity--${issue.severity}`}>{issue.severity === "critical" ? "Критично" : issue.severity === "warning" ? "Проверить" : "Уведомление"}</span><Link href={`/catalog/category/${issue.categorySlug}`}>{issue.categoryTitle}</Link></div><div className="catalog-quality-issue-copy"><b>{issue.title}</b><p>{issue.detail}</p><small>{issue.brand || "Бренд не указан"}{issue.sku ? ` · Артикул ${issue.sku}` : " · Без артикула"}{issue.variantId ? ` · Исполнение ${issue.variantId}` : ""}</small></div><Link className="catalog-quality-product-link" href={`/product/${issue.productSlug}`}><span>{issue.productTitle}</span><b>Открыть товар →</b></Link></li>;
}

function EmptyState() {
  return <div className="catalog-quality-empty"><b>По выбранным условиям записей нет</b><p>Сбросьте фильтры — исходные данные не изменены.</p><Link href="/test/catalog-quality">Показать весь отчёт</Link></div>;
}

function normalizeStatus(value?: string): CatalogQualityStatus | "all" {
  return value === "critical" || value === "review" || value === "healthy" ? value : "all";
}

function normalizeIssue(value: string | undefined, issues: CatalogQualityIssue[]): CatalogQualityIssueCode | "all" {
  return issues.some((issue) => issue.code === value) ? value as CatalogQualityIssueCode : "all";
}

function matchesQuery(issue: CatalogQualityIssue, query: string): boolean {
  if (!query) return true;
  const normalized = query.toLocaleLowerCase("ru-RU");
  return [issue.productTitle, issue.brand, issue.sku, issue.detail, issue.categoryTitle].filter(Boolean).join(" ").toLocaleLowerCase("ru-RU").includes(normalized);
}

function normalizePage(value?: string): number {
  const parsed = Number.parseInt(String(value ?? "1"), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 10_000) : 1;
}

function qualityHref(status: CatalogQualityStatus | "all", category: string, issue: CatalogQualityIssueCode | "all", query: string, page: number): string {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (category !== "all") params.set("category", category);
  if (issue !== "all") params.set("issue", issue);
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  return `/test/catalog-quality${params.size ? `?${params}` : ""}`;
}
