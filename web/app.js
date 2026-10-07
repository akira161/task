(function () {
  const L = window.Logic;
  const KEY = "mochimono.config.v1";
  const FIRED_KEY = "mochimono.fired.v1";
  const $ = (id) => document.getElementById(id);

  const DEFAULT = { times: ["07:30"], defaultItems: ["財布", "スマホ", "鍵", "定期券"], special: [] };

  function load() {
    try {
      const c = JSON.parse(localStorage.getItem(KEY));
      if (c && Array.isArray(c.times) && Array.isArray(c.defaultItems) && Array.isArray(c.special)) return c;
    } catch (e) {}
    return JSON.parse(JSON.stringify(DEFAULT));
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) {} }
  function loadFired() { try { return JSON.parse(localStorage.getItem(FIRED_KEY)) || []; } catch (e) { return []; } }
  function saveFired(f) { try { localStorage.setItem(FIRED_KEY, JSON.stringify(f)); } catch (e) {} }

  let cfg = load();

  // ---- 設定画面 ----
  function renderList(ul, rows, onDel, onClick) {
    ul.textContent = "";
    rows.forEach((text, i) => {
      const li = document.createElement("li");
      const span = document.createElement("span");
      span.textContent = text;
      const b = document.createElement("button");
      b.className = "del"; b.type = "button"; b.textContent = "削除";
      b.addEventListener("click", (e) => { e.stopPropagation(); onDel(i); });
      li.append(span, b);
      if (onClick) { li.classList.add("sp"); li.addEventListener("click", () => onClick(i)); }
      ul.append(li);
    });
  }
  function render() {
    renderList($("timeList"), cfg.times, (i) => { cfg.times.splice(i, 1); save(); render(); });
    renderList($("defList"), cfg.defaultItems, (i) => { cfg.defaultItems.splice(i, 1); save(); render(); });
    renderList($("spList"), cfg.special.map((e) => e.date + ": " + e.items.join(", ")),
      (i) => { cfg.special.splice(i, 1); save(); render(); },
      (i) => { $("spDate").value = cfg.special[i].date; $("spItems").value = cfg.special[i].items.join(", "); });
  }

  $("timeForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const t = L.normalizeTime($("timeInput").value);
    if (t && !cfg.times.includes(t)) { cfg.times.push(t); cfg.times.sort(); save(); render(); }
    $("timeInput").value = "";
  });
  $("defForm").addEventListener("submit", (e) => {
    e.preventDefault();
    for (const it of L.splitItems($("defInput").value)) if (!cfg.defaultItems.includes(it)) cfg.defaultItems.push(it);
    save(); render(); $("defInput").value = "";
  });
  $("spForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const date = $("spDate").value, items = L.splitItems($("spItems").value);
    if (!date || !items.length) return;
    cfg.special = cfg.special.filter((s) => s.date !== date);
    cfg.special.push({ date, items });
    cfg.special.sort((a, b) => (a.date < b.date ? -1 : 1));
    save(); render(); $("spItems").value = "";
  });

  // ---- チェック画面(全部チェックするまで閉じられない) ----
  let showing = false;
  function showCheck() {
    if (showing) return;
    const items = L.itemsFor(cfg, new Date());
    if (!items.length) return;
    showing = true;
    const ul = $("checkList");
    ul.textContent = "";
    const boxes = items.map((name) => {
      const li = document.createElement("li");
      const label = document.createElement("label");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      label.append(cb, document.createTextNode(name));
      li.append(label); ul.append(li);
      cb.addEventListener("change", update);
      return cb;
    });
    function update() {
      const rest = boxes.filter((b) => !b.checked).length;
      $("okBtn").disabled = rest > 0;
      $("remain").textContent = rest ? "あと " + rest + " 個" : "全部そろっています";
    }
    update();
    $("overlay").hidden = false;
    document.body.style.overflow = "hidden";
  }
  $("okBtn").addEventListener("click", () => {
    $("overlay").hidden = true; showing = false; document.body.style.overflow = "";
    if (location.search.includes("check")) history.replaceState(null, "", location.pathname);
  });
  $("checkNow").addEventListener("click", showCheck);

  // ---- 時刻になったら(アプリを開いている間)自動表示 ----
  function tick() {
    const now = new Date();
    const day = L.isoDate(now);
    const fired = loadFired().filter((k) => k.startsWith(day));
    const due = L.dueTimes(cfg, now, fired);
    if (due.length) {
      due.forEach((t) => fired.push(day + " " + t));
      saveFired(fired);
      showCheck();
    }
  }
  setInterval(tick, 15000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(); });

  // ---- 起動時 ----
  $("autoUrl").value = location.origin + location.pathname.replace(/[^/]*$/, "") + "?check=1";
  $("copyUrl").addEventListener("click", () => {
    $("autoUrl").select();
    (navigator.clipboard ? navigator.clipboard.writeText($("autoUrl").value) : Promise.reject())
      .catch(() => document.execCommand("copy"));
    $("copyUrl").textContent = "コピーしました";
  });
  render();
  if (new URLSearchParams(location.search).has("check")) showCheck();
  else tick();

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
