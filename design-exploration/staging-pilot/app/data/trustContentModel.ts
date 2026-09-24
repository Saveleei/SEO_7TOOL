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

export const TRUST_CARD_PRESENTATION: Record<TrustCardId, { image: string; href: string; linkLabel: string; proofs: readonly [string, string] }> = {
  applicability:{ image:"/site/why-engineer.webp", href:"/company", linkLabel:"Как работает подбор", proofs:["Исходные параметры задачи", "Совместимость исполнения и оснастки"] },
  documents:{ image:"/site/why-documents.webp", href:"/warranty", linkLabel:"Документы и гарантия", proofs:["Перечень документов к позиции", "Условия гарантии производителя"] },
  terms:{ image:"/site/why-stock.webp", href:"/delivery", linkLabel:"Как подтверждаем поставку", proofs:["Цена и комплектность в КП", "Подтверждённый срок предложения"] },
};

export const DEFAULT_TRUST_CONTENT_SETTINGS: TrustContentSettings = Object.freeze({
  revision:0,
  updatedAt:"",
  sectionEyebrow:"Не обещания, а проверяемый результат",
  sectionTitle:"Проверяем закупку до оплаты",
  sectionIntro:"Сначала уточняем исполнение и доступные документы, затем фиксируем цену, комплектность и подтверждённый срок в коммерческом предложении.",
  cards:[
    { id:"applicability", kicker:"01 · Инженер", title:"Исполнение под вашу задачу", text:"Сопоставляем операцию, материал, режим работы и совместимую оснастку.", outcome:"Модель и комплект, которые можно согласовывать", imageAssetId:"", imageAlt:"Инженер проверяет параметры оборудования" },
    { id:"documents", kicker:"02 · Документы", title:"Документы до счёта", text:"Проверяем доступный пакет документов и гарантийные условия по конкретной позиции.", outcome:"Согласованный перечень документов к позиции", imageAssetId:"", imageAlt:"Документы к поставке промышленного оборудования" },
    { id:"terms", kicker:"03 · Коммерческие условия", title:"Условия в одном КП", text:"Не подменяем подтверждение общим статусом: фиксируем фактические условия текущего предложения.", outcome:"Цена с НДС, комплектность и подтверждённый срок", imageAssetId:"", imageAlt:"Проверка наличия промышленного оборудования" },
  ],
});

export function trustCardImageUrl(card: TrustCard): string {
  return card.imageAssetId ? `/api/trust-content/assets/${card.imageAssetId}` : TRUST_CARD_PRESENTATION[card.id].image;
}
