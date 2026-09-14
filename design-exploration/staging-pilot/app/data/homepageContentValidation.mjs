export const HOMEPAGE_ASSORTMENT_IDS = ["drilling", "edge", "cutting", "welding", "tooling", "workplace"];
export const HOMEPAGE_CATEGORY_IDS = ["stanki-sverlilnye", "koronchatye-sverla", "kromkorezy-dlya-trub", "kromkorezy-po-listu", "borfrezy", "rezbonareznye-manipulyatory"];

const ASSET_PATTERN = /^homepage-[0-9a-f]{64}\.(?:png|jpg|webp)$/u;
const FITS = new Set(["contain", "cover"]);
const POSITIONS = new Set(["center", "top", "bottom", "left", "right"]);

export function validateHomepageContentSettings(input) {
  const revision = Number(input?.revision);
  if (!Number.isInteger(revision) || revision < 0) return fail("Некорректная версия страницы.");

  const hero = validateTextSection(input?.hero, { eyebrow:70, title:130, intro:420 }, "первого экрана");
  if (!hero.ok) return hero;
  const assortment = validateTextSection(input?.assortment, { eyebrow:70, title:110, intro:320 }, "карты ассортимента");
  if (!assortment.ok) return assortment;
  const categories = validateTextSection(input?.categories, { eyebrow:70, title:110, intro:320 }, "разделов каталога");
  if (!categories.ok) return categories;
  const tasks = validateTextSection(input?.tasks, { eyebrow:70, title:110, intro:320 }, "производственных задач");
  if (!tasks.ok) return tasks;

  const assortmentItems = validateItems(input?.assortmentItems, HOMEPAGE_ASSORTMENT_IDS, "направлений ассортимента");
  if (!assortmentItems.ok) return assortmentItems;
  const categoryItems = validateItems(input?.categoryItems, HOMEPAGE_CATEGORY_IDS, "разделов каталога");
  if (!categoryItems.ok) return categoryItems;

  return { ok:true, value:{ revision, hero:hero.value, assortment:assortment.value, categories:categories.value, tasks:tasks.value, assortmentItems:assortmentItems.value, categoryItems:categoryItems.value } };
}

function validateTextSection(input, limits, label) {
  const eyebrow = text(input?.eyebrow, limits.eyebrow);
  const title = text(input?.title, limits.title);
  const intro = text(input?.intro, limits.intro);
  if (eyebrow.length < 3 || title.length < 5 || intro.length < 10) return fail(`Заполните заголовок и пояснение ${label}.`);
  return { ok:true, value:{ eyebrow, title, intro } };
}

function validateItems(input, requiredIds, label) {
  if (!Array.isArray(input) || input.length !== requiredIds.length) return fail(`Сохраните полный набор ${label}.`);
  const required = new Set(requiredIds);
  const seen = new Set();
  const value = [];
  for (const raw of input) {
    const id = text(raw?.id, 80);
    if (!required.has(id) || seen.has(id)) return fail(`Нарушен состав ${label}.`);
    seen.add(id);
    const title = text(raw?.title, 90);
    const imageAlt = text(raw?.imageAlt, 170);
    const imageAssetId = text(raw?.imageAssetId, 100);
    const imageFit = text(raw?.imageFit, 12);
    const imagePosition = text(raw?.imagePosition, 12);
    if (title.length < 2) return fail(`Заполните название элемента «${id}».`);
    if (imageAlt.length < 3) return fail(`Добавьте описание фотографии для «${title}».`);
    if (imageAssetId && !ASSET_PATTERN.test(imageAssetId)) return fail(`Некорректная фотография для «${title}».`);
    if (!FITS.has(imageFit) || !POSITIONS.has(imagePosition)) return fail(`Некорректное кадрирование для «${title}».`);
    value.push({ id, title, imageAlt, imageAssetId, imageFit, imagePosition });
  }
  if (seen.size !== required.size) return fail(`Нарушен состав ${label}.`);
  return { ok:true, value };
}

function text(value, maxLength) {
  return typeof value === "string" ? value.replace(/\s+/gu, " ").trim().slice(0, maxLength) : "";
}

function fail(message) {
  return { ok:false, message };
}
