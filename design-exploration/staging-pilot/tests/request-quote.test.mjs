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
    { title:"missing required fields" },
  ]);
  assert.equal(restored.length, 1);
  assert.equal(restored[0].quantity, 999);
  assert.equal(restored[0].image, undefined);
  assert.equal(restored[0].href, undefined);
});

test("local draft numbers are recognisable and date-scoped", () => {
  assert.match(createDraftNumber(new Date(2026, 8, 12, 10, 30, 0)), /^7T-20260912-\d{5}$/u);
});

test("quote drawer keeps the shortest B2B path and never sends externally", async () => {
  const component = await readFile(new URL("../app/ui/RequestCart.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(component, /window\.localStorage\.setItem\(STORAGE_KEY/u);
  assert.match(component, /Email для КП/u);
  assert.match(component, /Телефон для уточнения/u);
  assert.match(component, /Сформировать запрос КП/u);
  assert.match(component, /defaultChecked required/u);
  assert.match(component, /createDraftNumber\(\)/u);
  assert.match(component, /ManagerContactCard compact placement="quote_drawer"/u);
  assert.match(component, /page_type:"quote_request"/u);
  assert.doesNotMatch(component, /fetch\(|mailto:|window\.location/u);
  assert.match(styles, /\.request-cart-drawer \{[^}]*width:min\(720px,100%\)/us);
  assert.match(styles, /\.request-cart-form input,\.request-cart-form textarea \{[^}]*font:[^;]*14px/us);
});
