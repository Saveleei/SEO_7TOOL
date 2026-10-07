import Image from "next/image";
import Link from "next/link";
import { orderTrustCardsForDisplay, trustCardDisplayKicker, trustCardImageUrl, type TrustContentSettings } from "../data/trustContentModel";

export function TrustSection({ content }: { content: TrustContentSettings }) {
  return <section className="section assurance-section" aria-labelledby="assurance-title"><div className="container">
    <div className="section-heading assurance-heading"><div><p className="eyebrow">{content.sectionEyebrow}</p><h2 id="assurance-title">{content.sectionTitle}</h2></div><p>Реальные склад, комплектация, проверка и отгрузка — без постановочных иллюстраций.</p></div>
    <div className="assurance-gallery-meta"><b>6 реальных фотографий</b><span>Склад · комплектация · проверка · отгрузка</span></div>
    <div className="assurance-grid" aria-label="Фотографии склада, комплектации, подбора и отгрузки">
      {orderTrustCardsForDisplay(content.cards).map((card, index) => {
        return <article className="assurance-photo-card" key={card.id}>
          <div className="assurance-photo-card__media"><Image src={trustCardImageUrl(card)} alt={card.imageAlt} width={520} height={300} unoptimized={Boolean(card.imageAssetId)} /><span>{trustCardDisplayKicker(card, index)}</span></div>
          <div className="assurance-photo-card__content"><h3>{card.title}</h3></div>
        </article>;
      })}
    </div>
    <div className="assurance-summary"><p><b>До оплаты:</b> подтверждаем исполнение, комплектность, цену и срок в КП.</p><p><b>Для бухгалтерии:</b> счёт с НДС, УПД и закрывающие документы.</p><Link href="/company">Как работает 7TOOL →</Link></div>
  </div></section>;
}
