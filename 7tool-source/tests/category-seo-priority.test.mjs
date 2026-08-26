import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("SEO-профиль корончатых свёрл закрывает основной запрос, синонимы и совместимость", () => {
  const profiles = JSON.parse(read("src/lib/category-seo.json"));
  const profile = profiles["koronchatye-sverla"];

  assert.equal(profile.h1, "Корончатые свёрла по металлу");
  assert.match(profile.intro, /кольцевые фрезы по металлу/iu);
  assert.match(profile.metaTitle, /корончатые свёрла по металлу.*купить/iu);
  assert.match(profile.metaDescription, /HSS.*TCT.*Weldon.*НДС.*России/iu);
  assert.ok(profile.keywords.includes("корончатое сверло купить"));
  assert.ok(profile.keywords.includes("сверло для магнитного станка"));
  assert.ok(profile.faq.some((item) => /Weldon 19/iu.test(item.question)));
  assert.ok(profile.faq.some((item) => /модели магнитного станка/iu.test(item.question)));
  assert.ok(profile.seoText.some((paragraph) => /направляющего штифта.*СОЖ.*магнитного станка/iu.test(paragraph)));
});

test("метаданные корончатых свёрл остаются компактными и синхронизированы с каталогом", () => {
  const profiles = JSON.parse(read("src/lib/category-seo.json"));
  const catalog = JSON.parse(read("src/lib/products.json"));
  const profile = profiles["koronchatye-sverla"];
  const category = catalog.categories.find((item) => item.slug === "koronchatye-sverla");

  assert.ok(category, "missing category koronchatye-sverla");
  assert.ok(profile.metaTitle.length <= 60, `title is too long: ${profile.metaTitle.length}`);
  assert.ok(profile.metaDescription.length >= 120 && profile.metaDescription.length <= 160,
    `description length is outside the target range: ${profile.metaDescription.length}`);
  for (const field of ["h1", "intro", "metaTitle", "metaDescription"]) {
    assert.equal(category[field], profile[field], `catalog field is not synced: ${field}`);
  }
  assert.equal(category.seoText, profile.seoText.join("\n\n"));
});

test("форма подбора корончатого сверла собирает материал и данные совместимости", () => {
  const source = read("src/lib/category-content.ts");
  assert.match(source, /name: "compatibility", label: "Материал и станок \/ хвостовик"/u);
  assert.match(source, /LENZ STEYR-35 или Weldon 19/u);
});

