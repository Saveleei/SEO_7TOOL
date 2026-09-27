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
  documents:{ image:"/site/why-documents.webp", href:"/warranty", linkLabel:"Документы и гарантия", proofs:["Комплектность выбранной позиции", "Доступный пакет документов"] },
  terms:{ image:"/site/why-stock.webp", href:"/delivery", linkLabel:"Как подтверждаем поставку", proofs:["Остаток выбранного исполнения", "Подтверждённая дата в КП"] },
};

export const DEFAULT_TRUST_CONTENT_SETTINGS: TrustContentSettings = Object.freeze({
  revision:0,
  updatedAt:"",
  sectionEyebrow:"От подбора до отгрузки",
  sectionTitle:"Проверяем закупку до оплаты",
  sectionIntro:"За каждой позицией — понятный процесс: проверяем применимость, фиксируем комплектность и документы, затем подтверждаем остаток и срок в коммерческом предложении.",
  cards:[
    { id:"applicability", kicker:"01 · Инженерная проверка", title:"Оборудование под вашу задачу", text:"Сопоставляем операцию, материал, режим работы и совместимую оснастку.", outcome:"Модель и комплект, которые можно согласовывать", imageAssetId:"", imageAlt:"Инженер проверяет параметры оборудования" },
    { id:"documents", kicker:"02 · Комплектация", title:"Состав позиции и документы", text:"Проверяем исполнение, комплектность, доступный пакет документов и гарантийные условия.", outcome:"Понятный состав поставки до выставления счёта", imageAssetId:"", imageAlt:"Комплектация заказа промышленного оборудования" },
    { id:"terms", kicker:"03 · Остаток и срок", title:"Подтверждённые условия поставки", text:"Проверяем остаток выбранного исполнения и фиксируем фактические условия текущего предложения.", outcome:"Цена с НДС, комплектность и подтверждённый срок", imageAssetId:"", imageAlt:"Склад промышленного оборудования" },
  ],
});

export function trustCardImageUrl(card: TrustCard): string {
  return card.imageAssetId ? `/api/trust-content/assets/${card.imageAssetId}` : TRUST_CARD_PRESENTATION[card.id].image;
}
