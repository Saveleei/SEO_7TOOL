"use client";

import Image from "next/image";
import { maxUrl, siteContact, telegramUrl } from "../data/contactConfig";

export { maxUrl, telegramUrl };

function TelegramMark() {
  return <span className="manager-messenger-mark manager-messenger-mark--telegram" aria-hidden="true"><svg viewBox="0 0 128 128" focusable="false"><circle cx="64" cy="64" r="64" fill="#229ED9" /><path fill="#fff" fillRule="nonzero" d="M28.97 63.324c18.657-8.129 31.098-13.488 37.323-16.076 17.774-7.393 21.467-8.677 23.874-8.72.53-.009 1.713.122 2.48.745.648.525.826 1.235.911 1.733.086.498.192 1.633.107 2.519-.963 10.12-5.13 34.678-7.25 46.013-.898 4.796-2.664 6.404-4.375 6.561-3.716.342-6.538-2.456-10.138-4.815-5.633-3.693-8.815-5.991-14.283-9.594-6.319-4.164-2.222-6.453 1.379-10.193.942-.979 17.318-15.874 17.634-17.225.04-.169.077-.799-.297-1.131-.375-.333-.927-.219-1.326-.129-.565.129-9.563 6.076-26.995 17.843-2.554 1.754-4.868 2.609-6.941 2.564-2.285-.049-6.68-1.292-9.948-2.354-4.008-1.303-7.194-1.992-6.916-4.204.144-1.153 1.731-2.332 4.761-3.536Z" /></svg></span>;
}

function MaxMark() {
  return <span className="manager-messenger-mark manager-messenger-mark--max" aria-hidden="true"><svg viewBox="0 0 100 100" focusable="false"><path fill="#fff" d="M50.76 0c27.53 0 49.12 22.34 49.12 49.89S77.61 99.23 51.02 99.23c-9.43 0-14.01-1.33-21.37-6.54-.5-.36-1.2-.26-1.63.19-5.66 6.04-20.17 10.28-20.83 2.03C7.19 80.53 0 71.18 0 49.61 0 21.3 23.22 0 50.76 0Zm.77 24.55c-13.07-.68-23.26 8.39-25.51 22.58-1.86 11.75 1.44 26.07 4.26 26.8 1.2.3 4.08-1.9 6.18-3.88.4-.37.99-.44 1.45-.15 3.27 2 6.97 3.5 11.05 3.71 13.42.7 25.3-9.8 26-23.21.71-13.42-10.01-25.14-23.43-25.85Z" /></svg></span>;
}

export function ManagerContactCard({ compact = false, placement = "manager_card", productId }: { compact?: boolean; placement?: string; productId?: string }) {
  return <aside className={`manager-contact-card ${compact ? "manager-contact-card--compact" : ""}`} aria-label="Контакт персонального менеджера" data-contact-placement={placement} data-product-id={productId}>
    <div className="manager-contact-head">
      <Image src={siteContact.photo} alt={`${siteContact.managerName}, менеджер 7TOOL`} width={76} height={76} />
      <div><span>Ваш персональный менеджер</span><h2>{siteContact.managerName}</h2><p>Проверит наличие, совместимость оснастки и условия поставки.</p></div>
    </div>
    <div className="manager-contact-direct">
      <a href={siteContact.phoneHref} aria-label={`Позвонить ${siteContact.managerName}`}><span>Позвонить</span><b>{siteContact.phone}</b></a>
      <a href={`mailto:${siteContact.email}?subject=Вопрос%20по%20оборудованию`} aria-label={`Написать ${siteContact.managerName} на email`}><span>Написать на почту</span><b>{siteContact.email}</b></a>
    </div>
    <div className="manager-messengers" aria-label="Написать менеджеру в мессенджере">
      <a href={telegramUrl} target="_blank" rel="noopener noreferrer" aria-label={`Написать ${siteContact.managerName} в Telegram`}><TelegramMark /><span><b>Telegram</b><small>Написать менеджеру</small></span></a>
      <a href={maxUrl} target="_blank" rel="noopener noreferrer" aria-label={`Написать ${siteContact.managerName} в MAX`}><MaxMark /><span><b>MAX</b><small>Написать менеджеру</small></span></a>
    </div>
    {!compact && <small className="manager-contact-note">Опишите задачу, укажите известную модель или пришлите ссылку — менеджер продолжит диалог уже с нужным контекстом.</small>}
  </aside>;
}
