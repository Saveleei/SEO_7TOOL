export const mediaRecoveryClasses = Object.freeze({
  stocked_source_ready:Object.freeze({
    code:"stocked_source_ready",
    label:"Приоритет 1 · точный источник",
    instruction:"Товар в наличии; бренд и модель или артикул позволяют проверить точную страницу производителя или поставщика.",
  }),
  stocked_identity_first:Object.freeze({
    code:"stocked_identity_first",
    label:"Приоритет 1 · сначала идентификация",
    instruction:"Товар в наличии, но для безопасного поиска фото нужно сначала подтвердить бренд, модель или артикул.",
  }),
  unstocked_source_ready:Object.freeze({
    code:"unstocked_source_ready",
    label:"Приоритет 2 · точный источник",
    instruction:"Положительного остатка нет; точный источник можно проверять после товаров, доступных к заказу.",
  }),
  unstocked_identity_first:Object.freeze({
    code:"unstocked_identity_first",
    label:"Приоритет 2 · сначала идентификация",
    instruction:"Положительного остатка и достаточной идентификации нет; нельзя назначать похожее изображение автоматически.",
  }),
});

export function classifyMissingProductMedia(product) {
  const stocked = Number(product.stock) > 0;
  const sourceReady = hasReliableBrand(product.brand) && hasSearchIdentity(product);
  return mediaRecoveryClasses[`${stocked ? "stocked" : "unstocked"}_${sourceReady ? "source_ready" : "identity_first"}`];
}

function hasReliableBrand(brand) {
  return Boolean(String(brand ?? "").trim()) && !/^(?:noname|без бренда)$/iu.test(String(brand).trim());
}

function hasSearchIdentity(product) {
  if (String(product.sku ?? "").trim()) return true;
  if (product.variants?.some((variant) => String(variant.sku ?? "").trim())) return true;
  return String(product.title ?? "").split(/\s+/u).some((token) => /[a-zа-я]/iu.test(token) && /\d/u.test(token));
}
