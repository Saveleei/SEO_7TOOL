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
  applicability:{ image:"/proof/warehouse/overview.webp", href:"/company", linkLabel:"Как работает 7TOOL", proofs:["Исходные параметры задачи", "Совместимость исполнения и оснастки"] },
  documents:{ image:"/proof/warehouse/picking.webp", href:"/warranty", linkLabel:"Документы и гарантия", proofs:["Комплектность выбранной позиции", "Доступный пакет документов"] },
  terms:{ image:"/proof/warehouse/dispatch.webp", href:"/delivery", linkLabel:"Доставка и отгрузка", proofs:["Остаток выбранного исполнения", "Подтверждённая дата в КП"] },
};

export const DEFAULT_TRUST_CONTENT_SETTINGS: TrustContentSettings = Object.freeze({
  revision:0,
  updatedAt:"",
  sectionEyebrow:"Склад, комплектация и отгрузка",
  sectionTitle:"Проверяем поставку до оплаты",
  sectionIntro:"Показываем реальные фотографии работы с заказами. По конкретной позиции отдельно проверяем применимость, комплектность, документы, остаток и срок — затем фиксируем условия в коммерческом предложении.",
  cards:[
    { id:"applicability", kicker:"01 · Проверка заявки", title:"Уточняем исполнение и состав", text:"Сопоставляем задачу с конкретным оборудованием и оснасткой до формирования предложения.", outcome:"Модель и комплект, которые можно согласовывать", imageAssetId:"", imageAlt:"Склад промышленного оборудования и подготовленных заказов" },
    { id:"documents", kicker:"02 · Комплектация", title:"Собираем и проверяем заказ", text:"Сверяем артикулы, исполнение, комплектность, доступные документы и гарантийные условия.", outcome:"Понятный состав поставки до выставления счёта", imageAssetId:"", imageAlt:"Сотрудник комплектует заказ на складе" },
    { id:"terms", kicker:"03 · Отгрузка", title:"Фиксируем условия и отгружаем", text:"Подтверждаем остаток выбранного исполнения, дату и условия отправки до оплаты.", outcome:"Цена с НДС, комплектность и подтверждённый срок", imageAssetId:"", imageAlt:"Погрузка упакованного промышленного оборудования для отправки" },
  ],
});

export function trustCardImageUrl(card: TrustCard): string {
  return card.imageAssetId ? `/api/trust-content/assets/${card.imageAssetId}` : TRUST_CARD_PRESENTATION[card.id].image;
}