test("ручной SEO-текст категории отображается отдельными абзацами", () => {
  const source = read("src/app/c/[slug]/page.tsx");
  assert.match(source, /cat\.seoText\.split\(\/\\n\\s\*\\n\/u\)/u);
  assert.match(source, /seoParagraphs\.map\(\(paragraph\) => <p key=\{paragraph\}>/u);
});

test("магнитные станки получают отдельный проверенный SEO-профиль поверх snapshot", () => {
  const source = read("src/lib/subcategories.ts");
  const start = source.indexOf('"stanki-sverlilnye/magnitnye": {');
  const end = source.indexOf("\n  },\n};", start);
  const profile = source.slice(start, end);

  assert.ok(start >= 0 && end > start, "missing reviewed magnetic drills profile");
  assert.match(profile, /Магнитные сверлильные станки по металлу — купить в 7TOOL/u);
  assert.match(profile, /сверлильный станок на магнитном основании/u);
  assert.match(profile, /станок на магнитной подошве/u);
  assert.match(profile, /магнитная дрель/u);
  assert.match(profile, /name: "hole"[\s\S]*name: "workpiece"[\s\S]*name: "operations"/u);
  assert.match(profile, /relatedLinks:[\s\S]*\/c\/koronchatye-sverla/u);
  assert.equal((profile.match(/question:/gu) ?? []).length, 4);
  assert.match(source, /reviewedContentOverrides[\s\S]*byKey\.set\(key, \{ \.\.\.current, \.\.\.reviewed \}\)/u);
});

test("магнитная подкатегория не забирает широкий H1 родительской категории", () => {
  const profiles = JSON.parse(read("src/lib/category-seo.json"));
  assert.equal(profiles["stanki-sverlilnye"].h1, "Сверлильные станки по металлу");
  assert.equal(profiles["stanki-sverlilnye"].primaryQuery, "сверлильный станок по металлу");

  const source = read("src/lib/subcategories.ts");
  assert.match(source, /"stanki-sverlilnye\/magnitnye":[\s\S]*seoTitle: "Как выбрать магнитный сверлильный станок"/u);
});

test("страница подкатегории использует собственные ключи, форму, FAQ и связанные разделы", () => {
  const source = read("src/app/c/[slug]/[subslug]/page.tsx");
  assert.match(source, /keywords: subcategory\.keywords \?\?/u);
  assert.match(source, /fields=\{subcategory\.selectionFields \?\? content\.selectionFields\}/u);
  assert.match(source, /heading=\{subcategory\.selectionTitle \?\? content\.selectionTitle\}/u);
  assert.match(source, /"@type": "FAQPage"/u);
  assert.match(source, /<StructuredData data=\{faqLd\} \/>/u);
  assert.match(source, /relatedLinks\.map\(\(link\) =>/u);
  assert.match(source, /seoParagraphs\.map\(\(paragraph\) => <p key=\{paragraph\}>/u);
});

test("статья и категории используют только контекстную перелинковку", () => {
  const knowledgeCard = read("src/components/CategoryKnowledgeCard.tsx");
  const articlePage = read("src/app/articles/[slug]/page.tsx");
  const draft = JSON.parse(read("editorial-drafts/kak-vybrat-koronchatoe-sverlo/draft.json"));

  assert.match(knowledgeCard, /"koronchatye-sverla"[\s\S]*Как выбрать корончатое сверло/u);
  assert.match(knowledgeCard, /"stanki-sverlilnye\/magnitnye"[\s\S]*Подбор корончатого сверла к станку/u);
  assert.match(articlePage, /article\.categorySlug === "koronchatye-sverla"[\s\S]*Подобрать магнитный станок для корончатого сверления/u);
  const editorialProjection = read("src/lib/editorial-preview.ts");
  assert.match(editorialProjection, /draftTargetProducts\(draft\.requiredProductSlugs, draft\.categorySlug\)/u);
  assert.match(editorialProjection, /product\.category !== categorySlug/u);
  assert.deepEqual(draft.requiredProductSlugs, [
    "/p/sverla-koronchatye-lzhs",
    "/p/sverla-koronchatye-lzhm",
    "/p/tverdosplavnye-koronki-easy-cut-5-dlina-12-mm-v-sbore-artikul-20-1020",
  ]);
});

test("SEO-профиль трубных фаскоснимателей ставит точный частотный термин первым", () => {
  const profiles = JSON.parse(read("src/lib/category-seo.json"));
  const profile = profiles["kromkorezy-dlya-trub"];

  assert.equal(profile.h1, "Фаскосниматели и кромкорезы для труб");
  assert.equal(profile.primaryQuery, "фаскосниматель для труб");
  assert.match(profile.metaTitle, /^Фаскосниматели для труб.*купить кромкорез/iu);
  assert.match(profile.metaDescription, /трубные фаскосниматели.*кромкорезы.*НДС.*России/iu);
  assert.ok(profile.keywords.includes("фаскосниматель для труб купить"));
  assert.ok(profile.keywords.includes("трубный фаскосниматель"));
  assert.ok(profile.keywords.includes("кромкорез для труб"));
  assert.equal(profile.faq.length, 4);
  assert.ok(profile.faq.some((item) => /внутреннее крепление.*внешнего/iu.test(item.question)));
  assert.ok(profile.seoText.some((paragraph) => /торцевание.*внешнюю.*внутреннюю.*J-фаску/iu.test(paragraph)));
});

test("метаданные трубных фаскоснимателей синхронизированы с каталогом и не пересекаются с листом", () => {
  const profiles = JSON.parse(read("src/lib/category-seo.json"));
  const catalog = JSON.parse(read("src/lib/products.json"));
  const profile = profiles["kromkorezy-dlya-trub"];
  const sheetProfile = profiles["kromkorezy-po-listu"];
  const category = catalog.categories.find((item) => item.slug === "kromkorezy-dlya-trub");

  assert.ok(category, "missing category kromkorezy-dlya-trub");
  assert.ok(profile.metaTitle.length <= 60, `title is too long: ${profile.metaTitle.length}`);
  assert.ok(profile.metaDescription.length >= 120 && profile.metaDescription.length <= 160,
    `description length is outside the target range: ${profile.metaDescription.length}`);
  assert.notEqual(profile.primaryQuery, sheetProfile.primaryQuery);
  for (const field of ["h1", "intro", "metaTitle", "metaDescription"]) {
    assert.equal(category[field], profile[field], `catalog field is not synced: ${field}`);
  }
  assert.equal(category.seoText, profile.seoText.join("\n\n"));
});

test("форма трубных фаскоснимателей собирает все данные для инженерного подбора", () => {
  const source = read("src/lib/category-content.ts");
  assert.match(source, /selectionTitle: "Подбор фаскоснимателя для труб"/u);
  assert.match(source, /name: "pipe", label: "Труба: диаметры и стенка"/u);
  assert.match(source, /name: "operation", label: "Операция и геометрия фаски"/u);
  assert.match(source, /name: "conditions", label: "Доступ, крепление и привод"/u);
});
