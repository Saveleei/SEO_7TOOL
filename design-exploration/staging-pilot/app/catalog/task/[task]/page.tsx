import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Breadcrumbs } from "../../../ui/Breadcrumbs";
import { PilotFooter } from "../../../ui/PilotFooter";
import { PilotHeader } from "../../../ui/PilotHeader";
import { ManagerContactCard } from "../../../ui/ManagerContactCard";
import { getProductionCategoryGroup } from "../../../data/productionCategoryGroups";
import { getCategoryLandingContent } from "../../../data/categoryLandingContent";

type RouteProps = { params: Promise<{ task: string }> };

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { task } = await params;
  const group = getProductionCategoryGroup(task);
  return { title: group ? `${group.title} — тестовый каталог 7TOOL` : "Раздел каталога — 7TOOL", robots:{ index:false, follow:false } };
}

export default async function ProductionTaskPage({ params }: RouteProps) {
  const { task } = await params;
  const group = getProductionCategoryGroup(task);
  if (!group) return <div className="site-shell"><PilotHeader /><main className="inner-page"><section className="section"><div className="container empty-result"><b>Такого направления нет в текущем каталоге</b><p>Вернитесь в каталог или опишите производственную задачу инженеру.</p><Link href="/catalog">Открыть каталог →</Link></div></section></main><PilotFooter /></div>;
  const landing = getCategoryLandingContent(group.slug);
  return <div className="site-shell"><PilotHeader /><main className="inner-page">
    <div className="container"><Breadcrumbs items={[{label:"Главная",href:"/"},{label:"Каталог",href:"/catalog"},{label:group.title}]} /></div>
    <section className="page-hero"><div className="container page-hero-grid"><div><p className="eyebrow">Производственная задача · {group.id}</p><h1>{group.title}</h1><p>{landing.intro} Выберите конкретный тип оборудования или оснастки ниже.</p></div><aside><b>Не знаете подкатегорию?</b><p>Опишите операцию и изделие. Инженер направит запрос в нужный раздел и проверит возможную поставку.</p><div className="page-hero-request-actions"><Link href={`/?task=${encodeURIComponent(`${group.title}: нужна помощь с выбором`)}#quick-order`}>Описать задачу →</Link><Link href={`/?request=spec&task=${encodeURIComponent(group.title)}#quick-order`}>Передать ТЗ файлом</Link></div><small>Или напишите на <a href={`mailto:info@7tool.ru?subject=${encodeURIComponent(`Подбор: ${group.title}`)}`}>info@7tool.ru</a></small></aside></div></section>
    <section className="section"><div className="container"><div className="section-heading"><div><p className="eyebrow">Категории с товарами</p><h2>Выберите тип оборудования</h2></div><p>Показаны только опубликованные разделы. Количество и изображения получены из текущей витрины каталога.</p></div><div className="task-landing-grid">{group.subcategories.map((subcategory,index)=><article className="task-subcategory-card" key={subcategory.slug}><span>{String(index+1).padStart(2,"0")}</span><Image src={subcategory.image ?? group.image} alt="" width={250} height={150} unoptimized={Boolean(subcategory.image)} /><div><small>{formatSeriesCount(subcategory.count ?? 0)}</small><h2><Link href={subcategory.href}>{subcategory.label}</Link></h2><p>{group.accent}</p><Link href={subcategory.href}>Перейти к товарам →</Link></div></article>)}</div></div></section>
    <section className="section section-muted"><div className="container category-parameter-grid"><div><p className="eyebrow">До выбора модели</p><h2>Что влияет на результат</h2></div>{landing.parameters.map((parameter,index)=><article key={parameter.title}><span>0{index+1}</span><b>{parameter.title}</b><p>{parameter.copy}</p></article>)}</div></section>
    <section className="section"><div className="container category-manager-row"><div><p className="eyebrow">Помощь с маршрутом</p><h2>Можно начать с обычного описания задачи</h2><p>Точный артикул не нужен. Менеджер уточнит параметры и вернёт подходящие позиции с подтверждёнными условиями.</p></div><ManagerContactCard compact /></div></section>
  </main><PilotFooter /></div>;
}

function formatSeriesCount(count: number): string {
  const modulo100 = count % 100;
  const modulo10 = count % 10;
  const noun = modulo100 >= 11 && modulo100 <= 14 ? "товарных серий" : modulo10 === 1 ? "товарная серия" : modulo10 >= 2 && modulo10 <= 4 ? "товарные серии" : "товарных серий";
  return `${count.toLocaleString("ru-RU")} ${noun}`;
}
