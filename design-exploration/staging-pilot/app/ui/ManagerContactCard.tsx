"use client";

import Image from "next/image";

export const telegramUrl = "https://t.me/saveleei";
export const maxUrl = "https://max.ru/u/f9LHodD0cOJKwt-kjzgvpW6TLCZbS3ML8WWdL8lPJjF2ceK2seLyXaNOl8w";

export function ManagerContactCard({ compact = false, placement = "manager_card", productId }: { compact?: boolean; placement?: string; productId?: string }) {
  function track(channel: "phone" | "email" | "telegram" | "max") {
    const event = channel === "phone" ? "PHONE_CLICK" : channel === "email" ? "EMAIL_CLICK" : "click_messenger";
    window.dispatchEvent(new CustomEvent("7tool:prototype-event", { detail:{ event, channel, placement, page_type:productId ? "product" : "other", ...(productId ? { product_id:productId } : {}) } }));
  }

  return <aside className={`manager-contact-card ${compact ? "manager-contact-card--compact" : ""}`} aria-label="Контакт персонального менеджера">
    <div className="manager-contact-head">
      <Image src="/people/manager.jpg" alt="Евгений Савельев, менеджер 7TOOL" width={76} height={76} />
      <div><span>Ваш персональный менеджер</span><h2>Евгений Савельев</h2><p>Проверит наличие, совместимость оснастки и условия поставки.</p></div>
    </div>
    <div className="manager-contact-direct">
      <a href="tel:+79626112419" aria-label="Позвонить Евгению Савельеву" onClick={() => track("phone")}><span>Позвонить</span><b>+7 (962) 611-24-19</b></a>
      <a href="mailto:info@7tool.ru?subject=Вопрос%20по%20оборудованию" aria-label="Написать Евгению Савельеву на email" onClick={() => track("email")}><span>Написать на почту</span><b>info@7tool.ru</b></a>
    </div>
    <div className="manager-messengers" aria-label="Написать менеджеру в мессенджере">
      <a href={telegramUrl} target="_blank" rel="noopener noreferrer" aria-label="Написать Евгению Савельеву в Telegram" onClick={() => track("telegram")}><i aria-hidden="true">T</i><span><b>Telegram</b><small>Написать менеджеру</small></span></a>
      <a href={maxUrl} target="_blank" rel="noopener noreferrer" aria-label="Написать Евгению Савельеву в MAX" onClick={() => track("max")}><i aria-hidden="true">M</i><span><b>MAX</b><small>Написать менеджеру</small></span></a>
    </div>
    {!compact && <small className="manager-contact-note">Опишите задачу, укажите известную модель или пришлите ссылку — менеджер продолжит диалог уже с нужным контекстом.</small>}
  </aside>;
}
