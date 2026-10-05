import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getHomepageContentSettings } from "../../../data/homepageContentStore";
import { requireManagerPageAccess } from "../../../data/managerAccessPage";
import { getHomepageKeyCategories, getProductionCategoryGroups, pilotFeedCategorySlugs } from "../../../data/productionCategoryGroups";
import { isQuoteTestModeEnabled } from "../../../data/quoteRequestStore";
import { Breadcrumbs } from "../../../ui/Breadcrumbs";
import { HomepageContentSettingsForm, type HomepageCatalogReference } from "../../../ui/HomepageContentSettingsForm";
import { PilotFooter } from "../../../ui/PilotFooter";
import { PilotHeader } from "../../../ui/PilotHeader";

export const metadata: Metadata = { title:"Витрина и каталог — 7TOOL", robots:{ index:false, follow:false, nocache:true } };
export const dynamic = "force-dynamic";

export default async function HomepageSettingsPage() {
  if (!isQuoteTestModeEnabled()) notFound();
  const actor = await requireManagerPageAccess("settings:manage", "/test/settings/homepage");
  const settings = await getHomepageContentSettings();
  const groups = getProductionCategoryGroups(pilotFeedCategorySlugs);
  const categories = getHomepageKeyCategories();
  const references: HomepageCatalogReference[] = [
    ...groups.map((group) => ({ id:group.slug, href:group.href, count:group.productCount ?? 0, fallbackImage:group.representativeImage ?? group.image })),
    ...categories.map((category) => ({ id:category.slug, href:category.href, count:category.count ?? 0, fallbackImage:category.image || "/brand/7tool-primary.svg" })),
  ];
  return <div className="site-shell"><PilotHeader managerMode managerActor={actor} /><main className="inner-page homepage-settings-page">
    <div className="container"><Breadcrumbs items={[{ label:"Главная", href:"/" }, { label:"Заявки", href:"/test/requests" }, { label:"Настройки главной" }]} /></div>
    <section className="quote-settings-hero"><div className="container"><div><p className="eyebrow">Управление витриной</p><h1>Главная и каталог</h1><p>Меняйте тексты и фотографии главной страницы и направлений общего каталога. Размеры карточек, ссылки и товарные данные защищены шаблоном.</p></div><div className="homepage-settings-hero-actions"><Link href="/admin/trust">Фото блока доверия →</Link><Link href="/" target="_blank">Открыть главную →</Link><Link href="/catalog" target="_blank">Открыть каталог →</Link></div></div></section>
    <section className="section"><div className="container"><HomepageContentSettingsForm initial={settings} references={references} /></div></section>
  </main><PilotFooter /></div>;
}
