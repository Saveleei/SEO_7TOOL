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
  applicability:{ image:"/warehouse/01.webp", href:"/company", linkLabel:"Как работает 7TOOL", proofs:["Паллетные стеллажи", "Оборудование в заводской упаковке"] },
  documents:{ image:"/warehouse/02.webp", href:"/company", linkLabel:"О компании и поставках", proofs:["Раздельное паллетное хранение", "Серийные партии оборудования"] },
  terms:{ image:"/warehouse/04.webp", href:"/delivery", linkLabel:"Условия доставки", proofs:["Крупное оборудование на складе", "Исполнение проверяется перед счётом"] },
  picking:{ image:"/warehouse/06.webp", href:"/ordering", linkLabel:"Как оформить заказ", proofs:["Сотрудник комплектует заказ", "Проверка позиций до упаковки"] },
  dispatch:{ image:"/warehouse/07.webp", href:"/delivery", linkLabel:"Доставка и отгрузка", proofs:["Подготовка груза сотрудниками", "Перемещение в зону отгрузки"] },
  selection:{ image:"/warehouse/08.webp", href:"/catalog", linkLabel:"Перейти в каталог", proofs:["Оборудование и оснастка", "Подбор по параметрам задачи"] },
};

export const DEFAULT_TRUST_CONTENT_SETTINGS: TrustContentSettings = Object.freeze({
  revision:0,
  updatedAt:"",
  sectionEyebrow:"Склад, комплектация и отгрузка",
  sectionTitle:"Проверяем поставку до оплаты",
  sectionIntro:"Показываем реальные зоны хранения и работу сотрудников: комплектацию, перемещение и подготовку груза к отгрузке. По конкретной позиции отдельно проверяем исполнение, комплектность, документы, остаток и срок — затем фиксируем условия в коммерческом предложении.",
  cards:[
    { id:"applicability", kicker:"01 · Склад", title:"Оборудование хранится по зонам", text:"Фотография показывает складскую зону с оборудованием в заводской упаковке.", outcome:"По вашей позиции подтвердим исполнение и остаток", imageAssetId:"", imageAlt:"Складская зона с промышленным оборудованием на паллетных стеллажах" },
    { id:"documents", kicker:"02 · Паллетное хранение", title:"Серийные партии размещены раздельно", text:"Коробки и паллеты распределены по складским зонам, чтобы проверить нужное исполнение перед счётом.", outcome:"Нужную модификацию проверим перед счётом", imageAssetId:"", imageAlt:"Паллетное хранение серийных партий промышленного оборудования" },
    { id:"terms", kicker:"03 · Крупное оборудование", title:"Проверяем конкретное исполнение", text:"Крупное оборудование хранится в заводской упаковке; модель и комплектацию уточняем до оплаты.", outcome:"Цена с НДС и срок фиксируются в КП", imageAssetId:"", imageAlt:"Крупное промышленное оборудование в заводской упаковке на складе" },
    { id:"picking", kicker:"04 · Комплектация", title:"Сотрудник сверяет состав заказа", text:"Мелкие позиции подбираются из ячеек, затем количество и комплектность проверяются до упаковки.", outcome:"Понятный состав поставки без повторного ввода", imageAssetId:"", imageAlt:"Сотрудник комплектует заказ промышленной оснастки в зоне мелкоячеистого хранения" },
    { id:"dispatch", kicker:"05 · Отгрузка", title:"Люди готовят груз к отправке", text:"Сотрудники перемещают оборудование из зоны хранения к месту подготовки согласованной отгрузки.", outcome:"Дата и способ доставки подтверждаются менеджером", imageAssetId:"", imageAlt:"Сотрудники перемещают промышленное оборудование для подготовки к отгрузке" },
    { id:"selection", kicker:"06 · Оснастка", title:"Подбираем комплект под задачу", text:"Оборудование, инструмент и расходные материалы можно собрать в одном запросе.", outcome:"Совместимые позиции попадут в одно КП", imageAssetId:"", imageAlt:"Корончатые сверла и промышленная оснастка для подбора" },
  ],
});

const TRUST_CARD_DISPLAY_ORDER: readonly TrustCardId[] = ["applicability", "picking", "dispatch", "documents", "terms", "selection"];

export function orderTrustCardsForDisplay(cards: readonly TrustCard[]): TrustCard[] {
  const byId = new Map(cards.map((card) => [card.id, card]));
  return TRUST_CARD_DISPLAY_ORDER.flatMap((id) => {
    const card = byId.get(id);
    return card ? [card] : [];
  });
}

export function trustCardDisplayKicker(card: TrustCard, index: number): string {
  const [, ...labelParts] = card.kicker.split("·");
  const label = labelParts.join("·").trim() || card.kicker;
  return `${String(index + 1).padStart(2, "0")} · ${label}`;
}

export function trustCardImageUrl(card: TrustCard): string {
  return card.imageAssetId ? `/api/trust-content/assets/${card.imageAssetId}` : TRUST_CARD_PRESENTATION[card.id].image;
}
