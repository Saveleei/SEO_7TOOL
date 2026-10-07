import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  categoryAssortmentTaxonomies,
  getCategoryFamily,
  getCategoryFamilyLabel,
  getCategoryFamilyShortcuts,
} from "../app/data/categoryAssortmentTaxonomy.mjs";
import { getCategoryExpertProfile } from "../app/data/categoryExpertProfiles.mjs";
import {
  getFeedCategoryPage,
  getPublishedFeedCatalogSnapshot,
  getPublishedFeedCategorySlugs,
  toFeedProductCardModel,
} from "../app/data/feedCatalog.ts";

test("every published category exposes a feed-grounded assortment entry path", () => {
  for (const slug of getPublishedFeedCategorySlugs()) {
    const profile = getCategoryExpertProfile(slug);
    assert.ok(profile.assortmentPrompt?.length >= 20, `${slug}: assortment prompt`);
    assert.ok(profile.assortmentShortcuts?.length >= 2, `${slug}: assortment shortcuts`);
    assert.ok(profile.assortmentShortcuts.every((shortcut) => shortcut.family || shortcut.segment || shortcut.productType || shortcut.query), `${slug}: shortcut target`);
  }
});

test("category families classify every current product exactly once and family filters agree", () => {
  const snapshot = getPublishedFeedCatalogSnapshot();
  for (const [slug, taxonomy] of Object.entries(categoryAssortmentTaxonomies)) {
    const products = snapshot.products.filter((product) => product.category === slug);
    assert.ok(products.length > 0, `${slug}: current assortment`);
    const counts = new Map(taxonomy.families.map((family) => [family.id, 0]));

    for (const product of products) {
      const familyId = getCategoryFamily(slug, product);
      assert.ok(familyId, `${slug}/${product.slug}: family`);
      assert.ok(counts.has(familyId), `${slug}/${product.slug}: known family`);
      counts.set(familyId, (counts.get(familyId) ?? 0) + 1);
      assert.ok(getCategoryFamilyLabel(slug, familyId)?.length > 2, `${slug}/${familyId}: label`);
    }

    const visibleFamilies = [...counts].filter(([, count]) => count > 0);
    assert.ok(visibleFamilies.length >= 2, `${slug}: at least two populated families`);
    assert.equal(visibleFamilies.reduce((sum, [, count]) => sum + count, 0), products.length, `${slug}: no lost or duplicated products`);
    for (const [familyId, expected] of visibleFamilies) {
      assert.equal(getFeedCategoryPage(slug, { family:familyId, pageSize:48 }).total, expected, `${slug}/${familyId}: filtered total`);
    }
  }
});

test("family shortcuts carry a decision frame and product cards identify their family", () => {
  const snapshot = getPublishedFeedCatalogSnapshot();
  for (const slug of Object.keys(categoryAssortmentTaxonomies)) {
    const profile = getCategoryExpertProfile(slug);
    const shortcuts = profile.assortmentShortcuts.filter((shortcut) => shortcut.family);
    assert.ok(shortcuts.every((shortcut) => shortcut.heroTitle && shortcut.heroIntro && shortcut.listingTitle && shortcut.selectorTitle), `${slug}: family copy`);
    assert.ok(shortcuts.every((shortcut) => shortcut.scopeGuidance?.bestFor && shortcut.scopeGuidance?.checkFirst && shortcut.scopeGuidance?.compareBy), `${slug}: decision guidance`);

    const product = snapshot.products.find((candidate) => candidate.category === slug);
    assert.ok(product, `${slug}: representative product`);
    const card = toFeedProductCardModel(product);
    assert.equal(card.taskLabel, getCategoryFamilyLabel(slug, getCategoryFamily(slug, product)), `${slug}: card family label`);
  }
});

