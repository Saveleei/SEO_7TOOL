import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("mobile navigation keeps the four B2B destinations fixed and non-duplicated", async () => {
  const [header, navigation, cart, css] = await Promise.all([
    read("../app/ui/PilotHeader.tsx"),
    read("../app/ui/MobileBottomNavigation.tsx"),
    read("../app/ui/RequestCart.tsx"),
    read("../app/globals.css"),
  ]);

  assert.match(header, /<MobileBottomNavigation \/>/u);
  assert.match(navigation, /Основная мобильная навигация/u);
  assert.match(navigation, />Главная</u);
  assert.match(navigation, />Каталог</u);
  assert.match(navigation, /<RequestCartButton compact \/>/u);
  assert.match(navigation, /placement="mobile_bottom_navigation"/u);
  assert.match(cart, /<span>КП<\/span>/u);
  assert.match(css, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/u);
  assert.match(css, /body\.catalog-menu-open \.mobile-action-bar \{ visibility:hidden/u);
  assert.match(css, /@media \(max-width:760px\)[\s\S]*?\.site-header \{ position:sticky; top:0;/u);
  assert.match(css, /\.site-header \{ position:sticky; top:0; z-index:120; background:#fff;[\s\S]*?backdrop-filter:none;/u);
});

test("mobile catalog is a focus-contained full-screen navigation surface", async () => {
  const [menu, css] = await Promise.all([
    read("../app/ui/HeaderCatalogMenu.tsx"),
    read("../app/globals.css"),
  ]);

  assert.match(menu, /7tool:open-catalog-menu/u);
  assert.match(menu, /FOCUSABLE_SELECTOR/u);
  assert.match(menu, /event\.key !== "Tab"/u);
  assert.match(menu, /closeButtonRef\.current\?\.focus/u);
  assert.match(menu, /role="dialog" aria-modal="true"/u);
  assert.match(menu, /header-catalog-mobile-contact/u);
  assert.match(menu, /siteContact\.phoneHref/u);
  assert.match(menu, /mailto:\$\{siteContact\.email\}/u);
  assert.doesNotMatch(menu, /header-catalog-service-links/u);
  assert.match(menu, /header-catalog-subcategory-media/u);
  assert.match(menu, /subcategory\.image/u);
  assert.match(css, /\.header-catalog-panel \{ position:fixed; z-index:220; inset:0;/u);
  assert.match(css, /\.header-catalog-mobile-top \{ position:sticky/u);
  assert.match(css, /\.header-catalog-group--mobile \{ min-height:68px; grid-template-columns:28px minmax\(0,1fr\) 32px/u);
});

test("homepage first screen pairs visual assortment with editable warehouse evidence", async () => {
  const [page, css] = await Promise.all([
    read("../app/page.tsx"),
    read("../app/globals.css"),
  ]);

  assert.match(page, /hero-mobile-catalog-preview/u);
  assert.match(page, /homepageKeyCategories\.slice\(0, 4\)/u);
  assert.match(page, /Сверление · резка · кромка · сварка/u);
  assert.match(page, /hero-title-mobile/u);
  assert.match(page, /orderTrustCardsForDisplay\(trustContent\.cards\)\.slice\(0, 3\)\.map/u);
  assert.match(page, /trustCardImageUrl\(card\)/u);
  assert.match(page, /Реальные склад, комплектация и отгрузка/u);
  const firstScreen = css.slice(css.lastIndexOf("/* Mobile homepage first-screen refinement"));
  assert.match(firstScreen, /\.hero-mobile-catalog-preview \.homepage-category-tiles--hero \{[\s\S]*?display:grid;[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/u);
  assert.match(firstScreen, /\.hero-mobile-trust-points \{[\s\S]*?grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/u);
  assert.match(css, /\.homepage-main \.hero-grid>\.hero-catalog-card \{ display:none; \}/u);
  assert.match(css, /\.assurance-grid \{ display:grid; grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/u);
  assert.match(css, /@media \(max-width:760px\)[\s\S]*?\.assurance-grid \{[\s\S]*?display:flex;[\s\S]*?overflow-x:auto;/u);
  assert.doesNotMatch(page, /assurance-photo-card--secondary/u);
});

test("manager contact has an explicit close state and a full photo inside the panel", async () => {
  const [menu, css] = await Promise.all([
    read("../app/ui/HeaderContactMenu.tsx"),
    read("../app/globals.css"),
  ]);

  assert.match(menu, /header-contact-manager-photo/u);
  assert.match(menu, /header-contact-close-indicator/u);
  assert.match(menu, /Закрыть контакты менеджера/u);
  assert.match(menu, /event\.key !== "Escape"/u);
  assert.match(menu, /closeFromOutside/u);
  assert.match(css, /\.header-contact-menu\[open\]>summary \.header-contact-close-indicator/u);
  assert.match(css, /\.header-contact-manager-photo/u);
});
