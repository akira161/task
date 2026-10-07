// 画面に依存しないロジック(ブラウザと Node のテストの両方から使う)
(function (root) {
  function isoDate(d) {
    const p = (n) => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }

  function splitItems(text) {
    const out = [];
    for (const part of String(text).split(/[,、\n]/)) {
      const s = part.trim();
      if (s && !out.includes(s)) out.push(s);
    }
    return out;
  }

  // その日の項目 = いつもの + その日付の特別な持ち物
  function itemsFor(cfg, d) {
    const items = [...cfg.defaultItems];
    const day = isoDate(d);
    for (const e of cfg.special) {
      if (e.date === day) for (const it of e.items) if (!items.includes(it)) items.push(it);
    }
    return items;
  }

  const api = { isoDate, splitItems, itemsFor };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Logic = api;
})(typeof self !== "undefined" ? self : this);
