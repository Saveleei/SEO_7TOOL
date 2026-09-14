import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireManagerPageAccess } from "../../../data/managerAccessPage";
import { isQuoteTestModeEnabled } from "../../../data/quoteRequestStore";
import { getTrustContentSettings } from "../../../data/trustContentStore";
import { Breadcrumbs } from "../../../ui/Breadcrumbs";
import { PilotFooter } from "../../../ui/PilotFooter";
import { PilotHeader } from "../../../ui/PilotHeader";
import { TrustContentSettingsForm } from "../../../ui/TrustContentSettingsForm";

export const metadata: Metadata = { title:"Блоки доверия — 7TOOL", robots:{ index:false, follow:false, nocache:true } };
export const dynamic = "force-dynamic";

export default async function TrustSettingsPage() {
  if (!isQuoteTestModeEnabled()) notFound();
  const actor = await requireManagerPageAccess("settings:manage", "/test/settings/trust");
  const settings = await getTrustContentSettings();
  return <div className="site-shell"><PilotHeader managerMode managerActor={actor} /><main className="inner-page trust-settings-page">
    <div className="container"><Breadcrumbs items={[{ label:"Главная", href:"/" }, { label:"Заявки", href:"/test/requests" }, { label:"Блоки доверия" }]} /></div>
    <section className="quote-settings-hero"><div className="container"><div><p className="eyebrow">Контент главной страницы</p><h1>Блоки доверия</h1><p>Редактируйте проверяемые формулировки и фотографии без изменения исходного кода.</p></div><Link href="/#assurance-title">Открыть блок на главной →</Link></div></section>
    <section className="section"><div className="container"><TrustContentSettingsForm initial={settings} /></div></section>
  </main><PilotFooter /></div>;
}
