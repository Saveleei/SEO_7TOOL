import Image from "next/image";

const telegramUrl = "https://t.me/saveleei";
const maxUrl = "https://max.ru/u/f9LHodD0cOJKwt-kjzgvpW6TLCZbS3ML8WWdL8lPJjF2ceK2seLyXaNOl8w";

export function ManagerContactCard({ compact = false }: { compact?: boolean }) {
  return <aside className={`manager-contact-card ${compact ? "manager-contact-card--compact" : ""}`} aria-label="Контакт персонального менеджера">
    <div className="manager-contact-head">
      <Image src="/people/manager.jpg" alt="Евгений Савельев, менеджер 7TOOL" width={76} height={76} />
      <div><span>Ваш персональный менеджер</span><h2>Евгений Савельев</h2><p>Проверит наличие, совместимость оснастки и условия поставки.</p></div>
    </div>
    <div className="manager-contact-direct">
      <a href="tel:+79626112419"><span>Позвонить</span><b>+7 (962) 611-24-19</b></a>
      <a href="mailto:info@7tool.ru?subject=Вопрос%20по%20оборудованию"><span>Написать на почту</span><b>info@7tool.ru</b></a>
    </div>
    <div className="manager-messengers" aria-label="Написать менеджеру в мессенджере">
      <a href={telegramUrl} target="_blank" rel="noopener noreferrer"><i aria-hidden="true">T</i><span><b>Telegram</b><small>Написать менеджеру</small></span></a>
      <a href={maxUrl} target="_blank" rel="noopener noreferrer"><i aria-hidden="true">M</i><span><b>MAX</b><small>Написать менеджеру</small></span></a>
    </div>
    {!compact && <small className="manager-contact-note">Укажите модель, артикул или пришлите ссылку — менеджер продолжит диалог уже с контекстом товара.</small>}
  </aside>;
}
