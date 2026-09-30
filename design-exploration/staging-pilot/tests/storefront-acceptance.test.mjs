import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildContactClickDetail, getContactChannel } from "../app/data/contactAnalytics.mjs";
import { PUBLIC_RELEASE_ROUTES } from "../scripts/smoke-release-candidate.mjs";

test("feed products remain discoverable and render safely without media or an article", async () => {
  const snapshot = JSON.parse(await readFile(new URL("../../../7tool-source/src/lib/products.json", import.meta.url), "utf8"));
  const productPage = await readFile(new URL("../app/product/[slug]/page.tsx", import.meta.url), "utf8");
  const variantPresentation = await readFile(new URL("../app/data/variantPresentation.ts", import.meta.url), "utf8");
  const catalog = await readFile(new URL("../app/data/feedCatalog.ts", import.meta.url), "utf8");
  const card = await readFile(new URL("../app/ui/FeedProductCard.tsx", import.meta.url), "utf8");
  const table = await readFile(new URL("../app/ui/FeedProductTable.tsx", import.meta.url), "utf8");
  const missingMedia = snapshot.products.filter((product) => !(product.images ?? []).some(Boolean));
  const missingSku = snapshot.products.filter((product) => product.variants.some((variant) => !String(variant.sku ?? "").trim()));
  assert.ok(missingMedia.length > 0);
  assert.ok(missingSku.length > 0);
  const rankedProducts = catalog.slice(catalog.indexOf("function getRankedCategoryProducts"), catalog.indexOf("function getCategoryFacets"));
  assert.doesNotMatch(rankedProducts, /filter[\s\S]*getFeedProductImage/u);
  assert.match(variantPresentation, /variant\.images\?\.\[0\]/u);
  assert.match(productPage, /primaryVariant\.images\?\.\[0\]/u);
  assert.match(productPage, /Артикул не указан в фиде/u);
  assert.match(card, /Артикул не указан в фиде/u);
  assert.match(table, /Артикул не указан в фиде/u);
  assert.ok(PUBLIC_RELEASE_ROUTES.includes(`/product/${missingMedia[0].slug}`));
  assert.ok(PUBLIC_RELEASE_ROUTES.includes(`/product/${missingSku[0].slug}`));
});

test("all four contact channels emit only allowlisted non-personal context", () => {
  assert.equal(getContactChannel("tel:+79626112419"), "phone");
  assert.equal(getContactChannel("mailto:info@7tool.ru"), "email");
  assert.equal(getContactChannel("https://t.me/saveleei"), "telegram");
  assert.equal(getContactChannel("https://max.ru/u/example"), "max");
  assert.equal(getContactChannel("https://example.com"), null);

  const detail = buildContactClickDetail({
    href:"mailto:info@7tool.ru?subject=Test",
    pathname:"/catalog/category/borfrezy",
    context:{ placement:"category_manager", phone:"+7 999 000-00-00", email:"buyer@example.com", name:"Иван" },
  });
  assert.deepEqual(detail, { event:"EMAIL_CLICK", channel:"email", page_type:"category", category:"borfrezy", placement:"category_manager" });
  assert.doesNotMatch(JSON.stringify(detail), /info@|buyer|7999|Иван/iu);

  const productDetail = buildContactClickDetail({ href:"https://t.me/saveleei", pathname:"/product/test-product", search:"?variant=A9409", context:{ placement:"product_manager" } });
  assert.deepEqual(productDetail, { event:"click_messenger", channel:"telegram", page_type:"product", product_id:"test-product", variant_id:"A9409", placement:"product_manager" });
});

