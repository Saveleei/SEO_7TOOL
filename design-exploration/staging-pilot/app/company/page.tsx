import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getProductionCategoryGroups, pilotFeedCategorySlugs } from "../data/productionCategoryGroups";
import { PublicInfoContact, PublicInfoPage } from "../ui/PublicInfoPage";

export const metadata: Metadata = { title:"О компании — 7TOOL", description:"7TOOL — промышленное оборудование и оснастка для задач металлообработки." };

export default function CompanyPage() {
  const groups = getProductionCategoryGroups(pilotFeedCategorySlugs);
  const categoryCount = new Set(groups.flatMap((group) => group.subcategories.map((category) => category.slug))).size;
  return <PublicInfoPage currentPath="/company" eyebrow="О 7TOOL" title="Поставщик для задач металлообработки" intro="7TOOL помогает выбрать оборудование и оснастку под операцию, проверить конкретное исполнение и подготовить коммерческое предложение с согласованными условиями." asideTitle="Сначала применимость, затем счёт" asideText="Цена, наличие, совместимость, документы и дата отгрузки подтверждаются по выбранному товару до оплаты." heroVisual={<div className="public-hero-catalog"><header><span>Фактический каталог</span><b>{groups.length} направлений · {formatCategoryCount(categoryCount)}</b></header><div>{groups.slice(0, 3).map((group) => <Link href={group.href} key={group.slug}><Image src={group.representativeImage ?? group.image} alt="" width={150} height={98} unoptimized={Boolean(group.representativeImage)} /><span>{group.title}</span></Link>)}</div><Link href="/catalog">Перейти в каталог →</Link></div>}>
    <section className="section public-info-section"><div className="container">
      <div className="public-info-heading"><p className="eyebrow">Что делает 7TOOL</p><h2>Не просто витрина с артикулами</h2><p>Каталог помогает сузить выбор, а менеджер проверяет то, что нельзя надёжно решить одной карточкой товара.</p></div>
      <ol className="public-service-rail"><li><span>01</span><div><h3>Подбор по задаче</h3><p>Операции, материала и результата достаточно — артикул не обязателен.</p></div></li><li><span>02</span><div><h3>Проверка исполнения</h3><p>Сопоставляем характеристики, оснастку и требования к комплекту.</p></div></li><li><span>03</span><div><h3>Условия в одном КП</h3><p>Фиксируем цену, НДС, наличие, срок и состав поставки.</p></div></li></ol>
    </div></section>
    <section className="section section-muted public-info-section"><div className="container">
      <div className="public-info-heading public-info-heading--split"><div><p className="eyebrow">Фактический каталог</p><h2>{groups.length} производственных направлений</h2></div><p>{categoryCount} категории с товарами в текущей опубликованной витрине. Состав разделов обновляется из единого каталога.</p></div>
      <div className="public-direction-showcase">{groups.map((group) => <Link href={group.href} key={group.slug}><Image src={group.representativeImage ?? group.image} alt="" width={260} height={150} unoptimized={Boolean(group.representativeImage)} /><span>{group.id}</span><div><b>{group.title}</b><small>{formatCategoryCount(group.subcategories.length)}</small></div><i aria-hidden="true">→</i></Link>)}</div>
    </div></section>
    <section className="section public-info-section"><div className="container public-info-two-column"><div><p className="eyebrow">Принцип работы</p><h2>Не показываем уверенность там, где нужна проверка</h2></div><div className="public-info-checklist"><p><b>Данные товара</b><span>Используем опубликованные характеристики и конкретные исполнения из фида.</span></p><p><b>Наличие и отгрузка</b><span>Обещание зависит от подтверждённого положительного остатка и рабочего времени.</span></p><p><b>Документы</b><span>Паспорт, сертификаты и гарантийные условия проверяются по конкретному артикулу.</span></p></div></div></section>
    <PublicInfoContact title="Обсудить производственную задачу" text="Сообщите операцию, материал, размеры и режим работы. Если есть ТЗ или известная модель, приложите их к запросу КП." placement="company_page" />
  </PublicInfoPage>;
}

function formatCategoryCount(count: number) {
  const mod100 = count % 100;
  const mod10 = count % 10;
  const noun = mod100 >= 11 && mod100 <= 14 ? "категорий" : mod10 === 1 ? "категория" : mod10 >= 2 && mod10 <= 4 ? "категории" : "категорий";
  return `${count} ${noun}`;
}
