import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "../../../ui/Breadcrumbs";
import { PilotFooter } from "../../../ui/PilotFooter";
import { PilotHeader } from "../../../ui/PilotHeader";
import { ManagerContactCard } from "../../../ui/ManagerContactCard";
import { getProductionSubcategory } from "../../../data/productionCategoryGroups";
import { getCategoryLandingContent } from "../../../data/categoryLandingContent";

type RouteProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { slug } = await params;
  const entry = getProductionSubcategory(slug);
  return { title: entry ? `${entry.subcategory.label} — тестовый каталог 7TOOL` : "Категория — 7TOOL", description:entry ? `${entry.subcategory.label}: инженерный подбор, ориентиры цены и подтверждение срока поставки.` : undefined, robots:{ index:false, follow:false } };
}

export default async function SubcategoryPage({ params }: RouteProps) {
  const { slug } = await params;
  const entry = getProductionSubcategory(slug);
  if (!entry) return <div className="site-shell"><PilotHeader /><main className="inner-page"><section className="section"><div className="container empty-result"><b>Категория не найдена в активном фиде</b><p>Вернитесь в каталог или отправьте задачу инженеру.</p><Link href="/catalog">Открыть каталог →</Link></div></section></main><PilotFooter /></div>;
  const { group, subcategory } = entry;
  const landing = getCategoryLandingContent(group.slug);
  const subject = encodeURIComponent(`Запрос: ${subcategory.label}`);
  return <div className="site-shell"><PilotHeader /><main className="inner-page">
    <div className="container"><Breadcrumbs items={[{label:"Главная",href:"/"},{label:"Каталог",href:"/catalog"},{label:group.title,href:group.href},{label:subcategory.label}]} /></div>
    <section className="page-hero"><div className="container page-hero-grid"><div><p className="eyebrow">{group.title}</p><h1>{subcategory.label}</h1><p>{landing.intro} Ассортимент, цена, наличие и срок должны приходить из фида и подтверждаться для выбранной позиции.</p></div><aside><b>Нужен подбор?</b><p>Укажите основные параметры задачи. Можно начать без артикула и точной модели.</p><a href={`mailto:info@7tool.ru?subject=${subject}`}>Отправить параметры →</a></aside></div></section>
    <section className="section"><div className="container subcategory-layout"><div><div className="section-heading"><div><p className="eyebrow">Критерии выбора</p><h2>Три группы данных для инженера</h2></div></div><div className="category-parameter-grid category-parameter-grid--compact">{landing.parameters.map((parameter,index)=><article key={parameter.title}><span>0{index+1}</span><b>{parameter.title}</b><p>{parameter.copy}</p></article>)}</div><div className="feed-state"><span>Состояние пилота</span><h2>Товарная выдача этой подкатегории ещё не подключена</h2><p>Мы не показываем демонстрационные остатки как реальные. После подключения фида здесь появятся только фактические позиции, ориентиры цены и честный статус доступности.</p><a className="button button-orange" href={`mailto:info@7tool.ru?subject=${subject}`}>Запросить подбор</a></div></div><aside><ManagerContactCard compact /></aside></div></section>
    <section className="section section-muted"><div className="container"><div className="section-heading"><div><p className="eyebrow">В той же производственной задаче</p><h2>Смежные подкатегории</h2></div></div><nav className="related-category-links" aria-label="Смежные подкатегории">{group.subcategories.filter((item)=>item.slug!==subcategory.slug).map((item)=><Link href={item.href} key={item.slug}>{item.label}<span>→</span></Link>)}</nav></div></section>
  </main><PilotFooter /></div>;
}
