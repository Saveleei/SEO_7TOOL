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
  applicability:{ image:"/proof/warehouse/overview.webp", href:"/company", linkLabel:"Как работает 7TOOL", proofs:["Стеллажные и напольные зоны", "Крупное оборудование в обрешётке"] },
  documents:{ image:"/warehouse/01.webp", href:"/company", linkLabel:"О компании и поставках", proofs:["Раздельное паллетное хранение", "Серийные партии оборудования"] },
  terms:{ image:"/warehouse/04.webp", href:"/delivery", linkLabel:"Условия доставки", proofs:["Крупное оборудование на складе", "Исполнение проверяется перед счётом"] },
  picking:{ image:"/proof/warehouse/picking.webp", href:"/ordering", linkLabel:"Как оформить заказ", proofs:["Сотрудник комплектует заказ", "Проверка позиций по складским ячейкам"] },
  dispatch:{ image:"/proof/warehouse/dispatch.webp", href:"/delivery", linkLabel:"Доставка и отгрузка", proofs:["Погрузка в автомобиль перевозчика", "Груз закреплён на паллете"] },
  selection:{ image:"/proof/warehouse/tooling-stock.webp", href:"/catalog", linkLabel:"Перейти в каталог", proofs:["Оснастка по типоразмерам", "Подбор по параметрам задачи"] },
};

export const DEFAULT_TRUST_CONTENT_SETTINGS: TrustContentSettings = Object.freeze({
  revision:0,
  updatedAt:"",
  sectionEyebrow:"Склад, комплектация и отгрузка",
  sectionTitle:"Проверяем поставку до оплаты",
  sectionIntro:"Показываем реальные зоны хранения и работу сотрудников: комплектацию, перемещение и подготовку груза к отгрузке. По конкретной позиции отдельно проверяем исполнение, комплектность, документы, остаток и срок — затем фиксируем условия в коммерческом предложении.",
  cards:[
    { id:"applicability", kicker:"01 · Склад", title:"Используем разные форматы хранения", text:"На одном кадре видны паллетные стеллажи, напольные зоны и крупное оборудование в транспортной упаковке.", outcome:"По вашей позиции подтвердим исполнение и остаток", imageAssetId:"", imageAlt:"Общий вид склада с паллетным, стеллажным и напольным хранением промышленного оборудования" },
    { id:"documents", kicker:"02 · Паллетное хранение", title:"Серийные партии размещены раздельно", text:"Коробки и паллеты распределены по складским зонам, чтобы проверить нужное исполнение перед счётом.", outcome:"Нужную модификацию проверим перед счётом", imageAssetId:"", imageAlt:"Паллетное хранение серийных партий промышленного оборудования" },
    { id:"terms", kicker:"03 · Крупное оборудование", title:"Проверяем конкретное исполнение", text:"Крупное оборудование хранится в заводской упаковке; модель и комплектацию уточняем до оплаты.", outcome:"Цена с НДС и срок фиксируются в КП", imageAssetId:"", imageAlt:"Крупное промышленное оборудование в заводской упаковке на складе" },
    { id:"picking", kicker:"04 · Комплектация", title:"Подбираем позиции по складским ячейкам", text:"Сотрудник собирает типоразмеры из адресных ячеек, затем количество и комплектность проверяются до упаковки.", outcome:"Понятный состав поставки без повторного ввода", imageAssetId:"", imageAlt:"Сотрудник комплектует заказ промышленной оснастки в зоне адресного хранения" },
    { id:"dispatch", kicker:"05 · Отгрузка", title:"Передаём груз транспортной компании", text:"Упакованный паллетный груз погружается в автомобиль перевозчика с участием сотрудников склада.", outcome:"Дата, перевозчик и способ доставки подтверждаются менеджером", imageAssetId:"", imageAlt:"Сотрудники склада и водитель погрузчика загружают паллетный груз в автомобиль транспортной компании" },
    { id:"selection", kicker:"06 · Оснастка", title:"Храним оснастку по типоразмерам", text:"Корончатые сверла и другая оснастка распределены по размерам, чтобы собрать совместимые позиции в один запрос.", outcome:"Совместимые позиции попадут в одно КП", imageAssetId:"", imageAlt:"Запас промышленной оснастки, распределённой по типоразмерам" },
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
