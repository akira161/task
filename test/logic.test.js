const test = require("node:test");
const assert = require("node:assert");
const L = require("../web/logic.js");

test("itemsFor merges special items on that date only", () => {
  const cfg = { defaultItems: ["財布", "鍵"], special: [{ date: "2026-10-10", items: ["体操服", "鍵"] }] };
  assert.deepStrictEqual(L.itemsFor(cfg, new Date(2026, 9, 10)), ["財布", "鍵", "体操服"]);
  assert.deepStrictEqual(L.itemsFor(cfg, new Date(2026, 9, 11)), ["財布", "鍵"]);
});

test("splitItems", () => {
  assert.deepStrictEqual(L.splitItems("a, b、c\n a ,,"), ["a", "b", "c"]);
});
