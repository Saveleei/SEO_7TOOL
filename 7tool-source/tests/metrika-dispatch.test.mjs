import assert from "node:assert/strict";
import test from "node:test";

import { createMetrikaDispatcher } from "../src/lib/metrika-dispatch.mjs";

function fixture() {
  const callbacks = [];
  const calls = [];
  const sentOnce = new Set();
  let available = false;

  const dispatcher = createMetrikaDispatcher({
    deliver(event, params) {
      if (!available) return false;
      calls.push({ event, params });
      return true;
    },
    schedule(callback, delay) {
      callbacks.push({ callback, delay });
    },
    readOnce(key) {
      return sentOnce.has(key);
    },
    writeOnce(key) {
      sentOnce.add(key);
    },
    retryDelays: [10, 20, 40],
  });

  return {
    callbacks,
    calls,
    sentOnce,
    dispatcher,
    enable() { available = true; },
    runNext() { callbacks.shift()?.callback(); },
  };
}

test("событие ждёт загрузки Метрики и отправляется при повторе", () => {
  const f = fixture();
  f.dispatcher.send("view_category", { page_type: "category" });

  assert.equal(f.calls.length, 0);
  assert.deepEqual(f.callbacks.map((item) => item.delay), [10]);

  f.enable();
  f.runNext();
  assert.deepEqual(f.calls, [{ event: "view_category", params: { page_type: "category" } }]);
});

test("одноразовая цель помечается только после передачи в Метрику", () => {
  const f = fixture();
  f.dispatcher.sendOnce("category:/c/stanki", "view_category", { page_type: "category" });
  f.dispatcher.sendOnce("category:/c/stanki", "view_category", { page_type: "category" });

  assert.equal(f.sentOnce.has("category:/c/stanki"), false);
  assert.equal(f.callbacks.length, 1, "повтор не должен создавать вторую очередь");

  f.enable();
  f.runNext();
  assert.equal(f.sentOnce.has("category:/c/stanki"), true);
  assert.equal(f.calls.length, 1);

  f.dispatcher.sendOnce("category:/c/stanki", "view_category", { page_type: "category" });
  assert.equal(f.calls.length, 1, "доставленная одноразовая цель не дублируется");
});

test("обычные события не склеиваются, пока Метрика загружается", () => {
  const f = fixture();
  f.dispatcher.send("add_to_cart", { variant_id: "A1" });
  f.dispatcher.send("add_to_cart", { variant_id: "A2" });

  assert.equal(f.callbacks.length, 1);
  f.enable();
  f.runNext();
  assert.deepEqual(f.calls.map((call) => call.params.variant_id), ["A1", "A2"]);
});
