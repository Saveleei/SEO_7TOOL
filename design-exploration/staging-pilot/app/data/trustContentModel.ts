export type TrustCardId = "applicability" | "documents" | "terms";
export type TrustCard = {
  id: TrustCardId;
  kicker: string;
  title: string;
  text: string;
  outcome: string;
  imageAssetId: string;
  imageAlt: string;
};
export type TrustContentSettings = {
  revision: number;
  updatedAt: string;
  sectionEyebrow: string;
  sectionTitle: string;
  sectionIntro: string;
  cards: TrustCard[];
};

export const TRUST_CARD_PRESENTATION: Record<TrustCardId, { image: string; href: string; linkLabel: string }> = {
  applicability:{ image:"/site/why-engineer.webp", href:"/company", linkLabel:"Как работает подбор" },
  documents:{ image:"/site/why-documents.webp", href:"/warranty", linkLabel:"Какие документы доступны" },
  terms:{ image:"/site/why-stock.webp", href:"/delivery", linkLabel:"Как фиксируем условия" },
};

export const DEFAULT_TRUST_CONTENT_SETTINGS: TrustContentSettings = Object.freeze({
  revision:0,
  updatedAt:"",
  sectionEyebrow:"Не обещания, а проверяемые этапы",
  sectionTitle:"Что снижает риск закупки",
  sectionIntro:"Инженер, документы и подтверждённые условия поставки находятся рядом с товаром — всё необходимое для решения собрано в одном месте.",
  cards:[
    { id:"applicability", kicker:"01 · Инженер", title:"Проверка применимости", text:"Сопоставляем операцию, материал, режим работы и совместимую оснастку.", outcome:"Проверенное исполнение и совместимая оснастка", imageAssetId:"", imageAlt:"Инженер проверяет параметры оборудования" },
    { id:"documents", kicker:"02 · Документы", title:"Паспорт и документы", text:"Собираем доступный пакет документов по конкретной позиции до оплаты.", outcome:"Согласованный перечень документов по позиции", imageAssetId:"", imageAlt:"Документы к поставке промышленного оборудования" },
    { id:"terms", kicker:"03 · Поставка", title:"Цена, наличие и срок", text:"Фиксируем подтверждённые условия в КП, а не показываем сомнительные остатки.", outcome:"Условия конкретного предложения зафиксированы в КП", imageAssetId:"", imageAlt:"Проверка наличия промышленного оборудования" },
  ],
});

export function trustCardImageUrl(card: TrustCard): string {
  return card.imageAssetId ? `/api/trust-content/assets/${card.imageAssetId}` : TRUST_CARD_PRESENTATION[card.id].image;
}
