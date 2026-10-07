// 画面に依存しないロジック(ブラウザと Node のテストの両方から使う)
(function (root) {
  const GRACE_MIN = 60;
  const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

  function normalizeTime(text) {
    const m = TIME_RE.exec(String(text).trim());
    if (!m) return null;
    return String(m[1]).padStart(2, "0") + ":" + m[2];
  }

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

  // 今通知すべき時刻(未通知で、予定時刻を過ぎ、猶予内)
  function dueTimes(cfg, now, fired) {
    const day = isoDate(now);
    const due = [];
    for (const t of [...new Set(cfg.times)].sort()) {
      if (fired.includes(day + " " + t)) continue;
      const [h, m] = t.split(":").map(Number);
      const sched = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
      const diff = (now - sched) / 60000;
      if (diff >= 0 && diff <= GRACE_MIN) due.push(t);
    }
    return due;
  }

  const api = { normalizeTime, isoDate, splitItems, itemsFor, dueTimes };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Logic = api;
})(typeof self !== "undefined" ? self : this);
