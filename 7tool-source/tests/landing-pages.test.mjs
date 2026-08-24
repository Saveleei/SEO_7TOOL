import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("все категории получают контекстные посадочные и тематические вопросы", () => {
  const source = read("src/lib/landing-pages.ts");
  for (const slug of ["borfrezy", "stanki-sverlilnye", "koronchatye-sverla", "kromkorezy-po-listu", "kromkorezy-dlya-trub"]) {
    assert.match(source, new RegExp(`slug: "${slug}"`), `missing landing category ${slug}`);
  }
  assert.match(source, /questions\.length >= 2/);
  assert.match(source, /questions\.length <= 3/);
  assert.match(source, /subcategorySlug: "magnitnye"/);
  assert.match(source, /matchesSubcategory/);
  assert.match(source, /product\.images\.some\(Boolean\)/);
  assert.doesNotMatch(source, /selected = filtered\.length >= 6 \? filtered : complete/);
  assert.doesNotMatch(source, /broadFallback/);
  assert.match(source, /\.\.\.categories/);
  assert.match(source, /content\.selectionFields/);
  assert.match(source, /defaultIntent: "podbor"/);
  assert.match(source, /quickTasksForLanding/);
  assert.match(source, /metaTitle: "Корончатые свёрла HSS/);
  assert.match(source, /metaTitle: "Твердосплавные корончатые свёрла TCT/);
});

test("посадочные проходят anti-cannibalization gate до индексации", () => {
  const page = read("src/app/lp/[category]/[[...intent]]/page.tsx");
  assert.match(page, /landingSeoDecision/);
  assert.match(page, /decision\.indexable \? indexableRobots : noIndexRobots/);
  assert.match(page, /CollectionPage/);
  assert.match(page, /FAQPage/);
  assert.match(page, /content\.seo\.metaTitle/);
  assert.match(page, /dynamic = "force-dynamic"/);
  assert.doesNotMatch(page, /if \(listing\.products\.length === 0\) notFound/);
  assert.match(page, /Карточки без подтверждённых фотографий не публикуем/);
  assert.match(page, /Подборка: \{selected\.intent\.label\}/);
  assert.match(page, /LandingQuickTasks/);
  assert.match(page, /Открыть всю категорию →/);
  assert.doesNotMatch(read("src/app/sitemap.ts"), /landingUrls/);
  assert.match(read("src/lib/landing-pages.ts"), /REVIEWED_INDEXABLE_LANDINGS/);
  assert.match(read("src/lib/landing-pages.ts"), /CANONICALIZE/);
});

test("лид сначала сохраняется с атрибуцией и получает внешний номер", () => {
  const leads = read("src/lib/leads.ts");
  const leadApi = read("src/app/api/lead/route.ts");
  const db = read("src/lib/db.ts");
  assert.match(leads, /const \{ id, requestId, duplicate \} = saveLead\(p, ctx\)/);
  assert.match(leads, /INSERT OR IGNORE INTO notification_outbox/);
  assert.match(leads, /HTTP-запрос подтверждает сохранение заявки и не ждёт внешние SMTP\/MAX/);
  assert.match(leads, /requestId/);
  for (const field of ["yclid", "client_id", "utm_source", "utm_campaign", "landing", "intent", "status"]) {
    assert.match(db, new RegExp(`\\["${field}"`), `missing lead field ${field}`);
  }
  assert.match(leadApi, /landing_quote/);
  assert.match(leadApi, /storeLeadDocument/);
  assert.match(leadApi, /"requisites"/);
  assert.doesNotMatch(read("src/app/api/email-intent/route.ts"), /saveLead|submitLead/);
});

test("аналитика покрывает воронку посадочных и ecommerce", () => {
  const analytics = read("src/lib/analytics.ts");
  const dispatcher = read("src/lib/metrika-dispatch.mjs");
  for (const event of ["lp_view", "lp_selector_start", "lp_selector_complete", "lp_form_start", "lp_lead_submit", "lp_product_click", "lp_quick_choice", "lp_email_intent", "submit_cart_quote", "submit_price_match"]) {
    assert.match(analytics, new RegExp(`"${event}"`), `missing event ${event}`);
  }
  assert.match(analytics, /ecommerce/);
  assert.match(analytics, /trackConfirmedLead/);
  assert.match(analytics, /getDispatcher\(\)\.sendOnce/);
  assert.match(dispatcher, /if \(!options\.deliver\(item\.event, item\.params\)\) return false/);
  assert.match(dispatcher, /if \(item\.onceKey\) markSentOnce\(item\.onceKey\)/);
  assert.doesNotMatch(analytics, /"quote_request"/);
  assert.match(read("src/components/YandexMetrika.tsx"), /ecommerce:"\$\{YANDEX_ECOMMERCE_LAYER\}"/);
  assert.match(read("src/lib/metrika-config.ts"), /YANDEX_ECOMMERCE_LAYER = "dataLayer"/);
});

test("файлы спецификаций валидируются и не публикуются через uploads", () => {
  const storage = read("src/lib/specification-storage.ts");
  assert.match(storage, /MAX_BYTES = 10 \* 1024 \* 1024/);
  assert.match(storage, /BAD_FILE_SIGNATURE/);
  assert.match(storage, /private-uploads/);
  assert.match(storage, /quarantine/);
  assert.match(storage, /CLAMAV_ENABLED/);
  assert.match(storage, /VIRUS_DETECTED/);
  assert.match(storage, /LeadDocumentKind/);
  assert.match(storage, /image\/jpeg/);
  assert.doesNotMatch(storage, /process\.env\.UPLOAD_DIR/);
});

test("устранён 404 каталога и обычный менеджер скрыт на рекламных страницах", () => {
  assert.match(read("src/app/catalog/page.tsx"), /permanentRedirect\("\/#categories"\)/);
  assert.match(read("src/components/ManagerFloating.tsx"), /pathname\.startsWith\("\/lp\/"\)/);
});

test("ручные блоки лендинга хранятся отдельно от товарного фида", () => {
  const db = read("src/lib/db.ts");
  const content = read("src/lib/landing-content-db.ts");
  const admin = read("src/app/admin/landings/[category]/[intent]/page.tsx");
  assert.match(db, /CREATE TABLE IF NOT EXISTS landing_content/);
  assert.match(content, /ON CONFLICT\(category_slug, intent_slug\)/);
  assert.match(admin, /Ночное обновление фида их не удалит/);
  assert.match(admin, /LandingImagePicker/);
  assert.match(admin, /SEO лендинга/);
  assert.match(admin, /\/site\/why-stock\.webp/);
  assert.match(read("src/lib/upload-storage.ts"), /"landings"/);
});

test("лендинг использует двухшаговую форму и единый запрос КП", () => {
  const form = read("src/components/landing/LandingLeadForm.tsx");
  const card = read("src/components/landing/LandingProductCard.tsx");
  const page = read("src/app/lp/[category]/[[...intent]]/page.tsx");
  assert.match(form, /continueToContact/);
  assert.match(form, /Перейти к получению подбора/);
  assert.match(form, /Не знаю параметры — нужна помощь инженера/);
  assert.match(form, /unknownParameters/);
  assert.match(form, /selectedProducts/);
  assert.match(form, /name="requisites"/);
  assert.match(form, /LANDING_QUICK_TASK_EVENT/);
  assert.match(card, /Добавить в КП/);
  assert.match(page, /LandingQuoteBar/);
  assert.match(page, /Примеры решённых задач/);
});

test("товары без фотографии исключены из публичного каталога", () => {
  const data = read("src/lib/data.ts");
  const productsDb = read("src/lib/products-db.ts");
  assert.match(data, /\.filter\(\(p\) => !p\.draft && hasCatalogImage\(p\)\)/);
  assert.match(data, /if \(p\.draft \|\| !hasCatalogImage\(p\)\) continue/);
  assert.match(productsDb, /\.filter\(hasProductImage\)/);
  assert.match(productsDb, /p\.images != '\[\]' OR EXISTS/);
});

test("лендинги используют общий логотип и предметные social preview", () => {
  const header = read("src/components/landing/LandingHeader.tsx");
  const landing = read("src/app/lp/[category]/[[...intent]]/page.tsx");
  const category = read("src/app/c/[slug]/page.tsx");
  const subcategory = read("src/app/c/[slug]/[subslug]/page.tsx");
  const product = read("src/app/p/[slug]/page.tsx");
  const preview = read("src/lib/social-preview.ts");

  assert.match(header, /import \{ Logo \}/);
  assert.match(header, /<Logo \/>/);
  assert.match(landing, /categorySocialPreviewPath/);
  assert.doesNotMatch(landing, /absoluteUrl\("\/og\.png"\)/);
  for (const source of [category, subcategory, product]) {
    assert.match(source, /categorySocialPreviewPath/);
    assert.match(source, /summary_large_image/);
  }
  assert.match(preview, /CATEGORY_VISUALS/);
  assert.doesNotMatch(preview, /manager\.jpg/i);
});
