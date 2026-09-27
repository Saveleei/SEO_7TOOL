import type { Metadata } from "next";
import { getQuoteTemplateSettings } from "../data/quoteTemplateStore";
import { siteCompany, siteContact } from "../data/contactConfig";
import { ManagerContactCard } from "../ui/ManagerContactCard";
import { PublicInfoPage } from "../ui/PublicInfoPage";
import { createPublicMetadata } from "../data/seo";

export const metadata: Metadata = createPublicMetadata({ title:"Контакты и реквизиты 7TOOL", description:"Телефон, email, Telegram, MAX, адрес и реквизиты 7TOOL. Связь по подбору оборудования, коммерческим предложениям и поставкам.", path:"/contacts" });
export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const settings = await getQuoteTemplateSettings();
  const seller = settings.seller;
  const registration = [["ИНН", seller.inn], ["КПП", seller.kpp], ["ОГРН / ОГРНИП", seller.ogrn]].filter((item) => item[1]);
  return <PublicInfoPage currentPath="/contacts" eyebrow="Связаться с 7TOOL" title="Контакты и реквизиты" intro="Выберите удобный канал для вопроса по товару, подбора или запроса коммерческого предложения." asideTitle="Один менеджер сохраняет контекст" asideText="Передайте ссылку на товар, известную модель или параметры задачи — повторно объяснять запрос не потребуется." heroVisual={<ManagerContactCard compact placement="contacts_hero" />}>
    <section className="section public-info-section"><div className="container public-contact-layout">
      <div className="public-contact-channels" data-contact-placement="contacts_page"><a href={siteContact.phoneHref}><span>Телефон</span><b>{siteContact.phone}</b><small>{siteCompany.hours}</small></a><a href={`mailto:${siteContact.email}`}><span>Электронная почта</span><b>{siteContact.email}</b><small>Запросы, ТЗ и реквизиты</small></a><a href={siteContact.telegramUrl} target="_blank" rel="noopener noreferrer"><span>Мессенджер</span><b>Telegram</b><small>Написать Евгению Савельеву</small></a><a href={siteContact.maxUrl} target="_blank" rel="noopener noreferrer"><span>Мессенджер</span><b>MAX</b><small>Написать Евгению Савельеву</small></a></div>
      <aside className="public-company-card"><span>Организация</span><h2>{seller.legalName || siteCompany.legalName}</h2><dl><div><dt>Торговое наименование</dt><dd>{seller.brandName || siteCompany.brandName}</dd></div><div><dt>Адрес</dt><dd>{seller.legalAddress || siteCompany.address}</dd></div><div><dt>Сайт</dt><dd>{siteCompany.website}</dd></div>{registration.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p>Банковские реквизиты передаются в выставленном счёте и договоре. На публичной странице неполные данные не показываются.</p></aside>
    </div></section>
    <section className="section section-muted public-info-section"><div className="container public-info-two-column"><div><p className="eyebrow">Перед обращением</p><h2>Что приложить для быстрого ответа</h2></div><div className="public-info-checklist"><p><b>По конкретному товару</b><span>Ссылку, модель или выбранное исполнение.</span></p><p><b>Для подбора</b><span>Операцию, материал, основные размеры и режим работы.</span></p><p><b>Для счёта</b><span>ИНН либо карточку организации после согласования состава заказа.</span></p></div></div></section>
  </PublicInfoPage>;
}
