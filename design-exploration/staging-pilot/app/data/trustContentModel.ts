export type TrustCardId = "applicability" | "documents" | "terms" | "picking" | "dispatch" | "selection";
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
  applicability:{ image:"/warehouse/01.webp", href:"/company", linkLabel:"Как работает 7TOOL", proofs:["Фактические складские зоны", "Оборудование в заводской упаковке"] },
  documents:{ image:"/warehouse/02.webp", href:"/company", linkLabel:"О компании и поставках", proofs:["Раздельные зоны хранения", "Паллетное размещение оборудования"] },
  terms:{ image:"/warehouse/04.webp", href:"/delivery", linkLabel:"Условия доставки", proofs:["Подготовленные партии", "Срок подтверждается до оплаты"] },
  picking:{ image:"/warehouse/06.webp", href:"/ordering", linkLabel:"Как оформить заказ", proofs:["Сверка позиций", "Комплектность перед отгрузкой"] },
  dispatch:{ image:"/warehouse/07.webp", href:"/delivery", linkLabel:"Доставка и отгрузка", proofs:["Подготовка груза", "Условия фиксируются в КП"] },
  selection:{ image:"/warehouse/08.webp", href:"/catalog", linkLabel:"Перейти в каталог", proofs:["Оборудование и оснастка", "Подбор по параметрам задачи"] },
};

export const DEFAULT_TRUST_CONTENT_SETTINGS: TrustContentSettings = Object.freeze({
  revision:0,
  updatedAt:"",
  sectionEyebrow:"Склад, комплектация и отгрузка",
  sectionTitle:"Проверяем поставку до оплаты",
  sectionIntro:"Показываем реальные фотографии работы с заказами. По конкретной позиции отдельно проверяем применимость, комплектность, документы, остаток и срок — затем фиксируем условия в коммерческом предложении.",
  cards:[
    { id:"applicability", kicker:"01 · Склад", title:"Оборудование хранится по зонам", text:"Фотография показывает складскую зону с оборудованием в заводской упаковке.", outcome:"По вашей позиции подтвердим исполнение и остаток", imageAssetId:"", imageAlt:"Складская зона с промышленным оборудованием на паллетных стеллажах" },
    { id:"documents", kicker:"02 · Хранение", title:"Партии размещены раздельно", text:"Крупные и серийные позиции размещаются на паллетах и стеллажах.", outcome:"Нужную модификацию проверим перед счётом", imageAssetId:"", imageAlt:"Паллетное хранение промышленного оборудования на складе" },
    { id:"terms", kicker:"03 · Оборудование", title:"Проверяем конкретное исполнение", text:"До оплаты уточняем модель, комплектацию, доступные документы и условия поставки.", outcome:"Цена с НДС и срок фиксируются в КП", imageAssetId:"", imageAlt:"Упакованное промышленное оборудование в зоне хранения" },
    { id:"picking", kicker:"04 · Комплектация", title:"Сверяем состав заказа", text:"Позиции и количество проверяются до упаковки и передачи в доставку.", outcome:"Понятный состав поставки без повторного ввода", imageAssetId:"", imageAlt:"Сотрудник комплектует заказ промышленной оснастки" },
    { id:"dispatch", kicker:"05 · Отгрузка", title:"Готовим груз к отправке", text:"Оборудование перемещается в зону подготовки и согласованной отгрузки.", outcome:"Дата и способ доставки подтверждаются менеджером", imageAssetId:"", imageAlt:"Сотрудники готовят промышленное оборудование к отгрузке" },
    { id:"selection", kicker:"06 · Оснастка", title:"Подбираем комплект под задачу", text:"Оборудование, инструмент и расходные материалы можно собрать в одном запросе.", outcome:"Совместимые позиции попадут в одно КП", imageAssetId:"", imageAlt:"Корончатые сверла и промышленная оснастка для подбора" },
  ],
});

export function trustCardImageUrl(card: TrustCard): string {
  return card.imageAssetId ? `/api/trust-content/assets/${card.imageAssetId}` : TRUST_CARD_PRESENTATION[card.id].image;
}
