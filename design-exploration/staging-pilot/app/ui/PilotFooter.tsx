import Link from "next/link";
import Image from "next/image";
import { siteCompany, siteContact } from "../data/contactConfig";

export function PilotFooter() {
  return (
    <footer className="footer">
      <div className="container footer-main">
        <div className="footer-identity">
          <Link href="/" aria-label="7TOOL — главная"><Image src="/brand/7tool-inverse.svg" alt="7TOOL" width={135} height={42} /></Link>
          <p>Промышленное оборудование и оснастка для металлообработки.</p>
          <span>Локальный тестовый пилот · внешняя отправка заявок отключена.</span>
        </div>
        <nav aria-label="Каталог"><b>Каталог</b><Link href="/catalog">Все категории</Link><Link href="/#production-categories">Подбор по задаче</Link><Link href="/compare">Сравнение</Link></nav>
        <nav aria-label="Покупателям"><b>Покупателям</b><Link href="/ordering">Как заказать</Link><Link href="/payment">Оплата</Link><Link href="/delivery">Доставка</Link><Link href="/warranty">Гарантия и документы</Link></nav>
        <nav aria-label="Компания"><b>Компания</b><Link href="/company">О компании</Link><Link href="/contacts">Контакты и реквизиты</Link></nav>
        <div className="footer-contacts" data-contact-placement="footer">
          <b>Связаться</b>
          <a href={siteContact.phoneHref} aria-label={`Позвонить ${siteContact.managerName}`}>{siteContact.phone}</a>
          <a href={`mailto:${siteContact.email}`} aria-label="Написать 7TOOL по email">{siteContact.email}</a>
          <div><a href={siteContact.telegramUrl} target="_blank" rel="noopener noreferrer" aria-label="Написать 7TOOL в Telegram">Telegram</a><a href={siteContact.maxUrl} target="_blank" rel="noopener noreferrer" aria-label="Написать 7TOOL в MAX">MAX</a></div>
        </div>
      </div>
      <div className="footer-bottom">
        <div className="container"><span>{siteCompany.legalName}</span><span>{siteCompany.address}</span><span>{siteCompany.hours}</span></div>
      </div>
    </footer>
  );
}
