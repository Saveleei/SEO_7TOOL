"use client";

import Image from "next/image";
import { maxUrl, siteContact, telegramUrl } from "../data/contactConfig";

export { maxUrl, telegramUrl };

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
      <a href={telegramUrl} target="_blank" rel="noopener noreferrer" aria-label={`Написать ${siteContact.managerName} в Telegram`}><i aria-hidden="true">T</i><span><b>Telegram</b><small>Написать менеджеру</small></span></a>
      <a href={maxUrl} target="_blank" rel="noopener noreferrer" aria-label={`Написать ${siteContact.managerName} в MAX`}><i aria-hidden="true">M</i><span><b>MAX</b><small>Написать менеджеру</small></span></a>
    </div>
    {!compact && <small className="manager-contact-note">Опишите задачу, укажите известную модель или пришлите ссылку — менеджер продолжит диалог уже с нужным контекстом.</small>}
  </aside>;
}
