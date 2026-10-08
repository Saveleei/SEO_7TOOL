const FIXED_RUBLE_PRICE = /^\d[\d\s\u00a0]*\s*₽$/u;

export function hasConfirmedQuickOrderPrice(price) {
  const normalized = String(price ?? "").replace(/\s+/gu, " ").trim();
  return FIXED_RUBLE_PRICE.test(normalized);
}

export function getQuickOrderMode({ available, price }) {
  const canOrder = Boolean(available) && hasConfirmedQuickOrderPrice(price);
  return canOrder
    ? {
        id:"order",
        triggerLabel:"Быстрый запрос",
        title:"Получить ответ по выбранному товару",
        lead:"Оставьте телефон — менеджер подтвердит остаток, цену и дату отгрузки.",
        submitLabel:"Отправить быстрый запрос",
      }
    : {
        id:"request",
        triggerLabel:"Быстрый запрос",
        title:"Уточнить условия по выбранному товару",
        lead:"Оставьте телефон — менеджер уточнит цену, наличие и ближайшую дату поставки.",
        submitLabel:"Отправить быстрый запрос",
      };
}