test("desktop navigation and mobile manager bubble expose one reusable four-channel contact menu", async () => {
  const header = await readFile(new URL("../app/ui/PilotHeader.tsx", import.meta.url), "utf8");
  const menu = await readFile(new URL("../app/ui/HeaderContactMenu.tsx", import.meta.url), "utf8");
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(header, /HeaderContactMenu placement="desktop_header"/u);
  assert.match(header, /mobile-manager-bubble/u);
  assert.match(header, /HeaderContactMenu compact placement="mobile_manager_bubble"/u);
  assert.match(menu, /mobile-manager-avatar/u);
  assert.match(menu, /desktop-manager-label/u);
  assert.match(menu, /Менеджер 7TOOL/u);
  assert.match(menu, /siteContact\.photo/u);
  assert.match(menu, /viewBox="0 0 128 128"/u);
  assert.match(menu, /viewBox="0 0 100 100"/u);
  assert.doesNotMatch(menu, /<i aria-hidden="true">[TM]<\/i>/u);
  assert.match(menu, /siteContact\.phoneHref/u);
  assert.match(menu, /mailto:\$\{siteContact\.email\}/u);
  assert.match(menu, /siteContact\.telegramUrl/u);
  assert.match(menu, /siteContact\.maxUrl/u);
  assert.match(layout, /<ContactAnalytics \/>/u);
  assert.match(styles, /header-contact-messenger-icon--max[^}]*#00bfff[^}]*#6e1aff[^}]*#9500ff/u);
  assert.match(styles, /header-contact-messenger-icon svg \{ width:24px; height:24px; display:block; \}/u);
  assert.match(styles, /\.mobile-manager-bubble \{[\s\S]{0,180}position:fixed[\s\S]{0,180}display:block/u);
  assert.match(styles, /\.mobile-manager-online \{[\s\S]{0,220}background:#169b5f/u);
});

test("header catalog separates canonical browsing from task selection and stays keyboard-dismissable", async () => {
  const header = await readFile(new URL("../app/ui/PilotHeader.tsx", import.meta.url), "utf8");
  const catalogMenu = await readFile(new URL("../app/ui/HeaderCatalogMenu.tsx", import.meta.url), "utf8");
  const contacts = await readFile(new URL("../app/ui/HeaderContactMenu.tsx", import.meta.url), "utf8");
  const cart = await readFile(new URL("../app/ui/RequestCart.tsx", import.meta.url), "utf8");
  assert.match(header, /HeaderCatalogMenu groups=\{categoryGroups\}/u);
  assert.match(header, /getCanonicalCatalogGroups/u);
  assert.match(header, /href="\/#production-categories"/u);
  assert.match(catalogMenu, /group\.subcategories\.map/u);
  assert.doesNotMatch(catalogMenu, /slice\(0, 3\)|Все категории направления/u);
  assert.match(catalogMenu, /expandedGroup/u);
  assert.match(catalogMenu, /catalog-menu-open/u);
  assert.match(catalogMenu, /setAttribute\("inert"/u);
  assert.match(catalogMenu, /document\.addEventListener\("pointerdown"/u);
  assert.match(catalogMenu, /event\.key !== "Escape"/u);
  assert.match(catalogMenu, /href="\/#production-categories"/u);
  assert.match(contacts, /<span>Связаться<\/span>/u);
  assert.match(cart, /<span>КП<\/span>/u);
  assert.doesNotMatch(catalogMenu, /артикул|sku/iu);
});

test("product manager card uses official messenger marks and readable contact hierarchy", async () => {
  const card = await readFile(new URL("../app/ui/ManagerContactCard.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(card, /manager-messenger-mark--telegram/u);
  assert.match(card, /viewBox="0 0 128 128"/u);
  assert.match(card, /fill="#229ED9"/u);
  assert.match(card, /manager-messenger-mark--max/u);
  assert.match(card, /viewBox="0 0 100 100"/u);
  assert.doesNotMatch(card, /<i aria-hidden="true">[TM]<\/i>/u);
  assert.match(styles, /data-contact-placement="product_manager"[\s\S]{0,180}grid-template-columns:74px/u);
  assert.match(styles, /data-contact-placement="product_manager"[\s\S]{0,180}font-size:19px/u);
  assert.match(styles, /manager-messenger-mark--max[^}]*#00bfff[^}]*#6e1aff[^}]*#9500ff/u);
});

test("customer dialogs trap keyboard focus and restore a usable target", async () => {
  const callbackDialog = await readFile(new URL("../app/ui/ContactRequestDialog.tsx", import.meta.url), "utf8");
  const quoteDrawer = await readFile(new URL("../app/ui/RequestCart.tsx", import.meta.url), "utf8");
  for (const source of [callbackDialog, quoteDrawer]) {
    assert.match(source, /FOCUSABLE_SELECTOR/u);
    assert.match(source, /event\.key !== "Tab"/u);
    assert.match(source, /aria-modal="true"/u);
    assert.match(source, /onKeyDown=\{trapFocus\}/u);
  }
  assert.match(callbackDialog, /triggerElement\?\.focus\(\)/u);
  assert.match(quoteDrawer, /returnFocusRef\.current\?\.focus\(\)/u);
  assert.match(callbackDialog, /successCloseRef\.current\?\.focus\(\)/u);
  assert.match(callbackDialog, /createPortal\([\s\S]*document\.body\)/u);
  assert.match(quoteDrawer, /successCloseRef\.current\?\.focus\(\)/u);
});