test("launch categories lead with decision paths and keep secondary ranges out of the first scan", async () => {
  const cases = {
    "koronchatye-sverla": {
      primary:["Твердосплавные TCT", "Быстрорежущие HSS", "Для рельсов"],
      secondary:["Наборы корончатых свёрл", "Дюймовые исполнения", "Специальные исполнения"],
    },
    "kromkorezy-po-listu": {
      primary:["Ручные и переносные", "Самоходные и автоматические", "Стационарные", "Радиусная фаска и отверстия"],
      secondary:["Оснастка и комплектующие", "Позиции без понятного наименования"],
    },
    "kromkorezy-dlya-trub": {
      primary:["Электрические", "Пневматические", "Со сменным приводом", "Гидравлические", "Ручные"],
      secondary:[],
    },
    borfrezy: {
      primary:["Стандартные формы A–N", "Миниатюрные", "Удлинённые"],
      secondary:["Наборы борфрез"],
    },
    "rezbonareznye-manipulyatory": {
      primary:["Электрические", "Пневматические", "Сверлильно-резьбонарезные", "Гидравлические и сервоприводные"],
      secondary:["Верстаки, опоры и позиционеры", "Цанги, втулки и держатели", "Прочие комплектующие"],
    },
    "karetki-svarochnye": {
      primary:["Колёсные и магнитные", "На направляющих", "Для труб и обечаек", "С осцилляцией"],
      secondary:[],
    },
    kompressory: {
      primary:["Винтовые", "Поршневые", "Безмасляные", "Дизельные передвижные", "Высокого давления и бустеры"],
      secondary:["Компрессорные наборы", "Фильтры, ремни и сервисные элементы"],
    },
  };

  for (const [slug, expected] of Object.entries(cases)) {
    const shortcuts = getCategoryFamilyShortcuts(slug).assortmentShortcuts;
    assert.deepEqual(shortcuts.filter((shortcut) => !shortcut.secondary).map((shortcut) => shortcut.label), expected.primary, `${slug}: primary`);
    assert.deepEqual(shortcuts.filter((shortcut) => shortcut.secondary).map((shortcut) => shortcut.label), expected.secondary, `${slug}: secondary`);
  }

  const drilling = getCategoryExpertProfile("stanki-sverlilnye").assortmentShortcuts;
  assert.deepEqual(drilling.filter((shortcut) => !shortcut.secondary).map((shortcut) => shortcut.label), [
    "Магнитные сверлильные станки",
    "Стационарные сверлильные станки",
    "Рельсосверлильные станки",
    "Специальные сверлильные станки",
  ]);
  assert.deepEqual(drilling.filter((shortcut) => shortcut.secondary).map((shortcut) => shortcut.label), ["Оснастка и крепления"]);

  const page = await readFile(new URL("../app/catalog/category/[slug]/page.tsx", import.meta.url), "utf8");
  assert.match(page, /decisionShortcuts = assortmentShortcuts\.filter/u);
  assert.match(page, /secondaryShortcuts = assortmentShortcuts\.filter/u);
  assert.match(page, /assortmentShortcutIsActive/u);
  assert.match(page, /Boolean\(shortcut\.productType\)/u);
  assert.match(page, /href=\{assortmentShortcutHref\(shortcut\)\}/u);
  assert.match(page, /Ещё разделы каталога/u);
});

test("category page preserves family context and uses engineer-first handoff where configured", async () => {
  const page = await readFile(new URL("../app/catalog/category/[slug]/page.tsx", import.meta.url), "utf8");
  assert.match(page, /requestedFamily = firstValue\(rawSearchParams\.family\)/u);
  assert.match(page, /name="family" value=\{family\}/u);
  assert.match(page, /removeKey:"family"/u);
  assert.match(page, /activeShortcut\?\.selectionMode/u);
  assert.match(page, /className="category-feed-help" id=\{slug === "stanki-sverlilnye" \? "drill-selector" : "category-selector"\}/u);
  assert.doesNotMatch(page, /id="category-selector" open/u);
  assert.match(page, /Заказать подбор инженера/u);
});
