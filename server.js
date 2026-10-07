// 依存ゼロのタスク管理サーバー。JSONファイルに保存し、静的ファイルとAPIを配信する。
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { parseQuick, STATUSES } = require('./public/parse.js');

const PORT = +process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PUBLIC = path.join(__dirname, 'public');
fs.mkdirSync(DATA_DIR, { recursive: true });

// ---- 認証トークン（環境変数 TASK_TOKEN、無ければ data/token を自動生成）----
function loadToken() {
  if (process.env.TASK_TOKEN) return process.env.TASK_TOKEN;
  const f = path.join(DATA_DIR, 'token');
  if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8').trim();
  const t = crypto.randomBytes(18).toString('base64url');
  fs.writeFileSync(f, t + '\n', { mode: 0o600 });
  return t;
}
const TOKEN = loadToken();

function authorized(req, url) {
  const h = req.headers.authorization || '';
  const given = h.startsWith('Bearer ') ? h.slice(7) : url.searchParams.get('token') || '';
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(TOKEN).digest();
  return crypto.timingSafeEqual(a, b);
}

// ---- 保存 ----
let db = { rev: 0, tasks: [] };
try {
  db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
} catch {}

function save() {
  db.rev++;
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, DB_FILE);
}

const clean = {
  title: (v) => String(v).slice(0, 500),
  project: (v) => String(v).slice(0, 60),
  note: (v) => String(v).slice(0, 10000),
  status: (v) => (STATUSES.includes(v) ? v : 'todo'),
  priority: (v) => ([1, 2, 3].includes(+v) ? +v : 2),
  due: (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : ''),
};

function applyFields(task, body) {
  for (const k of Object.keys(clean)) if (k in body) task[k] = clean[k](body[k]);
  if (task.status === 'done' && !task.doneAt) task.doneAt = Date.now();
  if (task.status !== 'done') delete task.doneAt;
  task.updated = Date.now();
}

function createTask(fields) {
  const t = { id: crypto.randomUUID(), title: '', project: '', note: '', status: 'todo', priority: 2, due: '', created: Date.now() };
  applyFields(t, fields);
  if (!t.title.trim()) return null;
  db.tasks.push(t);
  save();
  return t;
}

// ---- HTTP ----
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png',
};

function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let s = '';
    req.on('data', (c) => {
      s += c;
      if (s.length > 1e6) { reject(new Error('too large')); req.destroy(); }
    });
    req.on('end', () => {
      try { resolve(s ? JSON.parse(s) : {}); } catch (e) { reject(e); }
    });
  });
}

async function api(req, res, url) {
  if (!authorized(req, url)) return send(res, 401, { error: 'unauthorized' });
  const p = url.pathname;
  const m = /^\/api\/tasks\/([\w-]+)$/.exec(p);

  // ショートカット用: GET/POST /api/quick?text=...  （クイック入力記法が使える）
  if (p === '/api/quick') {
    let text = url.searchParams.get('text');
    if (text == null && req.method === 'POST') {
      const b = await readBody(req);
      text = b.text;
    }
    const t = text && createTask(parseQuick(text));
    return t ? send(res, 201, t) : send(res, 400, { error: 'text required' });
  }
  if (p === '/api/rev' && req.method === 'GET') return send(res, 200, { rev: db.rev });
  if (p === '/api/tasks' && req.method === 'GET') return send(res, 200, db);
  if (p === '/api/tasks' && req.method === 'POST') {
    const t = createTask(await readBody(req));
    return t ? send(res, 201, t) : send(res, 400, { error: 'title required' });
  }
  if (m) {
    const t = db.tasks.find((x) => x.id === m[1]);
    if (!t) return send(res, 404, { error: 'not found' });
    if (req.method === 'PATCH') {
      applyFields(t, await readBody(req));
      save();
      return send(res, 200, t);
    }
    if (req.method === 'DELETE') {
      db.tasks = db.tasks.filter((x) => x !== t);
      save();
      return send(res, 200, { ok: true });
    }
  }
  send(res, 404, { error: 'not found' });
}

function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(PUBLIC, rel);
  if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(buf);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) await api(req, res, url);
    else if (req.method === 'GET') serveStatic(req, res, url);
    else { res.writeHead(405); res.end(); }
  } catch (e) {
    send(res, 400, { error: String(e.message || e) });
  }
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Task app: http://localhost:${PORT}`);
    console.log(`Token: ${TOKEN}`);
  });
}
module.exports = { server };
