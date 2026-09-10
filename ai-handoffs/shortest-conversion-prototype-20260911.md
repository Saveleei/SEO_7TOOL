# Handoff: shortest conversion prototype

- Агент: Codex
- Ветка: `codex/shortest-conversion-prototype`
- Цель: итоговый search-first прототип главной страницы 7TOOL с кратчайшими путями к товару, подбору и КП по спецификации.
- Область владения: `design-exploration/shortest-conversion/**` и этот handoff.
- Production-код: не изменяется.

## Критерий готовности

- точный поиск по модели показывает товар и действие без перехода в общий листинг;
- пользователь без артикула начинает подбор от задачи;
- закупщик со списком сразу видит путь загрузки спецификации;
- primary CTA виден в первом mobile-экране;
- официальный бренд-кит и контрастные сочетания цветов соблюдены;
- нет horizontal overflow, broken images и console errors на проверенных ширинах.

## Commit

`1c2f1bf` — `design: add search-first conversion prototype`

## Browser QA

- Проверенные ширины: 320, 390, 768, 801, 820, 840, 900, 1120, 1280, 1440, 1600 и 1920 px.
- Horizontal overflow: 0.
- Broken images: 0.
- Console errors: 0.
- Exact-match `STEYR-35`: товар, наличие, цена и CTA видимы в выпадающем результате.
- CTA корзины меняет состояние на `Добавлено ✓`.
- Выбор задачи обновляет заголовок и число моделей; выбор диаметра обновляет `aria-pressed`.
