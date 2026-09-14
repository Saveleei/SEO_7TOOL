import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireManagerPageAccess } from "../../../data/managerAccessPage";
import { isQuoteTestModeEnabled } from "../../../data/quoteRequestStore";
import { getShippingRuntimeDiagnostic } from "../../../data/shippingRuntimeSettings.mjs";
import { getShippingSettings } from "../../../data/shippingSettingsStore";
import { Breadcrumbs } from "../../../ui/Breadcrumbs";
import { PilotFooter } from "../../../ui/PilotFooter";
import { PilotHeader } from "../../../ui/PilotHeader";
import { ShippingSettingsForm } from "../../../ui/ShippingSettingsForm";

export const metadata: Metadata = { title:"Настройки отгрузки — 7TOOL", robots:{ index:false, follow:false, nocache:true } };
export const dynamic = "force-dynamic";

export default async function ShippingSettingsPage() {
  if (!isQuoteTestModeEnabled()) notFound();
  const actor = await requireManagerPageAccess("settings:manage", "/test/settings/shipping");
  const settings = await getShippingSettings();
  const diagnostic = getShippingRuntimeDiagnostic();
  return <div className="site-shell"><PilotHeader managerMode managerActor={actor} /><main className="inner-page shipping-settings-page">
    <div className="container"><Breadcrumbs items={[{ label:"Главная", href:"/" }, { label:"Заявки", href:"/test/requests" }, { label:"Настройки отгрузки" }]} /></div>
    <section className="quote-settings-hero"><div className="container"><div><p className="eyebrow">Контроль обещаний покупателю</p><h1>Настройки отгрузки</h1><p>Одно серверное правило для каталога, поиска, карточки товара и корзины.</p></div><Link href="/test/requests">← К журналу заявок</Link></div></section>
    <section className="section"><div className="container"><ShippingSettingsForm initial={settings} initialDiagnostic={diagnostic} /></div></section>
  </main><PilotFooter /></div>;
}
