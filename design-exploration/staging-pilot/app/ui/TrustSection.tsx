"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { orderTrustCardsForDisplay, TRUST_CARD_PRESENTATION, trustCardDisplayKicker, trustCardImageUrl, type TrustContentSettings } from "../data/trustContentModel";

export function TrustSection({ content }: { content: TrustContentSettings }) {
  const [showAllMobile, setShowAllMobile] = useState(false);
  return <section className="section assurance-section" aria-labelledby="assurance-title"><div className="container">
    <div className="section-heading"><div><p className="eyebrow">{content.sectionEyebrow}</p><h2 id="assurance-title">{content.sectionTitle}</h2></div><p>{content.sectionIntro}</p></div>
    <ol className="assurance-process" aria-label="Проверяемые этапы закупки">
      <li><span>01</span><div><b>Исходные данные</b><small>задача, материал, модель или спецификация</small></div></li>
      <li><span>02</span><div><b>Проверка</b><small>исполнение, комплектность и доступные документы</small></div></li>
      <li><span>03</span><div><b>Зафиксированный результат</b><small>позиции, цена и срок в коммерческом предложении</small></div></li>
    </ol>
    <div className="assurance-gallery-meta"><b>6 реальных фотосюжетов</b><span>Склад, разные типы хранения, работа людей и отгрузка</span></div>
    <div className="assurance-grid" data-show-all={showAllMobile ? "true" : "false"} aria-label="Фотографии склада, комплектации, подбора и отгрузки">
      {orderTrustCardsForDisplay(content.cards).map((card, index) => {
        const presentation = TRUST_CARD_PRESENTATION[card.id];
        return <article className={`assurance-photo-card${index >= 3 ? " assurance-photo-card--secondary" : ""}`} key={card.id}>
          <div className="assurance-photo-card__media"><Image src={trustCardImageUrl(card)} alt={card.imageAlt} width={520} height={300} unoptimized={Boolean(card.imageAssetId)} /><span>{trustCardDisplayKicker(card, index)}</span></div>
          <div className="assurance-photo-card__content"><h3>{card.title}</h3><p>{card.text}</p><ul className="assurance-proof-list assurance-proof-list--single">{presentation.proofs.map((proof) => <li key={proof}>{proof}</li>).slice(0, 1)}</ul><div className="assurance-outcome"><small>Что получает покупатель</small><b>{card.outcome}</b></div><Link href={presentation.href}>{presentation.linkLabel} →</Link></div>
        </article>;
      })}
    </div>
    <button className="assurance-mobile-toggle" type="button" aria-expanded={showAllMobile} onClick={() => setShowAllMobile((visible) => !visible)}>{showAllMobile ? "Скрыть дополнительные фотографии" : "Показать ещё 3 фотографии"}<span aria-hidden="true">{showAllMobile ? "↑" : "↓"}</span></button>
    <p className="assurance-photo-note">Шесть фотографий показывают паллетное и мелкоячеистое хранение, работу сотрудников при комплектации и подготовку груза к отгрузке. Наличие конкретного исполнения и дату отправки подтверждаем перед счётом.</p>
    <nav className="assurance-evidence-links" aria-label="Проверяемая информация о покупке">
      <div><span>Можно проверить до обращения</span><b>Компания, документы и порядок поставки</b></div>
      <Link href="/company">Как работает 7TOOL</Link>
      <Link href="/warranty">Гарантия и документы</Link>
      <Link href="/delivery">Доставка и отгрузка</Link>
      <Link href="/ordering">Как оформить заказ</Link>
    </nav>
  </div></section>;
}
