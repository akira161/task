const test = require("node:test");
const assert = require("node:assert");
const L = require("../web/logic.js");

test("itemsFor merges special items on that date only", () => {
  const cfg = { defaultItems: ["財布", "鍵"], special: [{ date: "2026-10-10", items: ["体操服", "鍵"] }] };
  assert.deepStrictEqual(L.itemsFor(cfg, new Date(2026, 9, 10)), ["財布", "鍵", "体操服"]);
  assert.deepStrictEqual(L.itemsFor(cfg, new Date(2026, 9, 11)), ["財布", "鍵"]);
});

test("dueTimes respects schedule, fired and grace", () => {
  const cfg = { times: ["07:30", "18:00"] };
  assert.deepStrictEqual(L.dueTimes(cfg, new Date(2026, 9, 7, 7, 29), []), []);
  assert.deepStrictEqual(L.dueTimes(cfg, new Date(2026, 9, 7, 7, 30), []), ["07:30"]);
  assert.deepStrictEqual(L.dueTimes(cfg, new Date(2026, 9, 7, 7, 30), ["2026-10-07 07:30"]), []);
  assert.deepStrictEqual(L.dueTimes(cfg, new Date(2026, 9, 7, 8, 31), []), []);
});

test("normalizeTime / splitItems", () => {
  assert.strictEqual(L.normalizeTime("7:05"), "07:05");
  assert.strictEqual(L.normalizeTime("25:00"), null);
  assert.deepStrictEqual(L.splitItems("a, b、c\n a ,,"), ["a", "b", "c"]);
});
