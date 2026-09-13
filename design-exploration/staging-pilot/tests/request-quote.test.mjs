import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createDraftNumber, parseQuotePrice, sanitizeRequestItems, summarizeRequest } from "../app/data/requestQuote.mjs";

test("quote totals only include exact prices and respect quantities", () => {
  const items = [
    { price:"47 999 ₽", quantity:2 },
    { price:"1 875 ₽", quantity:3 },
    { price:"Цена по запросу", quantity:1 },
    { price:"от 2 980 ₽", quantity:1 },
  ];
  assert.equal(parseQuotePrice("47 999 ₽"), 47999);
  assert.equal(parseQuotePrice("Цена по запросу"), null);
  assert.equal(parseQuotePrice("от 2 980 ₽"), null);
  assert.deepEqual(summarizeRequest(items), { totalQuantity:7, pricedItems:2, estimatedTotal:101623, hasUnpricedItems:true });
});

test("restored quote draft accepts only bounded product context", () => {
  const restored = sanitizeRequestItems([
    { id:"variant:A9409", title:"LENZ STEYR-35", article:"Артикул STEYR-35", price:"47 999 ₽", quantity:5000, image:"javascript:alert(1)", href:"https://outside.example" },
    { id:"variant:A12935", title:"Сверло LZTS-021", article:"Артикул LZTS-021", price:"2 882 ₽", quantity:1, image:"https://s3.export.k2tool.ru/pim/images/product/preview/cutter.png", href:"/product/sverla-koronchatye-lzts?variant=A12935#variants" },
    { id:"variant:unsafe", title:"Опасная ссылка", article:"Артикул X", image:"http://outside.example/pixel.gif", href:"//outside.example/product/foo" },
    { title:"missing required fields" },
  ]);
  assert.equal(restored.length, 3);
  assert.equal(restored[0].quantity, 999);
  assert.equal(restored[0].image, undefined);
  assert.equal(restored[0].href, undefined);
  assert.equal(restored[1].image, "https://s3.export.k2tool.ru/pim/images/product/preview/cutter.png");
  assert.equal(restored[1].href, "/product/sverla-koronchatye-lzts?variant=A12935#variants");
  assert.equal(restored[2].image, undefined);
  assert.equal(restored[2].href, undefined);
});

test("local draft numbers are recognisable and date-scoped", () => {
  assert.match(createDraftNumber(new Date(2026, 8, 12, 10, 30, 0)), /^7T-20260912-\d{5}$/u);
});

test("quote drawer keeps the shortest B2B path and only submits to the local API", async () => {
  const component = await readFile(new URL("../app/ui/RequestCart.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(component, /window\.localStorage\.setItem\(STORAGE_KEY/u);
  assert.match(component, /Email для КП/u);
  assert.match(component, /Телефон для уточнения/u);
  assert.match(component, /Сохранить запрос КП/u);
  assert.match(component, /defaultChecked required/u);
  assert.match(component, /fetch\("\/api\/quote-requests"/u);
  assert.match(component, /crypto\.randomUUID\(\)/u);
  assert.match(component, /className="request-cart-honeypot"[^>]*name="website"[^>]*tabIndex=\{-1\}[^>]*aria-hidden="true"/u);
  assert.match(component, /ManagerContactCard compact placement="quote_drawer"/u);
  assert.match(component, /<a href=\{item\.href\} aria-label=\{`Открыть товар:/u);
  assert.match(component, /<a href=\{item\.href\} tabIndex=\{-1\} aria-hidden="true">\{media\}<\/a>/u);
  assert.match(component, /page_type:"quote_request"/u);
  assert.doesNotMatch(component, /fetch\("https?:|mailto:/u);
  assert.match(styles, /\.request-cart-drawer \{[^}]*width:min\(720px,100%\)/us);
  assert.match(styles, /\.request-cart-form input,\.request-cart-form textarea \{[^}]*font:[^;]*14px/us);
});

test("invoice requisites are optional, progressive and size-bounded", async () => {
  const component = await readFile(new URL("../app/ui/RequestCart.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(component, /<details className="request-cart-wide request-cart-requisites">/u);
  assert.match(component, /name="billing_inn"[^>]*pattern="\[0-9\]\{10\}\|\[0-9\]\{12\}"/u);
  assert.match(component, /name="billing_file"[^>]*accept="\.pdf,\.png,\.jpg,\.jpeg,application\/pdf,image\/png,image\/jpeg"/u);
  assert.match(component, /requisitesFile\.size > 10 \* 1024 \* 1024/u);
  assert.match(component, /Счёт подготовят только после подтверждения цены, наличия, комплектации и даты отгрузки/u);
  assert.match(component, /billingProvided && <div className="request-cart-billing-status">/u);
  assert.doesNotMatch(component, /name="billing_(?:inn|file)"[^>]*required/u);
  assert.match(styles, /\.request-cart-requisites>summary \{[^}]*cursor:pointer/us);
});
