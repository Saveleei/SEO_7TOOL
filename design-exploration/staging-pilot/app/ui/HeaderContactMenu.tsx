import { siteContact } from "../data/contactConfig";

export function HeaderContactMenu({ compact = false, placement }: { compact?: boolean; placement: string }) {
  return <details className={`header-contact-menu${compact ? " header-contact-menu--compact" : ""}`} data-contact-placement={placement}>
    <summary aria-label={`Связаться с 7TOOL, телефон ${siteContact.phone}`}>
      <span>Связаться</span>
      <b>{compact ? "Менеджер" : siteContact.phone}</b>
    </summary>
    <div className="header-contact-panel">
      <header><span>Персональный менеджер</span><b>{siteContact.managerName}</b><small>{siteContact.managerRole}</small></header>
      <a href={siteContact.phoneHref} aria-label={`Позвонить ${siteContact.managerName}`}><span>Телефон</span><b>{siteContact.phone}</b></a>
      <a href={`mailto:${siteContact.email}?subject=Вопрос%20по%20оборудованию`} aria-label={`Написать ${siteContact.managerName} на email`}><span>Email</span><b>{siteContact.email}</b></a>
      <div>
        <a href={siteContact.telegramUrl} target="_blank" rel="noopener noreferrer" aria-label={`Написать ${siteContact.managerName} в Telegram`}><i aria-hidden="true">T</i>Telegram</a>
        <a href={siteContact.maxUrl} target="_blank" rel="noopener noreferrer" aria-label={`Написать ${siteContact.managerName} в MAX`}><i aria-hidden="true">M</i>MAX</a>
      </div>
    </div>
  </details>;
}
