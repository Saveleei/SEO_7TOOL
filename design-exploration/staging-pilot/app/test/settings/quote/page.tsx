import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireManagerPageAccess } from "../../../data/managerAccessPage";
import { getQuoteTemplateSettings } from "../../../data/quoteTemplateStore";
import { isQuoteTestModeEnabled } from "../../../data/quoteRequestStore";
import { Breadcrumbs } from "../../../ui/Breadcrumbs";
import { PilotFooter } from "../../../ui/PilotFooter";
import { PilotHeader } from "../../../ui/PilotHeader";
import { QuoteTemplateSettingsForm } from "../../../ui/QuoteTemplateSettingsForm";

export const metadata: Metadata = { title:"Настройки коммерческих предложений — 7TOOL", robots:{ index:false, follow:false, nocache:true } };
export const dynamic = "force-dynamic";

export default async function QuoteSettingsPage() {
  if (!isQuoteTestModeEnabled()) notFound();
  const actor = await requireManagerPageAccess("settings:manage", "/test/settings/quote");
  const settings = await getQuoteTemplateSettings();
  return <div className="site-shell"><PilotHeader managerMode managerActor={actor} /><main className="inner-page quote-settings-page">
    <div className="container"><Breadcrumbs items={[{ label:"Главная", href:"/" }, { label:"Заявки", href:"/test/requests" }, { label:"Настройки КП" }]} /></div>
    <section className="quote-settings-hero"><div className="container"><div><p className="eyebrow">Локальный административный контур</p><h1>Настройки коммерческих предложений</h1><p>Единые реквизиты, подписанты и стартовые условия — без изменения уже сохранённых редакций.</p></div><Link href="/test/requests">← К журналу заявок</Link></div></section>
    <section className="section"><div className="container"><QuoteTemplateSettingsForm initial={settings} /></div></section>
  </main><PilotFooter /></div>;
}
