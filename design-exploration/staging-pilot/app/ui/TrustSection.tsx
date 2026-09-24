import Image from "next/image";
import Link from "next/link";
import { TRUST_CARD_PRESENTATION, trustCardImageUrl, type TrustContentSettings } from "../data/trustContentModel";

export function TrustSection({ content }: { content: TrustContentSettings }) {
  return <section className="section assurance-section" aria-labelledby="assurance-title"><div className="container">
    <div className="section-heading"><div><p className="eyebrow">{content.sectionEyebrow}</p><h2 id="assurance-title">{content.sectionTitle}</h2></div><p>{content.sectionIntro}</p></div>
    <ol className="assurance-process" aria-label="Проверяемые этапы закупки">
      <li><span>01</span><div><b>Исходные данные</b><small>задача, материал, модель или спецификация</small></div></li>
      <li><span>02</span><div><b>Проверка</b><small>исполнение, комплектность и доступные документы</small></div></li>
      <li><span>03</span><div><b>Зафиксированный результат</b><small>позиции, цена и срок в коммерческом предложении</small></div></li>
    </ol>
    <div className="assurance-grid">
      {content.cards.map((card) => {
        const presentation = TRUST_CARD_PRESENTATION[card.id];
        return <article key={card.id}>
          <Image src={trustCardImageUrl(card)} alt={card.imageAlt} width={520} height={300} unoptimized={Boolean(card.imageAssetId)} />
          <div><span>{card.kicker}</span><h3>{card.title}</h3><p>{card.text}</p><ul className="assurance-proof-list">{presentation.proofs.map((proof) => <li key={proof}>{proof}</li>)}</ul><div className="assurance-outcome"><small>Результат для согласования</small><b>{card.outcome}</b></div><Link href={presentation.href}>{presentation.linkLabel} →</Link></div>
        </article>;
      })}
    </div>
    <nav className="assurance-evidence-links" aria-label="Проверяемая информация о покупке">
      <div><span>Можно проверить до обращения</span><b>Компания, документы и порядок поставки</b></div>
      <Link href="/company">Как работает 7TOOL</Link>
      <Link href="/warranty">Гарантия и документы</Link>
      <Link href="/delivery">Доставка и отгрузка</Link>
      <Link href="/ordering">Как оформить заказ</Link>
    </nav>
  </div></section>;
}
