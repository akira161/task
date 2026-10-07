'use strict';
(function () {
  const { parseQuick, fmt } = QuickParse;
  const $ = (id) => document.getElementById(id);
  const STATUS_LABEL = { todo: '未着手', doing: '進行中', waiting: '待ち', done: '完了' };
  const STATUSES = ['todo', 'doing', 'waiting', 'done'];
  const store = {
    get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  };

  const state = {
    tasks: [], rev: -1,
    view: store.get('view', 'board'),
    project: store.get('project', ''),
    showDone: store.get('showDone', '') === '1',
    sel: null, dragging: false, editing: null,
  };
  let token = '';

  // ---- 認証: URL の #token=xxx で初回ログインも可能 ----
  const m = /[#&]token=([^&]+)/.exec(location.hash);
  if (m) {
    store.set('token', decodeURIComponent(m[1]));
    history.replaceState(null, '', location.pathname + location.search);
  }
  token = store.get('token', '');

  async function api(method, path, body) {
    const res = await fetch(path, {
      method,
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401) { askLogin(); throw new Error('unauthorized'); }
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  function askLogin(err) {
    if ($('login').open) return;
    $('login-err').textContent = err || '';
    $('login').showModal();
  }
  $('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    token = $('token-input').value.trim();
    try {
      await api('GET', '/api/rev');
      store.set('token', token);
      $('login').close();
      refresh(true);
    } catch { $('login-err').textContent = 'トークンが正しくありません'; }
  });

  // ---- データ同期 ----
  function load() {
    try { const c = JSON.parse(store.get('cache', 'null')); if (c) { state.tasks = c.tasks; state.rev = c.rev; } } catch {}
  }
  async function refresh(force) {
    if (!token || state.dragging || $('login').open) return;
    try {
      const { rev } = await api('GET', '/api/rev');
      if (!force && rev === state.rev) return;
      const data = await api('GET', '/api/tasks');
      state.tasks = data.tasks; state.rev = data.rev;
      store.set('cache', JSON.stringify(data));
      render();
    } catch {}
  }
  async function mutate(id, patch) {
    const t = state.tasks.find((x) => x.id === id);
    if (!t) return;
    Object.assign(t, patch); // 楽観的更新
    render();
    try { await api('PATCH', '/api/tasks/' + id, patch); } catch {}
    refresh(true);
  }
  async function addTask(fields) {
    try { await api('POST', '/api/tasks', fields); } catch { return false; }
    await refresh(true);
    return true;
  }
  async function removeTask(id) {
    state.tasks = state.tasks.filter((t) => t.id !== id);
    render();
    try { await api('DELETE', '/api/tasks/' + id); } catch {}
    refresh(true);
  }

  // ---- 描画 ----
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (v != null && v !== false) el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
    return el;
  }

  const today = () => fmt(new Date());
  function cmp(a, b) {
    return (a.status === 'done' ? (b.doneAt || 0) - (a.doneAt || 0) : 0) ||
      a.priority - b.priority ||
      (a.due || '9999').localeCompare(b.due || '9999') ||
      a.created - b.created;
  }
  function projects() {
    return [...new Set(state.tasks.filter((t) => t.status !== 'done' || state.showDone).map((t) => t.project).filter(Boolean))].sort();
  }
  function visible() {
    return state.tasks.filter((t) =>
      (!state.project || t.project === state.project) && (state.showDone || t.status !== 'done'));
  }

  function card(t) {
    const d = t.due;
    const dueCls = d && t.status !== 'done' ? (d < today() ? 'over' : d <= fmt(new Date(Date.now() + 864e5)) ? 'soon' : '') : '';
    return h('div', {
      class: `card p${t.priority} ${t.status}${t.id === state.sel ? ' sel' : ''}`,
      draggable: 'true', 'data-id': t.id,
      onclick: () => { state.sel = t.id; openEdit(t.id); },
      ondragstart: (e) => { state.dragging = true; e.dataTransfer.setData('text/plain', t.id); },
      ondragend: () => { state.dragging = false; render(); },
    },
    h('div', { class: 'body' },
      h('div', { class: 'title' }, t.title),
      h('div', { class: 'meta' },
        state.view === 'project' ? h('span', { class: 'tag' }, STATUS_LABEL[t.status]) : null,
        state.view === 'board' && t.project ? h('span', { class: 'tag' }, '#' + t.project) : null,
        d ? h('span', { class: 'tag ' + dueCls }, '📅 ' + d.slice(5).replace('-', '/')) : null,
        t.note ? h('span', { class: 'tag' }, '📝') : null)),
    h('div', { class: 'btns' },
      t.status !== 'doing' && t.status !== 'done'
        ? h('button', { title: '進行中にする', onclick: (e) => { e.stopPropagation(); mutate(t.id, { status: 'doing' }); } }, '▶') : null,
      t.status !== 'done'
        ? h('button', { title: '完了', onclick: (e) => { e.stopPropagation(); mutate(t.id, { status: 'done' }); } }, '✓')
        : h('button', { title: '戻す', onclick: (e) => { e.stopPropagation(); mutate(t.id, { status: 'todo' }); } }, '↩')));
  }

  function column(title, cls, list, onDrop) {
    const col = h('section', {
      class: 'col ' + cls,
      ondragover: (e) => { e.preventDefault(); col.classList.add('over'); },
      ondragleave: () => col.classList.remove('over'),
      ondrop: (e) => {
        e.preventDefault();
        state.dragging = false;
        onDrop(e.dataTransfer.getData('text/plain'));
      },
    },
    h('h2', null, h('span', null, title), h('span', { class: 'n' }, list.length)),
    h('div', { class: 'cards' }, list.length ? list.sort(cmp).map(card) : h('div', { class: 'empty' }, '—')));
    return col;
  }

  function render() {
    store.set('view', state.view); store.set('project', state.project);
    store.set('showDone', state.showDone ? '1' : '');
    $('v-board').className = state.view === 'board' ? 'on' : '';
    $('v-project').className = state.view === 'project' ? 'on' : '';
    $('show-done').checked = state.showDone;

    const ps = projects();
    if (state.project && !ps.includes(state.project) && !state.tasks.some((t) => t.project === state.project)) state.project = '';
    $('chips').replaceChildren(
      h('button', { class: 'chip' + (!state.project ? ' on' : ''), onclick: () => { state.project = ''; render(); } }, 'すべて'),
      ...ps.map((p) => h('button', { class: 'chip' + (state.project === p ? ' on' : ''), onclick: () => { state.project = state.project === p ? '' : p; render(); } }, '#' + p)));
    $('projects').replaceChildren(...[...new Set(state.tasks.map((t) => t.project).filter(Boolean))].map((p) => h('option', { value: p })));

    const list = visible();
    let cols;
    if (state.view === 'board') {
      cols = STATUSES.filter((s) => s !== 'done' || state.showDone).map((s) =>
        column(STATUS_LABEL[s], s, list.filter((t) => t.status === s), (id) => mutate(id, { status: s })));
    } else {
      const names = [...new Set(list.map((t) => t.project))].sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)));
      const order = { doing: 0, waiting: 1, todo: 2, done: 3 };
      cols = names.map((p) => {
        const items = list.filter((t) => t.project === p).sort((a, b) => order[a.status] - order[b.status] || cmp(a, b));
        const col = column(p ? '#' + p : '(プロジェクトなし)', '', [], (id) => mutate(id, { project: p }));
        col.querySelector('.n').textContent = items.length + (items.some((t) => t.status === 'doing') ? ` ・進行 ${items.filter((t) => t.status === 'doing').length}` : '');
        col.querySelector('.cards').replaceChildren(...items.map(card));
        return col;
      });
      if (!cols.length) cols = [column('タスクなし', '', [], () => {})];
    }
    $('board').replaceChildren(...cols);
    state.order = list; // キーボード選択用
  }

  // キーボード選択順（画面上の並び）
  function domIds() { return [...document.querySelectorAll('.card')].map((c) => c.dataset.id); }
  function moveSel(dir) {
    const ids = domIds();
    if (!ids.length) return;
    const i = ids.indexOf(state.sel);
    state.sel = ids[Math.max(0, Math.min(ids.length - 1, i < 0 ? 0 : i + dir))];
    render();
    document.querySelector('.card.sel')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  // ---- クイック入力 ----
  const qi = $('quick-input');
  function quickParsed() {
    const p = parseQuick(qi.value);
    if (!p.project && state.project) p.project = state.project;
    return p;
  }
  qi.addEventListener('input', () => {
    const p = parseQuick(qi.value);
    $('preview').replaceChildren(...(qi.value.trim() ? [
      p.project || state.project ? h('span', { class: 'tag' }, '#' + (p.project || state.project)) : null,
      h('span', { class: 'tag' }, '優先度 ' + ['', '高', '中', '低'][p.priority]),
      p.due ? h('span', { class: 'tag' }, '📅 ' + p.due) : null,
      p.status !== 'todo' ? h('span', { class: 'tag' }, STATUS_LABEL[p.status]) : null,
    ] : []));
  });
  $('quick').addEventListener('submit', async (e) => {
    e.preventDefault();
    const p = quickParsed();
    if (!p.title) return;
    qi.value = ''; $('preview').replaceChildren();
    if (!(await addTask(p))) { qi.value = qi.value || p.title; }
  });

  // ---- 編集ダイアログ ----
  function openEdit(id) {
    const t = state.tasks.find((x) => x.id === id);
    if (!t) return;
    state.editing = id;
    $('e-title').value = t.title; $('e-project').value = t.project; $('e-due').value = t.due;
    $('e-status').value = t.status; $('e-priority').value = t.priority; $('e-note').value = t.note || '';
    $('edit').showModal();
  }
  $('edit-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = $('e-title').value.trim();
    if (title) mutate(state.editing, {
      title, project: $('e-project').value.trim().replace(/\s+/g, '_'), due: $('e-due').value,
      status: $('e-status').value, priority: +$('e-priority').value, note: $('e-note').value,
    });
    $('edit').close();
  });
  $('e-cancel').onclick = () => $('edit').close();
  $('e-delete').onclick = () => {
    if (confirm('このタスクを削除しますか？')) { removeTask(state.editing); $('edit').close(); }
  };

  // ---- ツールバー ----
  $('v-board').onclick = () => { state.view = 'board'; render(); };
  $('v-project').onclick = () => { state.view = 'project'; render(); };
  $('show-done').onchange = (e) => { state.showDone = e.target.checked; render(); };
  $('help-btn').onclick = () => {
    $('quick-url').textContent = `${location.origin}/api/quick?token=<トークン>&text=<URLエンコードした文章>`;
    $('help').showModal();
  };

  // ---- キーボードショートカット ----
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); qi.focus(); qi.select(); return; }
    if (e.key === 'Escape' && document.activeElement === qi) { qi.blur(); return; }
    const tag = (e.target.tagName || '').toLowerCase();
    if (['input', 'textarea', 'select'].includes(tag) || document.querySelector('dialog[open]')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    const sel = state.sel;
    const act = {
      n: () => qi.focus(), '/': () => qi.focus(),
      b: () => { state.view = 'board'; render(); }, p: () => { state.view = 'project'; render(); },
      j: () => moveSel(1), k: () => moveSel(-1), ArrowDown: () => moveSel(1), ArrowUp: () => moveSel(-1),
      '?': () => $('help-btn').click(),
    };
    const onSel = {
      Enter: () => openEdit(sel), e: () => openEdit(sel),
      t: () => mutate(sel, { status: 'todo' }), s: () => mutate(sel, { status: 'doing' }),
      w: () => mutate(sel, { status: 'waiting' }), x: () => mutate(sel, { status: 'done' }),
      1: () => mutate(sel, { priority: 1 }), 2: () => mutate(sel, { priority: 2 }), 3: () => mutate(sel, { priority: 3 }),
      Delete: () => confirm('削除しますか？') && removeTask(sel), Backspace: () => confirm('削除しますか？') && removeTask(sel),
    };
    const fn = act[k] || (sel && state.tasks.some((t) => t.id === sel) && onSel[k]);
    if (fn) { e.preventDefault(); fn(); }
  });

  // ---- 起動 ----
  load();
  render();
  if (!token) askLogin(); else refresh(true);

  // 共有リンク/ブックマーク用: /?add=文章
  const qs = new URLSearchParams(location.search);
  const add = qs.get('add');
  if (add && token) {
    const p = parseQuick(add);
    if (p.title) addTask(p);
  }
  if (qs.get('focus')) qi.focus();
  if (add || qs.get('focus')) history.replaceState(null, '', location.pathname);

  setInterval(() => { if (!document.hidden) refresh(); }, 5000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
