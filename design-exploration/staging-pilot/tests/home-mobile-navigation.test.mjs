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
  assert.match(menu, /Доставка по России/u);
  assert.match(menu, /Гарантия и сервис/u);
  assert.match(menu, /header-catalog-group-media/u);
  assert.match(menu, /group\.representativeImage \|\| group\.image/u);
  assert.match(css, /\.header-catalog-panel \{ position:fixed; z-index:220; inset:0;/u);
  assert.match(css, /\.header-catalog-mobile-top \{ position:sticky/u);
  assert.match(css, /\.header-catalog-group--mobile \{ grid-template-columns:28px 48px minmax\(0,1fr\) 32px/u);
});

test("homepage first screen pairs visual assortment with editable warehouse evidence", async () => {
  const [page, css] = await Promise.all([
    read("../app/page.tsx"),
    read("../app/globals.css"),
  ]);

  assert.match(page, /hero-mobile-catalog-preview/u);
  assert.match(page, /homepageKeyCategories\.slice\(0, 3\)/u);
  assert.match(page, /trustContent\.cards\.slice\(0, 4\)\.map/u);
  assert.match(page, /trustCardImageUrl\(card\)/u);
  assert.match(page, /Реальные склад, комплектация и отгрузка/u);
  assert.match(css, /\.hero-mobile-catalog-preview \.homepage-category-tiles--hero \{ display:flex/u);
  assert.match(css, /\.homepage-main \.hero-grid>\.hero-catalog-card \{ display:none; \}/u);
  assert.match(css, /\.assurance-grid \{ display:grid; grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/u);
  assert.match(css, /\.assurance-grid[\s\S]*?scroll-snap-type:x mandatory/u);
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
