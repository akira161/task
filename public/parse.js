// クイック入力の記法パーサ（ブラウザとサーバーで共用）
//   牛乳を買う #家事 !1 @明日 >doing
//   #プロジェクト / !1-3（1=高）/ @期限 / >状態(todo|doing|waiting|done)
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.QuickParse = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const STATUSES = ['todo', 'doing', 'waiting', 'done'];
  const DAYS = {
    sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
    日: 0, 月: 1, 火: 2, 水: 3, 木: 4, 金: 5, 土: 6,
  };

  function fmt(d) {
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function addDays(now, n) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    d.setDate(d.getDate() + n);
    return d;
  }

  function parseDate(s, now) {
    s = s.toLowerCase();
    if (s === 'today' || s === '今日') return fmt(now);
    if (s === 'tomorrow' || s === 'tmr' || s === '明日') return fmt(addDays(now, 1));
    if (s === '明後日') return fmt(addDays(now, 2));
    let m;
    if ((m = /^\+(\d+)d?$/.exec(s))) return fmt(addDays(now, +m[1]));
    if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s))) {
      const d = new Date(+m[1], +m[2] - 1, +m[3]);
      return d.getMonth() === +m[2] - 1 ? fmt(d) : null;
    }
    if ((m = /^(\d{1,2})[\/月](\d{1,2})日?$/.exec(s))) {
      let d = new Date(now.getFullYear(), +m[1] - 1, +m[2]);
      if (d.getMonth() !== +m[1] - 1) return null;
      if (fmt(d) < fmt(now)) d = new Date(now.getFullYear() + 1, +m[1] - 1, +m[2]);
      return fmt(d);
    }
    const key = s.replace(/曜日?$/, '').slice(0, 3);
    if (key in DAYS) {
      const diff = (DAYS[key] - now.getDay() + 7) % 7 || 7;
      return fmt(addDays(now, diff));
    }
    return null;
  }

  function parseQuick(text, now) {
    now = now || new Date();
    const out = { title: '', project: '', priority: 2, due: '', status: 'todo' };
    const words = [];
    for (const w of String(text).trim().split(/\s+/)) {
      let m;
      if ((m = /^#(.+)$/.exec(w))) out.project = m[1];
      else if ((m = /^!([1-3])$/.exec(w))) out.priority = +m[1];
      else if ((m = /^>(\w+)$/.exec(w)) && STATUSES.includes(m[1])) out.status = m[1];
      else if ((m = /^@(.+)$/.exec(w)) && parseDate(m[1], now)) out.due = parseDate(m[1], now);
      else words.push(w);
    }
    out.title = words.join(' ');
    return out;
  }

  return { parseQuick, parseDate, fmt, STATUSES };
});
